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

    const content =
      typeof firstUserMessage.content === "string"
        ? firstUserMessage.content
        : firstUserMessage.content.find((chunk) => chunk.type === "text")?.text || "Nueva conversación";

    return content.slice(0, 50) + (content.length > 50 ? "..." : "");
  }, []);

  const parseMessageRows = useCallback((rows: MessageRow[]): ChatMessage[] => {
    return rows.map((row) => {
      let content = row.content;

      // Si viene como string, intentamos ver si es un JSON (multimodal)
      if (typeof content === 'string') {
        const trimmed = content.trim();
        // Si parece un Array o un Objeto JSON, intentamos parsearlo
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            content = JSON.parse(content);
          } catch (e) {
            // Si falla el parse, asumimos que es texto normal (ej: "[Hola]")
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
      .order("updated_at", { ascending: false });

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

    setConversations(parsedConversations);

    const nextConversationId = parsedConversations[0]?.id ?? null;
    setCurrentConversationId(nextConversationId);
    setCurrentMessages(nextConversationId ? messageMap[nextConversationId] || (await fetchMessages(nextConversationId)) : []);

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

    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    setCurrentMessages([]);

    // if (user) {
    //   void supabase
    //     .from("conversations")
    //     .insert({
    //       id: newId,
    //       user_id: user.id,
    //       title: "Nueva conversación",
    //     })
    //     .then(({ error }: { error: Error | null }) => {
    //       if (error) {
    //         console.error("Failed to create conversation:", error);
    //       }
    //     });
    // }

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
        // Only update if we actually got messages, otherwise keep local
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

      const now = new Date().toISOString();

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== id) return conversation;
          const title =
            conversation.title !== "Nueva conversación" ? conversation.title : generateTitle(messages);
          return {
            ...conversation,
            title,
            messages: [...messages],
            updatedAt: now,
          };
        })
      );

      // Resolve the title using the value computed inside the state updater
      let resolvedTitle = "";
      setConversations((prev) => {
        const match = prev.find((c) => c.id === id);
        resolvedTitle = match?.title || generateTitle(messages);
        return prev; // no-op, just reading
      });
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

      if (messages.length === 0) {
        return;
      }

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
    [user, generateTitle]
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

          const nextConversation = updated.find((conversation) => {
            const hasMessages = conversation.messages && conversation.messages.length > 0;
            const hasTTSAudios = conversation.ttsHistory && conversation.ttsHistory.length > 0;
            return hasMessages || hasTTSAudios;
          });

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
          return [
            {
              id: targetConversationId,
              title: generateTitle([message]),
              messages: [message],
              createdAt: now,
              updatedAt: now,
              ttsHistory: [],
            },
            ...prev,
          ];
        }

        const alreadyExists = existing.messages.some((item) => item.id === message.id);
        const newMessages = alreadyExists ? existing.messages : [...existing.messages, message];
        const shouldGenerateTitle =
          existing.title === "Nueva conversación" || existing.title.startsWith("Conversación de voz");

        return prev.map((conversation) =>
          conversation.id === targetConversationId
            ? {
                ...conversation,
                title: shouldGenerateTitle ? generateTitle(newMessages) : conversation.title,
                messages: newMessages,
                updatedAt: now,
              }
            : conversation
        );
      });

      if (targetConversationId === currentConversationId) {
        setCurrentMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }

      if (!user) return;

      // Use the conversation's current title from state instead of regenerating from single message
      const existingConversation = conversations.find((c) => c.id === targetConversationId);
      const title = existingConversation?.title && existingConversation.title !== "Nueva conversación"
        ? existingConversation.title
        : message.role === "user" && typeof message.content === "string"
          ? message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")
          : "Nueva conversación";

      void supabase
        .from("conversations")
        .upsert({
          id: targetConversationId,
          user_id: user.id,
          title,
          updated_at: now,
        })
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to upsert conversation metadata:", error);
          }
        });

      void supabase
        .from("messages")
        .upsert({
          id: message.id,
          conversation_id: targetConversationId,
          role: message.role,
          content: message.content,
          tool_used: Boolean(message.toolUsed),
          created_at: message.timestamp,
        })
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            console.error("Failed to persist message:", error);
          }
        });
    },
    [createConversation, currentConversationId, generateTitle, user, conversations]
  );

  const addTTSAudio = useCallback(
    async (audio: TTSAudio, conversationId?: string) => { // Añadido async
      const targetConversationId = conversationId || currentConversationId;

      if (!targetConversationId) {
        console.error("No hay conversación activa para añadir audio TTS");
        return;
      }

      // 1. Calculamos el título fuera para poder usarlo en Supabase
      // (Lógica simplificada: si no tenemos acceso fácil al estado actual exacto aquí,
      // usamos el texto del audio si es el primero, o mantenemos el título genérico).
      const titleToSave = audio.text.slice(0, 50) + (audio.text.length > 50 ? "..." : "");

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== targetConversationId) {
            return conversation;
          }

          const isNewTTSConversation = !conversation.ttsHistory || conversation.ttsHistory.length === 0;
          let title = conversation.title;

          // Actualizamos el título localmente si es necesario
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
            updatedAt: new Date().toISOString(),
          };
        })
      );

      if (!user) return;

      // 2. PRIMERO: Aseguramos que la conversación existe en la DB
      // Si ya existía, esto actualiza el 'updated_at'. Si no, la crea.
      const { error: convoError } = await supabase
        .from("conversations")
        .upsert({
          id: targetConversationId,
          user_id: user.id,
          title: titleToSave, // Usamos el título generado o uno temporal
          updated_at: new Date().toISOString(),
        }); // Nota: Si prefieres no sobrescribir el título si ya existe, necesitarías lógica extra, 
            // pero el upsert básico es necesario para evitar el error 42501.

      if (convoError) {
        console.error("Failed to upsert conversation for TTS:", convoError);
        return; // Si falla crear la conversación, no intentamos meter el audio
      }

      // 3. SEGUNDO: Insertamos el audio
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
    [currentConversationId, generateTitle, user]
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

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id ? { ...conversation, title: newTitle, updatedAt: now } : conversation
      )
    );

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
