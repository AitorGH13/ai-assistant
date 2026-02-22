# 🤖 AI Assistant

A full-stack AI assistant combining **ChatGPT-style conversations**, **semantic search**, **text-to-speech**, and **real-time voice AI** — all powered by Supabase, React, and Deno Edge Functions.

---

## ✨ Key Features

| Mode                     | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| 💬 **Chat**              | Streaming GPT-4o-mini conversations with image upload and tool calling |
| 🔍 **Semantic Search**   | RAG-powered knowledge-base search via OpenAI embeddings                |
| 🔊 **Text-to-Speech**    | Generate and save audio from text using ElevenLabs voices              |
| 🎙️ **Conversational AI** | Real-time voice conversations with an ElevenLabs AI agent              |

**Additional highlights:** dark/light theme, temporary (unsaved) chats, markdown rendering with syntax highlighting, per-user Supabase Storage with signed URLs, RLS-secured data, fully responsive UI.

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────┐
│       React + Vite          │   TypeScript, Tailwind CSS, Axios
│       (client/)             │   @elevenlabs/react, react-markdown
└────────────┬────────────────┘
             │  HTTPS
┌────────────▼────────────────┐
│   Supabase Edge Functions   │   Deno runtime (supabase/functions/)
│   ┌──────────────────────┐  │
│   │ conversations  search    │  │   OpenAI API  (GPT-4o-mini, embeddings)
│   │ messages     upload-file │  │   ElevenLabs API (TTS, Conversational AI)
│   │ voice-sessions           │  │
│   │ voice-tts                │  │
│   │ voice-signature          │  │
│   │ voice-webhook            │  │
│   └──────────────────────────┘  │
└────────────┬────────────────┘
             │  PostgreSQL + Storage
┌────────────▼────────────────┐
│       Supabase              │   Auth, Database (RLS), Storage (private)
└─────────────────────────────┘
```

---

## 📋 Prerequisites

| Tool                                                 | Version | Purpose                               |
| ---------------------------------------------------- | ------- | ------------------------------------- |
| [Bun](https://bun.sh/)                               | ≥ 1.0   | Package manager & script runner       |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | ≥ 1.100 | Local dev & Edge Function deployment  |
| [Node.js](https://nodejs.org/)                       | ≥ 24    | Vite dev server (Bun delegates to it) |

You will also need accounts for:

- **Supabase** — database, auth, storage, Edge Functions
- **OpenAI** — GPT-4o-mini chat and `text-embedding-3-small` embeddings
- **ElevenLabs** _(optional)_ — TTS voices and conversational AI agent

---

## 🔑 Environment Variables

### Frontend (`client/.env`)

```env
VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://YOUR_PROJECT_ID.supabase.co/functions/v1
```

### Supabase Secrets (Edge Functions)

Set these via `supabase secrets set` or from the Supabase dashboard:

```env
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...            # optional
ELEVENLABS_AGENT_ID=...           # optional, for Conversational AI
```

> The `SUPABASE_URL` and `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside Edge Functions.

---

## 🚀 Local Development Setup

### 1. Clone & install

```bash
git clone https://github.com/AitorGH13/ai-assistant.git
cd ai-assistant
bun install:all
```

### 2. Start Supabase locally

```bash
supabase start          # starts local Supabase (Postgres, Auth, Storage, Edge Functions)
supabase db reset       # applies supabase/schema.sql migrations
```

### 3. Configure environment

```bash
cp client/.env.example client/.env
# Fill in the values printed by `supabase start` (API URL, anon key)
```

### 4. Run the frontend

```bash
cd client
bun run dev             # Vite dev server → http://localhost:5173
```

### 5. Serve Edge Functions locally

```bash
supabase functions serve --env-file supabase/.env.local
```

---

## 🌐 Deployment Guide

### Deploy Edge Functions

```bash
# Deploy all functions at once
bunx supabase functions deploy --no-verify-jwt
```

### Set production secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ELEVENLABS_API_KEY=...
supabase secrets set ELEVENLABS_AGENT_ID=...
```

### Configure ElevenLabs Webhook

In the [ElevenLabs dashboard](https://elevenlabs.io/), set the **Webhook URL** for your Conversational AI agent to:

```
https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/voice-webhook
```

### Build & deploy frontend

```bash
cd client
bun run build           # outputs to client/dist/
```

Deploy `client/dist/` to your hosting provider (Vercel, Netlify, Supabase Hosting, etc.).

---

## 📁 Project Structure

```
ai-assistant/
├── client/                          # React + Vite frontend
│   └── src/
│       ├── components/              # UI and feature components
│       │   ├── ui/                  # Reusable primitives (Button, Card, etc.)
│       │   ├── ChatMessage.tsx      # Chat bubble with markdown
│       │   ├── ChatInput.tsx        # Multi-mode input bar
│       │   ├── ConversationalAI.tsx # Real-time voice AI
│       │   ├── SemanticSearch.tsx   # Embedding-powered search UI
│       │   ├── AudioList.tsx        # TTS / voice session player
│       │   ├── SecureAsset.tsx      # Signed-URL asset loader
│       │   ├── Sidebar.tsx          # Conversation history
│       │   └── ...
│       ├── stores/                  # Zustand state (appStore, conversationStore)
│       ├── context/                 # AuthProvider (Supabase Auth)
│       ├── lib/                     # supabase client, api-url, auth-headers
│       ├── services/                # Axios API client with auth interceptor
│       └── App.tsx                  # Root application shell
├── supabase/
│   ├── functions/                   # Deno Edge Functions
│   │   ├── _shared/                 # Shared modules (CORS, client, constants, auth, rateLimit)
│   │   ├── conversations/           # GET/DELETE/PATCH conversations
│   │   ├── messages/                # POST new messages + OpenAI streaming
│   │   ├── voice-sessions/          # TTS Audio DB sync and deletion
│   │   ├── search/                  # Semantic search with embeddings
│   │   ├── upload-file/             # Supabase Storage image upload
│   │   ├── voice-tts/               # ElevenLabs text-to-speech
│   │   ├── voice-signature/         # ElevenLabs signed URL for agent
│   │   └── voice-webhook/           # ElevenLabs webhook processor
│   ├── migrations/                  # Rate limits and DB schema upgrades
│   └── schema.sql                   # Database schema & RLS policies
├── PROPOSED_OPTIMIZATIONS.md        # Future improvement proposals
└── README.md
```

---

## 📄 License

MIT
