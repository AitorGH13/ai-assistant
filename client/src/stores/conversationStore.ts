import { create } from "zustand";
import { Conversation, ChatMessage, TTSAudio, MessageContent } from "../types";
import api from "../services/api";
import { supabase } from "../lib/supabase";

// Helper to sort conversations
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

interface ConversationState {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: ChatMessage[];
  isLoading: boolean;
  isInitialized: boolean;
  temporaryConversationIds: Set<string>;

  // Core CRUD
  fetchConversations: () => Promise<void>;
  loadConversation: (id: string) => void;
  createConversation: (isTemporary?: boolean) => string;
  deleteConversation: (id: string) => void;
  updateCurrentMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  addTTSAudio: (audio: TTSAudio, conversationId?: string) => void;
  deleteTTSAudio: (audioId: string) => void;
  updateConversationTitle: (id: string, newTitle: string) => void;

  // Business logic (moved from App.tsx)
  handleSendMessage: (content: string, imageBase64?: string, imageName?: string, imageFile?: File) => Promise<void>;
  handleTTSGenerate: (text: string) => Promise<void>;

  // Derived state helpers
  getCurrentConversation: () => Conversation | undefined;
  getCurrentTTSHistory: () => TTSAudio[];
  getIsConversationalHistory: () => boolean;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentMessages: [],
  isLoading: false,
  isInitialized: false,
  temporaryConversationIds: new Set(),

  // ---------- Derived helpers ----------
  getCurrentConversation: () => {
    const { conversations, currentConversationId } = get();
    return conversations.find((c) => c.id === currentConversationId);
  },

  getCurrentTTSHistory: () => {
    const conv = get().getCurrentConversation();
    return conv?.ttsHistory || [];
  },

  getIsConversationalHistory: () => {
    const ttsHistory = get().getCurrentTTSHistory();
    return ttsHistory.some(
      (audio) =>
        audio.voiceId === "conversational-ai" ||
        audio.transcript?.some((t) => t.role === "user")
    );
  },

  // ---------- Fetch Conversations ----------
  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get("/conversations");
      const apiConversations = response.data.map((c: any) => {
        const messages = (c.history || []).map((m: any, idx: number) => ({
          id:
            m.id !== undefined && m.id !== null
              ? `${m.id}-${idx}`
              : `msg-${c.id}-${idx}`,
          role: m.role || (m.id === 0 ? "user" : "assistant"),
          content: m.msg,
          timestamp: m.date,
        }));

        const ttsHistory = (c.voice_sessions || []).map((session: any) => {
          const transcripts = session.transcript || [];
          const meta = transcripts[0] || {};
          return {
            id: session.id,
            voiceId:
              meta.voice_id ||
              meta.voiceId ||
              session.voice_id ||
              "conversational-ai",
            voiceName:
              session.voiceName ||
              session.voice_name ||
              meta.voiceName ||
              meta.voice_name ||
              "Roger - Laid-Back, Casual, Resonant",
            text: meta.msg || meta.text || session.text || "Audio",
            audioUrl: session.audio_url || session.audioUrl || "",
            timestamp: session.created_at
              ? new Date(session.created_at).getTime()
              : Date.now(),
            transcript: transcripts,
          };
        });

        return {
          id: c.id,
          title: c.title,
          messages,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          ttsHistory,
        };
      });

