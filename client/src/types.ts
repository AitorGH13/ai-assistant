export interface ChatMessage {
  id: string;
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

export interface SearchRequest {
  query: string;
}

export interface SearchResponse {
  query: string;
  result: string;
  similarity: number;
  all_results: Array<{
    text: string;
    similarity: number;
  }>;
}

export type AppMode = "chat" | "search" | "tts" | "conversational";

export interface Voice {
  id: string;
  name: string;
  category: string;
  preview_url: string;
}

export interface SpeakRequest {
  text: string;
  voiceId: string;
}

export interface TTSAudio {
  id: string;
  text: string;
  audioUrl: string;
  timestamp: number;
  voiceId: string;
  voiceName: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  ttsHistory?: TTSAudio[];
}
