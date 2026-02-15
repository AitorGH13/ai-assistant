# AI Assistant

A modern, professional ChatGPT-lite clone with a beautiful UI, built with Python FastAPI backend and React frontend.

## 🌟 Advanced Features

### Four Powerful Modes

1. **💬 Chat Mode** - AI conversation with function calling capabilities
   - Agentic tool execution (e.g., getCurrentWeather)
   - Visual indicators when tools are used
   - Streaming responses

2. **🖼️ Vision Mode** - Multimodal image analysis
   - Upload and analyze images
   - Ask questions about visual content
   - Powered by GPT-4o-mini vision capabilities

3. **🔍 Search Mode** - Semantic search with embeddings
   - Basic RAG (Retrieval-Augmented Generation)
   - In-memory knowledge base
   - Cosine similarity matching
   - Top-3 relevant results

4. **🎙️ Voice AI Mode** - Text-to-Speech and Conversational AI (NEW!)
   - **Text-to-Speech**: Convert text to natural-sounding speech with multiple voice options
   - **Conversational AI**: Interactive voice conversations with AI agents
   - Powered by ElevenLabs API
   - Streaming audio playback

👉 **See [FEATURES.md](FEATURES.md) for detailed documentation**

## Features

- 🚀 **Streaming responses** - See AI responses in real-time as they're generated
- 🤖 **Function Calling** - AI can call tools for real-time information
- 📸 **Vision Analysis** - Upload images and ask questions about them
- 🔎 **Semantic Search** - Find relevant information using embeddings
- 🎙️ **Voice AI** - Text-to-speech and conversational AI with ElevenLabs
- 🎨 **Modern UI** - Professional minimalist design with light/dark themes
- 📱 **Fully Responsive** - Optimized for mobile, tablet, and desktop
- 🌓 **Dark/Light Mode** - Toggle between themes with persistent preference
- 📝 **Markdown Support** - Rich text rendering with syntax-highlighted code blocks
- 💬 **Message Timestamps** - Track conversation timeline
- 📋 **Copy Code Blocks** - One-click copy for code snippets
- 👤 **User Avatars** - Visual distinction between user and AI messages
- ⚙️ **Custom System Prompts** - Configure the AI's behavior/personality
- 🔒 **Secure** - API keys stay on the server, never exposed to the client
- ✨ **Quick Suggestions** - Empty state with example prompts to get started

## Tech Stack

- **Backend**:
  - Python + FastAPI + Uvicorn + NumPy (Main API server)
  - Bun + TypeScript (Voice AI server)
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Package Manager**: Bun (for frontend and voice server) / pip (for backend)
- **AI**:
  - OpenAI API (gpt-4o-mini for chat/vision, text-embedding-3-small for search)
  - ElevenLabs API (voice synthesis and conversational AI)
- **UI Components**: Custom component library with lucide-react icons
- **Markdown**: react-markdown with syntax highlighting
- **Font**: Inter font family

## Getting Started

### Prerequisites

