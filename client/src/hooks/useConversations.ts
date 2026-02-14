import { useState, useEffect, useCallback } from "react";
import { Conversation, ChatMessage, TTSAudio, MessageContent } from "../types";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthProvider";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string | MessageContent[];
  tool_used: boolean;
  created_at: string;
};

type TTSAudioRow = {
  id: string;
  conversation_id: string;
  text: string;
  audio_url: string;
  timestamp_ms: number;
  voice_id: string;
  voice_name: string;
  created_at: string;
};

// Función auxiliar para ordenar conversaciones
const sortConversations = (items: Conversation[]) => {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    
    const createdA = new Date(a.createdAt).getTime();
    const createdB = new Date(b.createdAt).getTime();
    return createdB - createdA;
  });
};

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
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const generateTitle = useCallback((messages: ChatMessage[]): string => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    if (!firstUserMessage) return "Nueva conversación";
    const DEFAULT_IMAGE_PROMPT = "¿Qué hay en esta imagen?";

    // Si es texto simple
    if (typeof firstUserMessage.content === "string") {
      const content = firstUserMessage.content;
      return content.slice(0, 50) + (content.length > 50 ? "..." : "");
    }

    // Si es un array (multimodal / imagen)
    if (Array.isArray(firstUserMessage.content)) {
      // Intentar buscar un fragmento de texto
      const textChunk = firstUserMessage.content.find((chunk) => chunk.type === "text");

      if (textChunk && textChunk.text && textChunk.text.trim().length > 0) {
        const text = textChunk.text.trim();
        // Si el texto es el prompt por defecto, usar un título de análisis de imagen
        if (text === DEFAULT_IMAGE_PROMPT) {
          return "Análisis de imagen";
        }
        return text.slice(0, 50) + (text.length > 50 ? "..." : "");
      }

      // Si no hay texto, comprobar si hay imagen
      const hasImage = firstUserMessage.content.some((chunk) => chunk.type === "image_url");
      if (hasImage) {
        return "Análisis de imagen";
      }
    }

    return "Nueva conversación";
  }, []);

  const parseMessageRows = useCallback((rows: MessageRow[]): ChatMessage[] => {
    return rows.map((row) => {
      let content = row.content;

      if (typeof content === 'string') {
        const trimmed = content.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            content = JSON.parse(content);
          } catch (e) {
            console.warn("Contenido parece JSON pero no lo es, se usará como texto:", e);
          }
        }
      }

      return {
        id: row.id,
        role: row.role,
        content: content,
        timestamp: row.created_at,
        toolUsed: row.tool_used,
      };
    });
  }, []);

  const parseTTSAudioRows = useCallback((rows: TTSAudioRow[]): TTSAudio[] => {
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      audioUrl: row.audio_url,
      timestamp: row.timestamp_ms,
      voiceId: row.voice_id,
      voiceName: row.voice_name,
    }));
  }, []);

  const fetchMessages = useCallback(
    async (conversationId: string): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, tool_used, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to fetch messages:", error);
        return [];
      }

      return parseMessageRows((data || []) as MessageRow[]);
    },
    [parseMessageRows]
  );

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setCurrentConversationId(null);
      setCurrentMessages([]);
      setIsInitialized(true);
      return;
    }

    setIsLoading(true);

    const { data: conversationRowsRaw, error: conversationError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (conversationError) {
      console.error("Failed to fetch conversations:", conversationError);
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    const conversationRows = (conversationRowsRaw || []) as ConversationRow[];
    const ids = conversationRows.map((row) => row.id);
    let messageMap: Record<string, ChatMessage[]> = {};
    let ttsMap: Record<string, TTSAudio[]> = {};

    if (ids.length > 0) {
      const { data: messageRowsRaw, error: messageError } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, tool_used, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("Failed to fetch conversation messages:", messageError);
      } else {
        const grouped: Record<string, MessageRow[]> = {};
        for (const row of (messageRowsRaw || []) as MessageRow[]) {
          if (!grouped[row.conversation_id]) {
            grouped[row.conversation_id] = [];
          }
          grouped[row.conversation_id].push(row);
        }

        messageMap = Object.fromEntries(
          Object.entries(grouped).map(([conversationId, rows]) => [conversationId, parseMessageRows(rows)])
        );
      }

      const { data: ttsRowsRaw, error: ttsError } = await supabase
        .from("tts_audios")
        .select("id, conversation_id, text, audio_url, timestamp_ms, voice_id, voice_name, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      if (ttsError) {
        console.error("Failed to fetch tts audios:", ttsError);
      } else {
        const grouped: Record<string, TTSAudioRow[]> = {};
        for (const row of (ttsRowsRaw || []) as TTSAudioRow[]) {
          if (!grouped[row.conversation_id]) {
            grouped[row.conversation_id] = [];
          }
          grouped[row.conversation_id].push(row);
        }

        ttsMap = Object.fromEntries(
          Object.entries(grouped).map(([conversationId, rows]) => [conversationId, parseTTSAudioRows(rows)])
        );
      }
    }

    const parsedConversations: Conversation[] = conversationRows.map((row) => ({
      id: row.id,
      title: row.title,
      messages: messageMap[row.id] || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ttsHistory: ttsMap[row.id] || [],
    }));

    setConversations(sortConversations(parsedConversations));
    setCurrentConversationId(null);
    setCurrentMessages([]);

    setIsLoading(false);
    setIsInitialized(true);
  }, [user, fetchMessages, parseMessageRows, parseTTSAudioRows]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback((): string => {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newConversation: Conversation = {
      id: newId,
      title: "Nueva conversación",
      messages: [],
      createdAt: now,
      updatedAt: now,
      ttsHistory: [],
    };

    setConversations((prev) => sortConversations([newConversation, ...prev]));
    setCurrentConversationId(newId);
    setCurrentMessages([]);

    return newId;
  }, [user]);

  const loadConversation = useCallback(
    (id: string) => {
      setCurrentConversationId(id);

      const localConversation = conversations.find((conversation) => conversation.id === id);
      if (localConversation && localConversation.messages.length > 0) {
        setCurrentMessages([...localConversation.messages]);
      }

      void fetchMessages(id).then((messages) => {
        if (messages.length > 0 || !localConversation?.messages.length) {
          setCurrentMessages(messages);
          setConversations((prev) =>
            prev.map((conversation) => (conversation.id === id ? { ...conversation, messages } : conversation))
          );
        }
      });
    },
    [conversations, fetchMessages]
  );

  const saveConversation = useCallback(
    (id: string, messages: ChatMessage[]) => {
      if (!id || !user) return;

      const existing = conversations.find((c) => c.id === id);
      const hasChanges = !existing || 
                         existing.messages.length !== messages.length ||
                         (messages.length > 0 && existing.messages[existing.messages.length - 1]?.id !== messages[messages.length - 1]?.id);
      const needsTitle = existing?.title === "Nueva conversación" && messages.length > 0;

      if (!hasChanges && !needsTitle) return; 

      const now = new Date().toISOString();

      setConversations((prev) => {
        const updated = prev.map((conversation) => {
          if (conversation.id !== id) return conversation;
          const title =
            conversation.title !== "Nueva conversación" ? conversation.title : generateTitle(messages);
          return {
            ...conversation,
            title,
            messages: [...messages],
            updatedAt: now, 
          };
        });
        return sortConversations(updated);
      });

      let resolvedTitle = "";
      const currentConvo = conversations.find(c => c.id === id);
      resolvedTitle = currentConvo?.title !== "Nueva conversación" ? currentConvo?.title || "" : generateTitle(messages);
      
      if (!resolvedTitle) resolvedTitle = generateTitle(messages);

      void supabase
        .from("conversations")
        .upsert({
          id,
          user_id: user.id,
          title: resolvedTitle,
          updated_at: now,
        })
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to upsert conversation:", error);
          }
        });

      if (messages.length === 0) return;

      const rows = messages.map((message) => ({
        id: message.id,
        conversation_id: id,
        role: message.role,
        content: message.content,
        tool_used: Boolean(message.toolUsed),
        created_at: message.timestamp,
      }));

      void supabase
        .from("messages")
        .upsert(rows)
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to upsert messages:", error);
          }
        });
    },
    [user, generateTitle, conversations] 
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const updated = prev.filter((conversation) => conversation.id !== id);

        if (id === currentConversationId) {
          const deleted = prev.find((conversation) => conversation.id === id);
          const wasTTSOnly =
            !!deleted &&
            (!deleted.messages || deleted.messages.length === 0) &&
            deleted.ttsHistory &&
            deleted.ttsHistory.length > 0;

          if (wasTTSOnly && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("forceChatMode"));
          }

          setCurrentConversationId(null);
          setCurrentMessages([]);
        }
        return updated;
      });

      void supabase
        .from("conversations")
        .delete()
        .eq("id", id)
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to delete conversation:", error);
          }
        });
    },
    [currentConversationId]
  );

  const updateCurrentMessages = useCallback(
    (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setCurrentMessages(messages);
    },
    []
  );

  const addChatMessage = useCallback(
    (message: ChatMessage, conversationId?: string) => {
      const targetConversationId = conversationId || currentConversationId || createConversation();
      const now = new Date().toISOString();

      setConversations((prev) => {
        const existing = prev.find((conversation) => conversation.id === targetConversationId);

        if (!existing) {
          const newConvo = {
            id: targetConversationId,
            title: generateTitle([message]), // Ahora esto maneja imágenes correctamente
            messages: [message],
            createdAt: now,
            updatedAt: now,
            ttsHistory: [],
          };
          return sortConversations([newConvo, ...prev]);
        }

        const alreadyExists = existing.messages.some((item) => item.id === message.id);
        const newMessages = alreadyExists ? existing.messages : [...existing.messages, message];
        
        // Regenerar título si es nueva o si es "Imagen adjunta" y ahora el usuario escribe texto
        const shouldGenerateTitle =
          existing.title === "Nueva conversación" || 
          existing.title === "Imagen adjunta" ||
          existing.title.startsWith("Conversación de voz");

        const updatedList = prev.map((conversation) =>
          conversation.id === targetConversationId
            ? {
                ...conversation,
                title: shouldGenerateTitle ? generateTitle(newMessages) : conversation.title,
                messages: newMessages,
                updatedAt: now,
              }
            : conversation
        );
        
        return sortConversations(updatedList);
      });

      if (targetConversationId === currentConversationId) {
        setCurrentMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      if (!user) return;

      const existingConversation = conversations.find((c) => c.id === targetConversationId);
      
      let titleToSave = "Nueva conversación";
      
      if (existingConversation && existingConversation.title !== "Nueva conversación" && existingConversation.title !== "Imagen adjunta") {
         titleToSave = existingConversation.title;
      } else {
         // Usamos generateTitle pasando el mensaje actual para obtener un título válido (texto o "Imagen adjunta")
         titleToSave = generateTitle([message]);
      }

      void supabase
        .from("conversations")
        .upsert({
          id: targetConversationId,
          user_id: user.id,
          title: titleToSave,
          updated_at: now,
        })
        .then(({ error }: { error: Error | null }) => {
          if (error) console.error("Failed to upsert conversation metadata:", error);
        });

      void supabase
        .from("messages")
        .upsert({
          id: message.id,
          conversation_id: targetConversationId,
          role: message.role,
          content: message.content, // Supabase maneja JSONB, si tu columna es TEXT asegúrate de que esto se guarde bien
          tool_used: Boolean(message.toolUsed),
          created_at: message.timestamp,
        })
        .then(({ error }: { error: Error | null }) => {
          if (error) console.error("Failed to persist message:", error);
        });
    },
    [createConversation, currentConversationId, generateTitle, user, conversations]
  );

  const addTTSAudio = useCallback(
    async (audio: TTSAudio, conversationId?: string) => {
      const targetConversationId = conversationId || currentConversationId || createConversation();

      // (Se elimina el bloque 'if (!targetConversationId) return' que impedía guardar en chats nuevos)

      const titleToSave = audio.text.slice(0, 50) + (audio.text.length > 50 ? "..." : "");
      const now = new Date().toISOString();

      const existingConvo = conversations.find(c => c.id === targetConversationId);
      const dbTitle = existingConvo && existingConvo.title !== "Nueva conversación" 
        ? existingConvo.title 
        : titleToSave;

      setConversations((prev) => {
        const existing = prev.find((conversation) => conversation.id === targetConversationId);

        if (!existing) {
          const newConvo: Conversation = {
            id: targetConversationId,
            title: titleToSave,
            messages: [],
            createdAt: now,
            updatedAt: now,
            ttsHistory: [audio],
          };
          return sortConversations([newConvo, ...prev]);
        }

        const updatedList = prev.map((conversation) => {
          if (conversation.id !== targetConversationId) {
            return conversation;
          }

          const isNewTTSConversation = !conversation.ttsHistory || conversation.ttsHistory.length === 0;
          let title = conversation.title;

          // Lógica de actualización de título en el estado local
          if (isNewTTSConversation) {
             if (conversation.messages.length === 0) {
               title = titleToSave; 
             } else if (audio.voiceId === "conversational-ai") {
               title = generateTitle(conversation.messages);
             }
          }

          return {
            ...conversation,
            title,
            ttsHistory: [audio, ...(conversation.ttsHistory || [])],
            updatedAt: now,
          };
        });
        return sortConversations(updatedList);
      });

      if (!user) return;

      const { error: convoError } = await supabase
        .from("conversations")
        .upsert({
          id: targetConversationId,
          user_id: user.id,
          title: dbTitle, // Usamos dbTitle para no machacar títulos existentes
          updated_at: now,
        });

      if (convoError) {
        console.error("Failed to upsert conversation for TTS:", convoError);
        return; 
      }

      const { error } = await supabase
        .from("tts_audios")
        .insert({
          id: audio.id,
          conversation_id: targetConversationId,
          text: audio.text,
          audio_url: audio.audioUrl,
          timestamp_ms: audio.timestamp,
          voice_id: audio.voiceId,
          voice_name: audio.voiceName,
        });

      if (error) {
        console.error("Failed to persist TTS audio:", error);
      }
    },
    [currentConversationId, generateTitle, user, createConversation, conversations]
  );

  const deleteTTSAudio = useCallback(
    (audioId: string) => {
      if (!currentConversationId) return;

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === currentConversationId
            ? {
                ...conversation,
                ttsHistory: (conversation.ttsHistory || []).filter((audio) => audio.id !== audioId),
              }
            : conversation
        )
      );

      void supabase
        .from("tts_audios")
        .delete()
        .eq("id", audioId)
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to delete TTS audio:", error);
          }
        });
    },
    [currentConversationId]
  );

  const updateConversationTitle = useCallback((id: string, newTitle: string) => {
    const now = new Date().toISOString();

    setConversations((prev) => {
      const updated = prev.map((conversation) =>
        conversation.id === id ? { ...conversation, title: newTitle, updatedAt: now } : conversation
      );
      return sortConversations(updated);
    });

    void supabase
      .from("conversations")
      .update({ title: newTitle, updated_at: now })
      .eq("id", id)
      .then(({ error }: { error: Error | null }) => {
        if (error) {
          console.error("Failed to update conversation title:", error);
        }
      });
  }, []);

  const currentTTSHistory = conversations.find((conversation) => conversation.id === currentConversationId)?.ttsHistory || [];

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