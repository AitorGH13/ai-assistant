# 🚀 Proposed Optimizations

> This file documents **potential improvements** identified during the DevSecOps audit. None of these are implemented — they are proposals for future consideration.

---

## 🏗️ Architecture

| Area                           | Proposal                                                                                                                                                | Impact                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Edge Functions granularity** | Split the monolithic `chat/index.ts` (640+ lines) into separate functions: `conversations`, `messages`, `tts-sessions`. Each with its own `Deno.serve`. | Smaller cold-starts, easier to deploy/debug independently |
| **API Gateway pattern**        | Add a lightweight API-gateway function that routes to sub-functions instead of URL-pattern matching inside each function.                               | Cleaner separation of concerns                            |
| **State management**           | Replace `useState` + prop-drilling in `App.tsx` (900+ lines) with a proper state manager (Zustand, Jotai) or `useReducer`.                              | Reduce re-renders, simplify `App.tsx`                     |
| **CORS per-origin**            | Replace `Access-Control-Allow-Origin: '*'` with a dynamic allowlist (`ALLOWED_ORIGINS` env variable).                                                   | Restrict API access to deployed domains only              |

---

## ⚡ Performance

| Area                     | Proposal                                                                                                                       | Impact                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **React re-renders**     | Memoize heavy components (`AudioList`, `ChatMessage`, `Sidebar`) with `React.memo`. Memoize event handlers with `useCallback`. | Fewer re-renders on message arrival |
| **Signed URL caching**   | Cache signed URLs in `SecureAsset` and `AudioList` in a Map/context so they aren't re-fetched on every render cycle.           | Fewer Supabase Storage API calls    |
| **Embedding batch init** | Move the "fix NULL embeddings" logic from the hot-path (`chat`, `search`) to a scheduled cron function.                        | Faster first response times         |
| **TTS audio streaming**  | Stream ElevenLabs audio directly to the client instead of buffering the full array buffer server-side.                         | Lower TTFB for TTS generation       |
| **Bundle splitting**     | Lazy-load heavy components (`ConversationalAI`, `SemanticSearch`, `MarkdownMessage`) with `React.lazy`.                        | Smaller initial bundle size         |
| **Database indexing**    | Ensure indexes on `conversations.user_id`, `voice_sessions.user_id`, `voice_sessions.conversation_id`.                         | Faster queries on large datasets    |

---

## 🎨 UI / UX

| Area                   | Proposal                                                                            | Impact                                  |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| **Error toasts**       | Replace `alert()` calls with a toast notification system (e.g., `react-hot-toast`). | Non-blocking, professional UX           |
| **Loading skeletons**  | Add skeleton components for conversation list and chat history loading states.      | Better perceived performance            |
| **Offline support**    | Add a service worker with basic offline caching.                                    | App remains usable during network blips |
| **Keyboard shortcuts** | Add shortcuts for common actions (new chat, toggle sidebar, toggle theme).          | Power-user efficiency                   |
| **Accessibility**      | Add ARIA labels to dynamic content, ensure focus management on mode switches.       | Better screen-reader support            |

---

## 🔒 Security (Hardening)

| Area                        | Proposal                                                                       | Impact                       |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| **Rate limiting**           | Add rate limiting to Edge Functions (via Supabase's built-in or a middleware). | Prevent abuse                |
| **Content Security Policy** | Add CSP headers to the frontend build.                                         | XSS protection               |
| **Input sanitisation**      | Sanitise user-provided text before embedding in OpenAI prompts.                | Reduce prompt injection risk |
| **Audit logging**           | Log authentication failures and critical operations to a `audit_log` table.    | Forensic capability          |