      set((state) => {
        const localConversations = state.conversations.filter(
          (c) =>
            c.isLocal &&
            !apiConversations.some((apiC: any) => apiC.id === c.id)
        );
        return {
          conversations: sortConversations([
            ...apiConversations,
            ...localConversations,
          ]),
        };
      });
    } catch {
      // fetch failed
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  // ---------- Load Conversation ----------
  loadConversation: async (id: string) => {
    const { conversations } = get();
    set({ currentConversationId: id });

    const local = conversations.find((c) => c.id === id);
    if (
      local &&
      (local.messages.length > 0 ||
        (local.ttsHistory && local.ttsHistory.length > 0))
    ) {
      set({ currentMessages: local.messages });
    } else {
      set({ currentMessages: [], isLoading: true });
    }

    try {
      const response = await api.get(`/conversations/${id}`);
      const data = response.data;

      const messages: ChatMessage[] = (data.history || []).map(
        (m: any, idx: number) => ({
          id:
            m.id !== undefined && m.id !== null
              ? `${m.id}-${idx}`
              : `msg-${id}-${idx}`,
          role: m.role,
          content: m.msg || m.content || "",
          timestamp: m.date || m.created_at || new Date().toISOString(),
        })
      );

      set({ currentMessages: messages });

      const ttsHistory = (data.voice_sessions || data.ttsHistory || []).map(
        (session: any) => {
          const transcripts = session.transcript || [];
          const meta = transcripts[0] || {};
          return {
            id: session.id,
            voiceId:
              meta.voice_id ||
              meta.voiceId ||
              session.voice_id ||
              "conversational-ai",
            voiceName:
              session.voiceName ||
              session.voice_name ||
              meta.voiceName ||
              meta.voice_name ||
              "Roger - Laid-Back, Casual, Resonant",
            text: meta.msg || meta.text || session.text || "Audio",
            audioUrl: session.audio_url || session.audioUrl || "",
            timestamp: session.created_at
              ? new Date(session.created_at).getTime()
              : Date.now(),
            transcript: transcripts,
          };
        }
      );

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id
            ? {
                ...c,
                messages,
                ttsHistory,
                title: data.title || c.title,
                isLocal: false,
              }
            : c
        ),
      }));
    } catch {
      // load failed
    } finally {
      set({ isLoading: false });
    }
  },

  // ---------- Create Conversation ----------
  createConversation: (isTemporary = false) => {
    const { conversations, currentConversationId } = get();
    const current = conversations.find((c) => c.id === currentConversationId);
    const isEmpty = !current?.messages?.length && !current?.ttsHistory?.length;
    if (
      current &&
      current.isLocal &&
      isEmpty &&
      !!current.isTemporary === isTemporary
    ) {
      return current.id;
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newConvo: Conversation = {
      id: newId,
      title: isTemporary ? "Chat Temporal" : "Nueva conversación",
      messages: [],
      createdAt: now,
      updatedAt: now,
      isTemporary,
      isLocal: true,
    };

    if (isTemporary) {
      set((state) => {
        state.temporaryConversationIds.add(newId);
        return {
          conversations: sortConversations([newConvo, ...state.conversations]),
          currentConversationId: newId,
          currentMessages: [],
        };
      });
    } else {
      set((state) => ({
        conversations: sortConversations([newConvo, ...state.conversations]),
        currentConversationId: newId,
        currentMessages: [],
      }));
    }
    return newId;
  },

  // ---------- Delete Conversation ----------
  deleteConversation: async (id: string) => {
    const { currentConversationId } = get();
    try {
      await api.delete(`/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversationId:
          state.currentConversationId === id
            ? null
            : state.currentConversationId,
        currentMessages:
          currentConversationId === id ? [] : state.currentMessages,
      }));
    } catch {
      // delete failed
    }
  },

  // ---------- Update Messages ----------
  updateCurrentMessages: (messages) => {
    if (typeof messages === "function") {
      set((state) => ({ currentMessages: messages(state.currentMessages) }));
    } else {
      set({ currentMessages: messages });
    }
  },

  // ---------- TTS Audio ----------
  addTTSAudio: async (audio: TTSAudio, conversationId?: string) => {
    const { currentConversationId, conversations, temporaryConversationIds } =
      get();
    const targetId = conversationId || currentConversationId;
    if (!targetId) return;

    const now = new Date().toISOString();
    set((state) => ({
      conversations: sortConversations(
        state.conversations.map((c) =>
          c.id === targetId
            ? {
                ...c,
                ttsHistory: [...(c.ttsHistory || []), audio],
                updatedAt: now,
              }
            : c
        )
      ),
    }));

    try {
      if (temporaryConversationIds.has(targetId)) return;
      const conversation = conversations.find((c) => c.id === targetId);
      if (conversation?.isTemporary) return;

      const res = await api.post(`/voice-sessions/${targetId}`, audio);

      set((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id === targetId) {
            const updatedHistory = (c.ttsHistory || []).map((a) =>
              a.id === audio.id ? { ...a, id: res.data.id } : a
            );
            return {
              ...c,
              ttsHistory: updatedHistory,
              isLocal: false,
              title: res.data.title || c.title,
            };
          }
          return c;
        }),
      }));
    } catch {
      // save failed
    }
  },

  deleteTTSAudio: async (audioId: string) => {
    const { currentConversationId } = get();
    if (!currentConversationId) return;
    const targetId = currentConversationId;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === targetId
          ? {
              ...c,
              ttsHistory: (c.ttsHistory || []).filter((a) => a.id !== audioId),
            }
          : c
      ),
    }));

    try {
      const res = await api.delete(`/voice-sessions/${targetId}/${audioId}`);
      if (res.data?.conversation_deleted) {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== targetId),
          currentConversationId:
            state.currentConversationId === targetId
              ? null
              : state.currentConversationId,
          currentMessages:
            state.currentConversationId === targetId
              ? []
              : state.currentMessages,
        }));
      }
    } catch {
      // delete failed
    }
  },

  // ---------- Update Title ----------
  updateConversationTitle: async (id: string, newTitle: string) => {
    const now = new Date().toISOString();
    set((state) => ({
      conversations: sortConversations(
        state.conversations.map((c) =>
          c.id === id ? { ...c, title: newTitle, updatedAt: now } : c
        )
      ),
    }));
    try {
      await api.patch(`/conversations/${id}/title`, { title: newTitle });
    } catch {
      // title update failed
    }
  },

  // ---------- Send Message (moved from App.tsx) ----------
  handleSendMessage: async (
    content: string,
    imageBase64?: string,
    imageName?: string,
    imageFile?: File
  ) => {
    const { currentConversationId, createConversation, conversations, currentMessages, fetchConversations, updateCurrentMessages } = get();
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    let messageContent: string | MessageContent[];
    let finalImageUrl = imageBase64;

    if (imageFile) {
      try {
        const formData = new FormData();
        formData.append("file", imageFile);

        const API_URL = import.meta.env.PROD
          ? "/functions/v1"
          : import.meta.env.VITE_API_URL ||
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const uploadRes = await fetch(`${API_URL}/upload-file`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: anonKey,
          },
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.url) finalImageUrl = data.url;
        }
      } catch {
        // error uploading image
      }
    }

    if (finalImageUrl) {
      const textWithFilename = imageName
        ? content
          ? `${imageName}\n${content}`
          : imageName
        : content || "Imagen adjunta";
      messageContent = [
        { type: "text" as const, text: textWithFilename },
        { type: "image_url" as const, image_url: { url: finalImageUrl! } },
      ];
    } else {
      messageContent = content;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    updateCurrentMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    updateCurrentMessages((prev) => [...prev, assistantMessage]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No session token");

      const isTemporary = conversations.find(
        (c) => c.id === conversationId
      )?.isTemporary;

      let messagesPayload;
      if (isTemporary) {
        messagesPayload = [...currentMessages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));
      } else {
        messagesPayload = [
          { role: userMessage.role, content: userMessage.content },
        ];
      }

      const API_URL = import.meta.env.PROD
        ? "/functions/v1"
        : import.meta.env.VITE_API_URL ||
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        `${API_URL}/messages/${conversationId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            messages: messagesPayload,
            is_temporary: !!isTemporary,
          }),
        }
      );

      if (!response.ok) throw new Error("Network response was not ok");

      void fetchConversations();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (!reader) throw new Error("No reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const content =
                parsed.choices?.[0]?.delta?.content || parsed.content;
              if (content) {
                assistantContent += content;
                updateCurrentMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
              if (parsed.tool_used) {
                updateCurrentMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolUsed: true }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch {
      updateCurrentMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: "Error sending message." }
            : m
        )
      );
    }
  },

  // ---------- TTS Generate (moved from App.tsx) ----------
  handleTTSGenerate: async (text: string) => {
    const { currentConversationId, createConversation, addTTSAudio } = get();
    const { toast } = await import("sonner");

    if (!text.trim()) {
      toast.warning("Por favor, escribe un texto para convertir a voz");
      return;
    }

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = createConversation();
    }

    const selectedVoiceId = "IKne3meq5aSn9XLyUdCD";

    try {
      const API_URL = import.meta.env.PROD
        ? "/functions/v1"
        : import.meta.env.VITE_API_URL ||
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!token) return;

      const response = await fetch(`${API_URL}/voice-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoiceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Error al generar el audio"
        );
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      const ttsAudio: TTSAudio = {
        id: crypto.randomUUID(),
        text: text.trim(),
        audioUrl: base64Audio,
        timestamp: Date.now(),
        voiceId: selectedVoiceId,
        voiceName: "Roger - Laid-Back, Casual, Resonant",
      };

      addTTSAudio(ttsAudio, conversationId);
      new Audio(audioUrl).play();
    } catch {
      // speech generation error
    }
  },
}));