- [Python 3.8+](https://www.python.org/downloads/)
- [Bun](https://bun.sh/) installed (for frontend and voice server)
- OpenAI API key
- ElevenLabs API key (optional, for Voice AI features)

### Installation

1. Clone the repository

2. Install dependencies:

   ```bash
   # Install all dependencies at once
   bun run install:all

   # Or install individually:
   # Frontend dependencies
   cd client && bun install

   # Backend dependencies
   cd ../server && pip install -r requirements.txt

   # Voice server dependencies
   cd ../server && bun install
   ```

3. Create a `.env` file in the root directory:

   ```bash
   cp .env.example .env
   ```

4. Add your API keys to the `.env` file:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
   ELEVENLABS_AGENT_ID=your-agent-id-here  # Optional, for conversational AI
   ```

### Development

Run all servers concurrently from the root:

```bash
bun run dev
```

This will start:

- Python FastAPI backend server on `http://localhost:3001`
- Bun Voice AI server on `http://localhost:3002`
- Vite frontend dev server on `http://localhost:5173`

### Individual Commands

```bash
# Run only the backend (from root)
bun run dev:server

# Run only the frontend (from root)
bun run dev:client

# Or run them separately:
# Backend (from server/ directory)
cd server && python -m uvicorn main:app --reload --port 3001

# Frontend (from client/ directory)
cd client && bun run dev

# Build frontend for production
cd client && bun run build
```

## Project Structure

```
ai-assistant/
├── client/                 # Vite + React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ui/       # Reusable UI components (Avatar, Button, etc.)
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ModeSelector.tsx     # Tab selector with Voice AI
│   │   │   ├── SemanticSearch.tsx   # Search interface
│   │   │   ├── VoiceTab.tsx         # NEW: Voice AI interface
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── MarkdownMessage.tsx
│   │   ├── utils/        # Utility functions (theme management)
│   │   ├── App.tsx       # Main app component
│   │   ├── main.tsx      # Entry point
│   │   └── types.ts      # TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── server/                 # Backend servers
│   ├── main.py            # Python FastAPI server with API endpoints
│   ├── index.ts           # NEW: Bun TypeScript server for Voice AI
│   ├── tsconfig.json      # NEW: TypeScript configuration
│   ├── requirements.txt   # Python dependencies
│   └── package.json       # Node/Bun dependencies and scripts
├── .env.example
├── .gitignore
├── cleanup-ports.ps1      # Windows script to cleanup ports
├── FEATURES.md            # Detailed feature documentation
├── package.json           # Root scripts
└── README.md
```

## API

### POST /api/chat

Send messages to the AI and receive streaming responses. Supports function calling and vision analysis.

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "systemPrompt": "You are a helpful assistant.", // optional
  "mode": "function" // optional: "function" | "vision" | "chat"
}
```

**For Vision (multimodal):**

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "What's in this image?" },
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,..." }
        }
      ]
    }
  ],
  "mode": "vision"
}
```

**Response:** Server-Sent Events stream with chunks in format:

```
data: {"content":"Hello"}

data: {"content":" there!"}

data: {"tool_calling": true}  // when function is called

data: [DONE]
```

### POST /api/search

Semantic search using embeddings.

**Request Body:**

```json
{
  "query": "What is the secret code?"
}
```

**Response:**

```json
{
  "query": "What is the secret code?",
  "result": "The secret code is 1234.",
  "similarity": 0.89,
  "all_results": [
    { "text": "The secret code is 1234.", "similarity": 0.89 },
    { "text": "...", "similarity": 0.72 },
    { "text": "...", "similarity": 0.65 }
  ]
}
```

### Voice AI Endpoints (Port 3002)

#### GET /api/voices

Fetch available ElevenLabs voices.

**Response:**

```json
[
  {
    "id": "voice-id-1",
    "name": "Rachel",
    "category": "premade",
    "preview_url": "https://..."
  },
  ...
]
```

#### POST /api/speak

Convert text to speech with streaming audio.

**Request Body:**

```json
{
  "text": "Hello, this is a test message.",
  "voiceId": "voice-id-1"
}
```

**Response:** Audio stream (audio/mpeg)

#### GET /api/conversation-signature

Get configuration for conversational AI agents.

**Response:**

```json
{
  "agentId": "your-agent-id"
}
```

### GET /

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "message": "AI Assistant API"
}
```

## Development Notes

- The backend uses **FastAPI** with **Uvicorn** ASGI server
- Streaming is handled via `StreamingResponse` with SSE (Server-Sent Events)
- CORS is configured to allow requests from `http://localhost:5173`
- Environment variables are loaded from the root `.env` file
- The frontend proxies API requests to the backend via Vite's proxy configuration

## Supabase Migration Plan

📖 **Ver [supabase/DATABASE.md](supabase/DATABASE.md) para documentación completa de la base de datos**

### Quick Setup

1. Create a Supabase project and copy `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` into `client/.env`.
2. Run the SQL in `supabase/schema.sql` from Supabase SQL Editor.
   - **Nota:** La tabla `auth.users` es gestionada automáticamente por Supabase
   - Solo necesitas ejecutar el schema para crear `profiles`, `conversations`, `messages`, `tts_audios`
3. Enable Email/Password auth in Supabase Authentication settings.
4. Start app and verify auth flow in `client/src/components/AuthScreen.tsx` (sign up / login).
5. Verify protected app shell in `client/src/App.tsx` (unauthenticated users only see auth screen).
6. Verify profile/logout view in `client/src/components/ProfileView.tsx`.
7. Confirm persistence in `client/src/hooks/useConversations.ts`:

- conversations and messages load from Supabase on login
- user and assistant messages persist when sent/streamed
- TTS/conversational audio entries persist in `tts_audios`

8. Validate RLS by logging in with two users and confirming each can only read/write their own rows.

### 🔐 About Authentication

- **`auth.users`** (email, password, etc.) is **managed automatically by Supabase**
- **`public.profiles`** is synced automatically via trigger when users sign up
- Passwords are encrypted by Supabase - never accessible directly
- RLS policies ensure users only access their own data

## License

MIT
