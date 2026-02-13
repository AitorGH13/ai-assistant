import { useState, useEffect, useCallback, useRef } from "react";
import { Conversation, ChatMessage, TTSAudio } from "../types";

const STORAGE_KEY = "ai-assistant-conversations";

export function useConversations(): {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: ChatMessage[];
  currentTTSHistory: TTSAudio[];
  isLoading: boolean;
  isInitialized: boolean;
  createConversation: () => string;
  loadConversation: (id: string) => void;
  saveConversation: (id: string, messages: ChatMessage[]) => void;
  deleteConversation: (id: string) => void;
  updateCurrentMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  addChatMessage: (message: ChatMessage, conversationId?: string) => void;
  addTTSAudio: (audio: TTSAudio, conversationId?: string) => void;
  deleteTTSAudio: (audioId: string) => void;
  updateConversationTitle: (id: string, newTitle: string) => void;
} {
    // Cambiar el título de una conversación
    const updateConversationTitle = useCallback((id: string, newTitle: string) => {
      setConversations(prev => prev.map(conv =>
        conv.id === id ? { ...conv, title: newTitle, updatedAt: new Date().toISOString() } : conv
      ));
    }, []);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    // Cargar conversaciones del storage en la inicialización
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
    return [];
  });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [isLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isFirstMount = useRef(true);

  // Marcar como inicializado después del primer render
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const persistConversations = useCallback((convs: Conversation[]) => {
    try {
      if (convs.length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to persist conversations:', error);
    }
  }, []);

  // Persist conversations whenever they change (skip first mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    persistConversations(conversations);
  }, [conversations, persistConversations]);
  
  // Persistir antes de cerrar/recargar la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      persistConversations(conversations);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [conversations, persistConversations]);

  const generateTitle = useCallback((messages: ChatMessage[]): string => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'New Conversation';
    
    const content = typeof firstUserMessage.content === 'string' 
      ? firstUserMessage.content 
      : firstUserMessage.content.find(c => c.type === 'text')?.text || 'New Conversation';
    
    return content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }, []);

  const createConversation = useCallback((): string => {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newConversation: Conversation = {
      id: newId,
      title: 'Nueva conversación',
      messages: [],
      createdAt: now,
      updatedAt: now,
      ttsHistory: [],
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    setCurrentMessages([]);
    return newId;
  }, []);

  const loadConversation = useCallback((id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversationId(id);
      setCurrentMessages([...conversation.messages]);
    }
  }, [conversations]);

  const saveConversation = useCallback((id: string, messages: ChatMessage[]) => {
    if (!id || messages.length === 0) return;

    const now = new Date().toISOString();

    setConversations(prev => {
      const existingIndex = prev.findIndex(c => c.id === id);
      const existingConv = prev[existingIndex];
      
      // Solo genera un título automático si es una conversación nueva o tiene el título por defecto
      const title = existingConv && existingConv.title !== 'Nueva conversación' 
        ? existingConv.title 
        : generateTitle(messages);
      
      const updatedConversation: Conversation = {
        id,
        title,
        messages: [...messages],
        createdAt: existingConv?.createdAt || now,
        updatedAt: now,
        ttsHistory: existingConv?.ttsHistory ? [...existingConv.ttsHistory] : [],
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedConversation;
        return updated;
      } else {
        return [updatedConversation, ...prev];
      }
    });
  }, [generateTitle]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);

      if (id === currentConversationId) {
        const deleted = prev.find(c => c.id === id);
        const wasTTSOnly = !!(deleted && (!deleted.messages || deleted.messages.length === 0) && deleted.ttsHistory && deleted.ttsHistory.length > 0);

        if (wasTTSOnly && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("forceChatMode"));
        }

        const nextConversation = updated.find(conv => {
          const hasMessages = conv.messages && conv.messages.length > 0;
          const hasTTSAudios = conv.ttsHistory && conv.ttsHistory.length > 0;
          return hasMessages || hasTTSAudios;
        }) || updated[0];

        if (nextConversation) {
          setCurrentConversationId(nextConversation.id);
          setCurrentMessages([...nextConversation.messages]);
        } else {
          setCurrentConversationId(null);
          setCurrentMessages([]);
        }
      }

      return updated;
    });
  }, [currentConversationId]);

  const updateCurrentMessages = useCallback((messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (typeof messages === 'function') {
      setCurrentMessages(messages);
    } else {
      setCurrentMessages(messages);
    }
  }, []);

  const addChatMessage = useCallback((message: ChatMessage, conversationId?: string) => {
    const targetConversationId = conversationId || currentConversationId;
    
    if (!targetConversationId) {
      return;
    }

    setConversations((prev) => {
      // Verificar si la conversación existe
      const exists = prev.some(conv => conv.id === targetConversationId);
      
      if (!exists) {
        return prev;
      }
      
      const updated = prev.map((conv) => {
        if (conv.id === targetConversationId) {
          const newMessages = [...conv.messages, message];
          
          // Actualizar título si es el primer mensaje del usuario o si aún no tiene título personalizado
          const shouldGenerateTitle = conv.title === 'Nueva conversación' || 
            conv.title.startsWith('Conversación de voz');
          const title = shouldGenerateTitle
            ? generateTitle(newMessages)
            : conv.title;

          return {
            ...conv,
            title,
            messages: newMessages,
            updatedAt: new Date().toISOString(),
          };
        }
        return conv;
      });
      
      // Forzar nuevo array para asegurar re-render
      return [...updated];
    });

    // Actualizar currentMessages también
    if (targetConversationId === currentConversationId) {
      setCurrentMessages((prev) => [...prev, message]);
    }
  }, [currentConversationId, generateTitle]);

  const addTTSAudio = useCallback((audio: TTSAudio, conversationId?: string) => {
    const targetConversationId = conversationId || currentConversationId;
    
    if (!targetConversationId) {
      console.error('No hay conversación activa para añadir audio TTS');
      return;
    }

    setConversations((prev) => {
      // Verificar si la conversación existe
      const exists = prev.some(conv => conv.id === targetConversationId);
      
      if (!exists) {
        console.error(`Conversación ${targetConversationId} no encontrada`);
        return prev;
      }
      
      const updated = prev.map((conv) => {
        if (conv.id === targetConversationId) {
          const isNewTTSConversation = !conv.ttsHistory || conv.ttsHistory.length === 0;
          
          // Para conversaciones de voz, generar título desde mensajes si existen
          let title = conv.title;
          if (isNewTTSConversation) {
            if (audio.voiceId === "conversational-ai" && conv.messages.length > 0) {
              // Conversación de voz con mensajes: usar título de los mensajes
              title = generateTitle(conv.messages);
            } else if (conv.messages.length === 0) {
              // Solo audio TTS sin mensajes: usar texto del audio
              title = audio.text.slice(0, 50) + (audio.text.length > 50 ? '...' : '');
            }
          }

          return {
            ...conv,
            title,
            ttsHistory: [audio, ...(conv.ttsHistory || [])],
            updatedAt: new Date().toISOString(),
          };
        }
        return conv;
      });
      
      // Forzar nuevo array para asegurar re-render
      return [...updated];
    });
  }, [currentConversationId, generateTitle]);

  const deleteTTSAudio = (audioId: string) => {
    if (!currentConversationId) return;

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              ttsHistory: (conv.ttsHistory || []).filter((a) => a.id !== audioId),
            }
          : conv
      )
    );
  };

  const currentTTSHistory =
    conversations.find((c) => c.id === currentConversationId)?.ttsHistory || [];

  return {
    conversations,
    currentConversationId,
    currentMessages,
    currentTTSHistory,
    isLoading,
    isInitialized,
    createConversation,
    loadConversation,
    saveConversation,
    deleteConversation,
    updateCurrentMessages,
    addChatMessage,
    addTTSAudio,
    deleteTTSAudio,
    updateConversationTitle,
  };
}