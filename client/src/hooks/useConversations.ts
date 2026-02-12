import { useState, useCallback, useEffect } from 'react';
import { Conversation, ChatMessage } from '../types';

const CONVERSATIONS_KEY = 'ai_conversations';

interface UseConversationsReturn {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: ChatMessage[];
  isLoading: boolean;
  createConversation: () => string;
  loadConversation: (id: string) => void;
  saveConversation: (id: string, messages: ChatMessage[]) => void;
  deleteConversation: (id: string) => void;
  updateCurrentMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [isLoading] = useState(false);

  // Load conversations from storage on mount
  useEffect(() => {
    loadConversationsFromStorage();
  }, []);

  // Persist conversations whenever they change
  useEffect(() => {
    persistConversations(conversations);
  }, [conversations]);

  const loadConversationsFromStorage = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(CONVERSATIONS_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      
      // Validate data structure
      if (Array.isArray(parsed)) {
        setConversations(parsed);
      } else {
        console.warn('Invalid conversations data structure');
        sessionStorage.removeItem(CONVERSATIONS_KEY);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      sessionStorage.removeItem(CONVERSATIONS_KEY);
    }
  }, []);

  const persistConversations = useCallback((convs: Conversation[]) => {
    try {
      if (convs.length > 0) {
        sessionStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
      } else {
        sessionStorage.removeItem(CONVERSATIONS_KEY);
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

  return {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading,
    createConversation,
    loadConversation,
    saveConversation,
    deleteConversation,
    updateCurrentMessages,
  };
}