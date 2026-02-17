export type AppMode = "chat" | "search" | "tts" | "conversational";

export interface ChatMessage {
  id: string | number; 
  role: "user" | "assistant";
  content: string | MessageContent[];
  timestamp: string;
  toolUsed?: boolean;
}

export interface MessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string | MessageContent[] }[];
  systemPrompt?: string;
  mode?: "chat" | "function";
}

// Backend Response Structure
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[]; 
  createdAt: string; // Changed to camelCase to match hook mapping and usage
  updatedAt: string; // Changed to camelCase to match hook mapping and usage
  ttsHistory?: TTSAudio[];
  isTemporary?: boolean;
  isLocal?: boolean; // True if created client-side but not yet persisted (no messages)
}

export interface TTSAudio {
  id: string;
  text: string;
  audioUrl: string;
  timestamp: number;
  voiceId: string;
  voiceName: string;
  transcript?: {
    id?: any;
    role: string;
    msg: string;
    date?: string;
  }[];
}

// Raw DB Types (for mapping)
export interface DBMessage {
    id: number; // 0 or 1
    role?: "user" | "assistant"; // Optional in DB JSON
    msg: string;
    date: string;
}

export interface SearchRequest {
  query: string;
  k?: number;
}

export interface SearchResponse {
  result: string;
  similarity: number;
  all_results: {
      text: string;
      similarity: number;
  }[];
}

export interface SearchResult {
  id: string;
  text: string;
  metadata: {
    conversation_id: string;
    role: string;
    date: string;
  };
  score: number;
}

export interface Voice {
  id: string; // Used by frontend
  voice_id: string; // backend consistency? or just map?
  name: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface SpeakRequest {
  text: string;
  voiceId: string;
}
