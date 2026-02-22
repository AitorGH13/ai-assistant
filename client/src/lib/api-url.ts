/**
 * Returns the resolved API base URL for Supabase Edge Functions.
 * Centralises the repeated pattern used across ConversationalAI, SemanticSearch, and App.
 */
export function getApiUrl(): string {
  if (import.meta.env.PROD) {
    return '/functions/v1';
  }
  return import.meta.env.VITE_API_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
}
