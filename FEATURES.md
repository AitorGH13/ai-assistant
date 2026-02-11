# Advanced OpenAI Features Documentation

This document describes the three advanced OpenAI features implemented in this AI Assistant application.

## Overview

The application now supports three distinct modes, accessible via a tabbed interface:

1. **Chat Mode** - AI chat with function calling capabilities
2. **Vision Mode** - Multimodal image analysis
3. **Search Mode** - Semantic search using embeddings

## Feature 1: Function Calling (Agentic Capabilities)

### Description
The chat mode now supports OpenAI's function calling feature, allowing the AI to call predefined tools to retrieve information and provide more accurate responses.

### Implementation Details

#### Backend (`server/main.py`)
```python
# Tool definition
def get_current_weather(location: str) -> Dict[str, Any]:
    """Dummy weather function that returns hardcoded data."""
    return {
        "location": location,
        "temperature": "25°C",
        "condition": "Sunny",
        "humidity": "60%",
        "wind_speed": "10 km/h"
    }

# Tools array passed to OpenAI
tools = [
    {
        "type": "function",
        "function": {
            "name": "getCurrentWeather",
            "description": "Get the current weather for a specific location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city name"
                    }
                },
                "required": ["location"]
            }
        }
    }
]
```

#### How It Works
1. User asks: "What's the weather in Tokyo?"
2. OpenAI detects the need to call `getCurrentWeather`
3. Backend executes the function with parsed arguments
4. Result is sent back to OpenAI as a tool message
5. OpenAI generates a natural language response

#### Frontend Features
- Visual "Tool Used" badge with green checkmark and wrench icon
- Seamless integration with streaming responses
- No UI changes required from the user

### Example Usage
```
User: "What is the weather in Tokyo?"
AI: [Calls getCurrentWeather("Tokyo")]
AI: "The weather in Tokyo is currently sunny with a temperature of 25°C..."
```

---

## Feature 2: Vision API (Multimodal Analysis)

### Description
Vision mode allows users to upload images and ask questions about them, leveraging GPT-4o-mini's vision capabilities.

### Implementation Details

#### Frontend (`client/src/components/ChatInput.tsx`)
- File input button for image uploads
- Image preview with remove option
- Base64 encoding of images
- 20MB file size limit
- Validation for image file types

#### Message Structure
```typescript
// Multimodal content
{
  role: "user",
  content: [
    { type: "text", text: "What's in this image?" },
    { 
      type: "image_url", 
      image_url: { 
        url: "data:image/jpeg;base64,..." 
      } 
    }
  ]
}
```

#### Backend Processing
- Accepts complex content structure
- Forwards to OpenAI's Chat Completions API
- Uses `gpt-4o-mini` model for vision support

### Example Usage
1. Switch to "Vision" tab
2. Click the image icon to upload a photo
3. Type a question: "What objects are in this image?"
4. Send the message
5. AI analyzes the image and responds

---

## Feature 3: Embeddings & Semantic Search (Basic RAG)

### Description
The search mode implements a basic Retrieval-Augmented Generation (RAG) system using OpenAI's embeddings API for semantic search.

### Implementation Details

#### Knowledge Base
```python
KNOWLEDGE_BASE = [
    "This AI Assistant is built with Python FastAPI backend and React frontend using Vite.",
    "The project uses OpenAI's GPT-4o-mini model for chat completions.",
    "The secret code is 1234.",
    "The application supports streaming responses for real-time interaction.",
    "Dark mode and light mode are both supported with persistent preferences.",
    "The frontend uses Tailwind CSS for styling and lucide-react for icons.",
    "Markdown and code syntax highlighting are supported in chat messages.",
]
```

#### Embedding Process
1. **Startup**: Generate embeddings for all knowledge base entries using `text-embedding-3-small`
2. **Query**: Generate embedding for user's search query
3. **Similarity**: Calculate cosine similarity between query and all KB embeddings
4. **Results**: Return top 3 most relevant results with similarity scores

#### Cosine Similarity
```python
def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)
    dot_product = np.dot(vec1_np, vec2_np)
    norm1 = np.linalg.norm(vec1_np)
    norm2 = np.linalg.norm(vec2_np)
    return float(dot_product / (norm1 * norm2))
```

#### API Endpoint
```
POST /api/search
{
  "query": "What is the secret code?"
}

Response:
{
  "query": "What is the secret code?",
  "result": "The secret code is 1234.",
  "similarity": 0.89,
  "all_results": [...]
}
```

### Frontend (`client/src/components/SemanticSearch.tsx`)
- Dedicated search interface in Search tab
- Input field with search button
- Loading state during search
- Results display with similarity percentages
- Top 3 results shown
- Example queries provided

### Example Usage
```
Query: "What is the secret code?"
Result: "The secret code is 1234." (89% similarity)

Query: "What technologies does this use?"
Result: "This AI Assistant is built with Python FastAPI..." (92% similarity)
```

---

## Architecture

### Backend Stack
- **FastAPI** - Modern Python web framework
- **OpenAI Python SDK** - API client
- **NumPy** - Vector operations for similarity
- **Uvicorn** - ASGI server

### Frontend Stack
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### API Flow

#### Chat/Vision Mode
```
User Input → Frontend
    ↓
API Request (POST /api/chat)
    ↓
Backend (generate_stream)
    ↓
OpenAI Chat Completions API
    ↓
[Optional: Tool Call Detection & Execution]
    ↓
Streaming Response → Frontend
    ↓
Display to User
```

#### Search Mode
```
User Query → Frontend
    ↓
API Request (POST /api/search)
    ↓
Backend
    ├─ Generate query embedding
    ├─ Calculate similarities
    └─ Sort by relevance
    ↓
JSON Response → Frontend
    ↓
Display Results
```

---

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-your-api-key-here
```

### Server Startup
Embeddings are initialized automatically when the server starts using FastAPI's lifespan context manager.

---

## Error Handling

### Image Upload
- File size validation (max 20MB)
- File type validation (images only)
- Error messages displayed to user

### API Errors
- Network errors caught and displayed
- OpenAI API errors logged
- Graceful degradation with error messages

### Embeddings
- If embeddings fail to initialize, search will return an error
- Errors logged to console
- User-friendly error messages

---

## Testing

### Function Calling
Try these queries in Chat mode:
- "What's the weather in Tokyo?"
- "Tell me about the weather in London"
- "Is it sunny in Paris?"

### Vision API
Try these in Vision mode:
1. Upload an image of a landscape
2. Ask: "What's in this image?"
3. Ask: "Describe the colors and composition"

### Semantic Search
Try these in Search mode:
- "What is the secret code?"
- "What technologies are used?"
- "Does this support dark mode?"

---

## Future Enhancements

Potential improvements:
1. **Function Calling**
   - Add more tools (calculator, web search, etc.)
   - Real API integrations
   - Tool call history

2. **Vision API**
   - Multiple image support
   - Image URL input
   - Image generation with DALL-E

3. **Semantic Search**
   - Persistent vector database
   - Document upload and indexing
   - Hybrid search (keyword + semantic)
   - Larger knowledge base

---

## Troubleshooting

### "Tool Used" badge not showing
- Ensure mode is set to "chat" (not "vision" or "search")
- Check that the query triggers the weather tool

### Image upload not working
- Verify file is under 20MB
- Ensure file is a valid image format
- Check browser console for errors

### Search returns no results
- Verify server started successfully
- Check that embeddings initialized (see server logs)
- Ensure OpenAI API key is valid

---

## License

This implementation follows OpenAI's usage policies and terms of service.
