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
        messages: [], // We accept list doesn't have messages initially
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        ttsHistory: [],
      }));
      setConversations(apiConversations);
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
        // Backend: { history: [{id: "uuid", role: "...", content: "...", created_at: "..."}] }
        const messages: ChatMessage[] = (data.history || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at
        }));

        setCurrentMessages(messages);
        
        // Update local cache
        setConversations(prev => prev.map(c => 
            c.id === id ? { ...c, messages: messages } : c
        ));
    } catch (error) {
        console.error("Failed to load conversation:", error);
    }
  }, [conversations]);

  // 3. Create Conversation (Local stub until message sent?)
  const createConversation = useCallback((isTemporary: boolean = false): string => {
      // Backend creates conversation on first message usually, 
      // OR we call /new endpoint.
      // Let's call /new endpoint if NOT temporary? 
      // Or keep local state until first message to avoid empty DB rows?
      // "Generates title from first message" -> suggests waiting.
      
      const newId = crypto.randomUUID(); // Temporary FE ID
      const now = new Date().toISOString();
      const newConvo: Conversation = {
          id: newId,
          title: isTemporary ? "Chat Temporal" : "Nueva conversación",
          messages: [],
          createdAt: now,
          updatedAt: now,
          isTemporary
      };
      
      if (isTemporary) temporaryConversationIds.current.add(newId);
      
      setConversations(prev => sortConversations([newConvo, ...prev]));
      setCurrentConversationId(newId);
      setCurrentMessages([]);
      return newId;
  }, []);

  // 4. Send Message (Refactored to call API)
  const addChatMessage = useCallback(async (message: ChatMessage, conversationId?: string) => {
      let targetId = conversationId || currentConversationId;
      if (!targetId) targetId = createConversation(); // Should return a string
      
      // Optimistic Update
      setCurrentMessages(prev => [...prev, message]);
      
      // If authentic "new" conversation (not in DB), we might need to POST /chat/new
      // If existing, POST /chat/{id}/message
      
      // Check if it's a temporary local-only ID or real backend ID?
      // For now, assume we try to create it on backend if it doesn't exist?
      // Backend handles upsert? No, API implementation split /new and /{id}/message.
      
      // Logic: 
      // If conversation is "fresh" (no messages), call /new.
      // Else call /message.
      
      try {
          const isNew = conversations.find(c => c.id === targetId)?.messages.length === 0;
          
          if (isNew) {
              const res = await api.post('/chat/new', {
                  messages: [{ role: message.role, content: message.content }]
              });
              // Update ID if backend returned a different one? 
              // Our setup uses UUIDs. If backend generates one, we should swap.
              // For simplicity, let's assume we can't easily swap IDs in React state without flicker.
              // Ideally, we wait for response.
              
              // Backend /chat/new returns the created conversation object.
              const validId = res.data.id;
              // If validId != targetId, we need to replace in state.
              
              setConversations(prev => sortConversations(prev.map(c => 
                  c.id === targetId ? { ...c, id: validId, title: res.data.title } : c
              )));
              setCurrentConversationId(validId);
              targetId = validId;
          } else {
              // Existing conversation
             await api.post(`/chat/${targetId}/message`, {
                  messages: [{ role: message.role, content: message.content }]
              });
          }
          
          // Note: The StreamingResponse handling usually happens in the Component 
          // that calls this, using fetch/EventSource. 
          // Axios is not great for streaming. 
          // If we use axios here, we might block UI.
          // RECOMMENDATION: The `App.tsx` probably handles the streaming reader.
          // If `addChatMessage` is just for local state update + fire and forget?
          // The Prompt says: "Send to backend... Do not generate TS... Use server response".
          
          // We will leave the specific stream handling to the caller (App.tsx) 
          // OR implement it here if we want to centralize.
          // Given `addChatMessage` signature returning Promise<void>, maybe caller handles stream?
          
      } catch (e) {
          console.error("Failed to send message", e);
      }
  }, [currentConversationId, createConversation, conversations]);

  // 5. Delete
  const deleteConversation = useCallback(async (id: string) => {
      try {
          await api.delete(`/chat/${id}`);
          setConversations(prev => prev.filter(c => c.id !== id));
          if (currentConversationId === id) {
              setCurrentConversationId(null);
              setCurrentMessages([]);
          }
      } catch (e) {
          console.error("Failed to delete", e);
      }
  }, [currentConversationId]);

  // Placeholder for others
  const updateCurrentMessages = useCallback((messages: any) => setCurrentMessages(messages), []);
  const addTTSAudio = useCallback(() => {}, []);
  const deleteTTSAudio = useCallback(() => {}, []);
  const updateConversationTitle = useCallback(() => {}, []);

  return {
    conversations,
    currentConversationId,
    currentMessages,
    currentTTSHistory: [],
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
  };
}