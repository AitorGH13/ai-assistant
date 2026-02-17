import { useState, useEffect, useCallback, useRef } from "react";
import { Conversation, ChatMessage, TTSAudio } from "../types";
import api from "../services/api"; // Centralized API client
import { useAuth } from "../context/AuthProvider";

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

export function useConversations(): {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: ChatMessage[];
  currentTTSHistory: TTSAudio[];
  isLoading: boolean;
  isInitialized: boolean;
  createConversation: (isTemporary?: boolean) => string;
  loadConversation: (id: string) => void;
  // saveConversation: No longer needed publically? Or maybe just internal? 
  // Refactor: We send message immediately.
  deleteConversation: (id: string) => void;
  updateCurrentMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  addChatMessage: (message: ChatMessage, conversationId?: string) => Promise<void>;
  addTTSAudio: (audio: TTSAudio, conversationId?: string) => void; // TODO: Implement Voice API
  deleteTTSAudio: (audioId: string) => void;
  updateConversationTitle: (id: string, newTitle: string) => void; // TODO: API endpoint?
  fetchConversations: () => Promise<void>;
} {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const temporaryConversationIds = useRef<Set<string>>(new Set());

  // 1. Fetch Conversations (List)
  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setIsInitialized(true);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get('/chat/');
      const apiConversations = response.data.map((c: any) => ({
        id: c.id,
        title: c.title,
        messages: [], 
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        ttsHistory: c.tts_history || [], // Map backend snake_case to frontend camelCase
      }));
      setConversations(prev => {
        // Keep local/temporary conversations that are NOT in the API validation list
        // (Actually temporary ones are never in API, local drafts might be if we just saved them? 
        //  No, if we just saved a draft it becomes remote. But here we talk about PURELY local/temporary ones that backend doesn't know about)
        const localConversations = prev.filter(c => c.isLocal && !apiConversations.some((apiC: any) => apiC.id === c.id));
        
        return sortConversations([...apiConversations, ...localConversations]);
      });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [user]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // 2. Load Conversation (Details)
  const loadConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    
    // Optimistic / Cache check
    const local = conversations.find(c => c.id === id);
    if (local && local.messages.length > 0) {
      setCurrentMessages(local.messages);
    }

    try {
        const response = await api.get(`/chat/${id}`);
        const data = response.data;
        
        // Map backend history (Clean Message objects) to ChatMessage[]
        const messages: ChatMessage[] = (data.history || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at
        }));

        setCurrentMessages(messages);
        
        const ttsHistory = data.ttsHistory || [];
        
        // Update local cache with BOTH messages and TTS history
        setConversations(prev => prev.map(c => 
            c.id === id ? { ...c, messages: messages, ttsHistory: ttsHistory } : c
        ));
    } catch (error) {
        console.error("Failed to load conversation:", error);
    }
  }, [conversations]);

  // 3. Create Conversation (Local stub until message sent?)
  const createConversation = useCallback((isTemporary: boolean = false): string => {
      // If we are already in an empty local conversation of the same type, just reuse it
      const current = conversations.find(c => c.id === currentConversationId);
      const isEmpty = !current?.messages?.length && !current?.ttsHistory?.length;
      if (current && current.isLocal && isEmpty && !!current.isTemporary === isTemporary) {
          return current.id;
      }

      const newId = crypto.randomUUID(); // Temporary FE ID
      const now = new Date().toISOString();
      const newConvo: Conversation = {
          id: newId,
          title: isTemporary ? "Chat Temporal" : "Nueva conversación",
          messages: [],
          createdAt: now,
          updatedAt: now,
          isTemporary,
          isLocal: true // Mark as draft
      };
      
      if (isTemporary) temporaryConversationIds.current.add(newId);
      
      setConversations(prev => sortConversations([newConvo, ...prev]));
      setCurrentConversationId(newId);
      setCurrentMessages([]);
      return newId;
  }, [conversations, currentConversationId]);

  // 4. Send Message (Refactored to call API)
  const addChatMessage = useCallback(async (message: ChatMessage, conversationId?: string) => {
      let targetId = conversationId || currentConversationId;
      if (!targetId) targetId = createConversation(); // Should return a string
      
      // Optimistic Update
      setCurrentMessages(prev => [...prev, message]);
      
      try {
          const conversation = conversations.find(c => c.id === targetId);
          const isLocal = conversation?.isLocal ?? false;
          
          const now = new Date().toISOString();
          if (isLocal) {
              const res = await api.post('/chat/new', {
                  messages: [{ role: message.role, content: message.content }]
              });
              
              const validId = res.data.id;
              
              setConversations(prev => sortConversations(prev.map(c => 
                  c.id === targetId ? { ...c, id: validId, title: res.data.title, isLocal: false, updatedAt: now } : c
              )));
              setCurrentConversationId(validId);
              targetId = validId;
          } else {
              // Existing conversation
              setConversations(prev => sortConversations(prev.map(c => 
                c.id === targetId ? { ...c, updatedAt: now } : c
              )));
              await api.post(`/chat/${targetId}/message`, {
                  messages: [{ role: message.role, content: message.content }]
              });
          }
          
          void fetchConversations();

      } catch (e) {
          console.error("Failed to send message", e);
      }
  }, [currentConversationId, createConversation, conversations, fetchConversations]);

  // 5. Delete
  const deleteConversation = useCallback(async (id: string) => {
      try {
          await api.delete(`/chat/${id}`);
          setConversations(prev => prev.filter(c => c.id !== id));
          setCurrentConversationId(prev => prev === id ? null : prev);
          setCurrentMessages(prev => {
              // Only clear if the current messages actually belong to the deleted conversation
              // (This is a bit tricky since we don't store the ID in the messages array, 
              // but currentConversationId should be enough)
              return (currentConversationId === id) ? [] : prev;
          });
      } catch (e) {
          console.error("Failed to delete", e);
      }
  }, [currentConversationId]);

  // 6. TTS History Management
  const addTTSAudio = useCallback(async (audio: TTSAudio, conversationId?: string) => {
      const targetId = conversationId || currentConversationId;
      if (!targetId) return;

      const now = new Date().toISOString();
      // Optimistic Update
      setConversations(prev => {
          const updated = prev.map(c => {
              if (c.id === targetId) {
                  const newHistory = [...(c.ttsHistory || []), audio];
                  // We don't verify verified state here immediately, but api call will confirm.
                  return { ...c, ttsHistory: newHistory, updatedAt: now };
              }
              return c;
          });
          return sortConversations(updated);
      });

      try {
          const conversation = conversations.find(c => c.id === targetId);
          if (conversation?.isTemporary) {
              // For temporary conversations, we do not save TTS history to the backend.
              // We just keep the optimistic update in local state.
              return;
          }

          const res = await api.post(`/chat/${targetId}/tts`, audio);
          
          // If successful, mark as not local (synced) and update title if provided
          setConversations(prev => prev.map(c => 
               c.id === targetId ? { 
                   ...c, 
                   isLocal: false, 
                   title: res.data.title || c.title 
               } : c
          ));
          
      } catch (e) {
          console.error("Failed to save TTS audio", e);
      }
  }, [currentConversationId]);

  const deleteTTSAudio = useCallback(async (audioId: string) => {
      if (!currentConversationId) return;

      // Optimistic Update
      setConversations(prev => prev.map(c => {
          if (c.id === currentConversationId) {
              const newHistory = (c.ttsHistory || []).filter(a => a.id !== audioId);
              return { ...c, ttsHistory: newHistory };
          }
          return c;
      }));

      try {
          await api.delete(`/chat/${currentConversationId}/tts/${audioId}`);
      } catch (e) {
          console.error("Failed to delete TTS audio", e);
          // Optional: Re-fetch or revert on error
      }
  }, [currentConversationId]);

  const updateCurrentMessages = useCallback((messages: any) => setCurrentMessages(messages), []);

  const updateConversationTitle = useCallback(async (id: string, newTitle: string) => {
      try {
          const now = new Date().toISOString();
          // Optimistic update
          setConversations(prev => {
              const updated = prev.map(c => 
                  c.id === id ? { ...c, title: newTitle, updatedAt: now } : c
              );
              return sortConversations(updated);
          });
          
          await api.patch(`/chat/${id}/title`, { title: newTitle });
      } catch (e) {
          console.error("Failed to update title", e);
      }
  }, []);

  // Derived state for currentTTSHistory
  const currentTTSHistory = conversations.find(c => c.id === currentConversationId)?.ttsHistory || [];

  return {
    conversations,
    currentConversationId,
    currentMessages,
    currentTTSHistory,
    isLoading,
    isInitialized,
    createConversation,
    loadConversation,
    deleteConversation,
    updateCurrentMessages,
    addChatMessage,
    addTTSAudio,
    deleteTTSAudio,
    updateConversationTitle,
    fetchConversations
  };
}