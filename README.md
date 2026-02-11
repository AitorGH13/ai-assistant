# AI Assistant

A modern, professional ChatGPT-lite clone with a beautiful UI, built with Python FastAPI backend and React frontend.

## 🌟 Advanced Features

### Three Powerful Modes

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

👉 **See [FEATURES.md](FEATURES.md) for detailed documentation**

## Features

- 🚀 **Streaming responses** - See AI responses in real-time as they're generated
- 🤖 **Function Calling** - AI can call tools for real-time information
- 📸 **Vision Analysis** - Upload images and ask questions about them
- 🔎 **Semantic Search** - Find relevant information using embeddings
- 🎨 **Modern UI** - Professional minimalist design with light/dark themes
- 📱 **Fully Responsive** - Optimized for mobile, tablet, and desktop
- 🌓 **Dark/Light Mode** - Toggle between themes with persistent preference
- 📝 **Markdown Support** - Rich text rendering with syntax-highlighted code blocks
- 💬 **Message Timestamps** - Track conversation timeline
- 📋 **Copy Code Blocks** - One-click copy for code snippets
- 👤 **User Avatars** - Visual distinction between user and AI messages
- ⚙️ **Custom System Prompts** - Configure the AI's behavior/personality
- 🔒 **Secure** - API key stays on the server, never exposed to the client
- ✨ **Quick Suggestions** - Empty state with example prompts to get started

## Tech Stack

- **Backend**: Python + FastAPI + Uvicorn + NumPy
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Package Manager**: Bun (for frontend) / pip (for backend)
- **AI**: OpenAI API (gpt-4o-mini for chat/vision, text-embedding-3-small for search)
- **UI Components**: Custom component library with lucide-react icons
- **Markdown**: react-markdown with syntax highlighting
- **Font**: Inter font family

## Getting Started

### Prerequisites

- [Python 3.8+](https://www.python.org/downloads/)
- [Bun](https://bun.sh/) installed (for frontend)
- OpenAI API key

### Installation

1. Clone the repository

2. Install dependencies:
   ```bash
   # Install frontend dependencies
   cd client && bun install
   
   # Install backend dependencies
   cd ../server && pip install -r requirements.txt
   ```

3. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

4. Add your OpenAI API key to the `.env` file:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

### Development

Run both the server and client concurrently from the root:

```bash
bun run dev
```

This will start:
- Python FastAPI backend server on `http://localhost:3001`
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
│   │   │   ├── ModeSelector.tsx     # NEW: Tab selector
│   │   │   ├── SemanticSearch.tsx   # NEW: Search interface
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
├── server/                 # Python FastAPI backend
│   ├── main.py            # FastAPI server with API endpoints
│   ├── requirements.txt   # Python dependencies
│   └── package.json       # NPM scripts for convenience
├── .env.example
├── .gitignore
├── cleanup-ports.ps1      # Windows script to cleanup ports
├── FEATURES.md            # NEW: Detailed feature documentation
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
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." }}
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

## License

MIT
