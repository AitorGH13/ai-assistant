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

  // Persist conversations whenever they change (skip first mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    persistConversations(conversations);
  }, [conversations]);

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

    const title = generateTitle(messages);
    const now = new Date().toISOString();
    
    const updatedConversation: Conversation = {
      id,
      title,
      messages: [...messages],
      createdAt: conversations.find(c => c.id === id)?.createdAt || now,
      updatedAt: now,
    };

    setConversations(prev => {
      const existingIndex = prev.findIndex(c => c.id === id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedConversation;
        return updated;
      } else {
        return [updatedConversation, ...prev];
      }
    });
  }, [conversations, generateTitle]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    
    // If deleting current conversation, create a new one
    if (id === currentConversationId) {
      createConversation();
    }
  }, [currentConversationId, createConversation]);

  const updateCurrentMessages = useCallback((messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (typeof messages === 'function') {
      setCurrentMessages(messages);
    } else {
      setCurrentMessages(messages);
    }
  }, []);

  const addTTSAudio = (audio: TTSAudio, conversationId?: string) => {
    const targetConversationId = conversationId || currentConversationId;
    
    if (!targetConversationId) {
      console.error('No hay conversación activa para añadir audio TTS');
      return;
    }

    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (conv.id === targetConversationId) {
          const isNewTTSConversation = !conv.ttsHistory || conv.ttsHistory.length === 0;
          const title = isNewTTSConversation && conv.messages.length === 0
            ? (audio.text.slice(0, 50) + (audio.text.length > 50 ? '...' : ''))
            : conv.title;

          return {
            ...conv,
            title,
            ttsHistory: [audio, ...(conv.ttsHistory || [])],
            updatedAt: new Date().toISOString(),
          };
        }
        return conv;
      });
      return updated;
    });
  };

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
    addTTSAudio,
    deleteTTSAudio,
    updateConversationTitle,
  };
}