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

export type AppMode = "chat" | "search";

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
