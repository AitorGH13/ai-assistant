# AI Assistant

A ChatGPT-lite clone built with Bun, Vite, React, TypeScript, and Tailwind CSS.

## Features

- 🚀 **Streaming responses** - See AI responses in real-time as they're generated
- 🎨 **Clean Chat UI** - User and AI message bubbles with smooth scrolling
- ⚙️ **Custom System Prompts** - Configure the AI's behavior/personality
- 🔒 **Secure** - API key stays on the server, never exposed to the client

## Tech Stack

- **Runtime/Package Manager**: Bun
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Bun HTTP server (Bun.serve)
- **AI**: OpenAI API (gpt-4o-mini)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- OpenAI API key

### Installation

1. Clone the repository

2. Install dependencies:
   ```bash
   bun run install:all
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

Run both the server and client concurrently:

```bash
bun run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

### Individual Commands

```bash
# Run only the backend
bun run dev:server

# Run only the frontend
bun run dev:client

# Build for production
bun run build
```

## Project Structure

```
ai-assistant/
├── client/                 # Vite + React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.tsx        # Main app component
│   │   ├── main.tsx       # Entry point
│   │   └── types.ts       # TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                 # Bun backend
│   └── index.ts           # Server with /api/chat endpoint
├── .env.example
├── package.json           # Root scripts
└── README.md
```

## API

### POST /api/chat

Send messages to the AI and receive streaming responses.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "systemPrompt": "You are a helpful assistant." // optional
}
```

**Response:** Server-Sent Events stream with chunks in format:
```
data: {"content":"Hello"}

data: {"content":" there!"}

data: [DONE]
```

## License

MIT
