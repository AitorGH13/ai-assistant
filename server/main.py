from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from pathlib import Path
import numpy as np
from typing import List, Dict, Any, Union
from contextlib import asynccontextmanager

# Load environment variables (robust path handling)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Initialize OpenAI client 
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("[!] WARNING: OPENAI_API_KEY not found in environment variables")
else:
    # Print first 8 chars to verify correct key is loaded without printing full secret
    print(f"[OK] Loaded API Key starting with: {api_key[:8]}...")

client = OpenAI(api_key=api_key)


# Knowledge base for semantic search (in-memory)
KNOWLEDGE_BASE = [
    "This AI Assistant is built with Python FastAPI backend and React frontend using Vite.",
    "The project uses OpenAI's GPT-4o-mini model for chat completions.",
    "The secret code is 1234.",
    "The application supports streaming responses for real-time interaction.",
    "Dark mode and light mode are both supported with persistent preferences.",
    "The frontend uses Tailwind CSS for styling and lucide-react for icons.",
    "Markdown and code syntax highlighting are supported in chat messages.",
]

# Store embeddings (will be initialized on startup)
knowledge_base_embeddings: List[List[float]] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize embeddings on startup."""
    global knowledge_base_embeddings
    try:
        print("[INFO] Initializing knowledge base embeddings...")
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=KNOWLEDGE_BASE
        )
        knowledge_base_embeddings = [item.embedding for item in response.data]
        print(f"[OK] Initialized {len(knowledge_base_embeddings)} embeddings")
    except Exception as e:
        print(f"[ERROR] Failed to initialize embeddings: {e}")
        # Continue without embeddings - will fail at search time
        knowledge_base_embeddings = []
    
    yield
    
    # Cleanup (if needed)
    print("[INFO] Shutting down...")


app = FastAPI(lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)
    dot_product = np.dot(vec1_np, vec2_np)
    norm1 = np.linalg.norm(vec1_np)
    norm2 = np.linalg.norm(vec2_np)
    return float(dot_product / (norm1 * norm2))


def get_current_weather(location: str) -> Dict[str, Any]:
    """Dummy weather function that returns hardcoded data."""
    # Hardcoded weather data for demo purposes
    weather_data = {
        "location": location,
        "temperature": "25°C",
        "condition": "Sunny",
        "humidity": "60%",
        "wind_speed": "10 km/h"
    }
    return weather_data  


def get_developer_description() -> Dict[str, Any]:
    """Dummy function that returns attributes of the developer."""
    return {
        "attributes": {
            "name": "Aitor",
            "height": "alto",
            "appearance": "atractivo",
            "intelligence": "inteligente",
            "personality": "simpático",
        },
    }


class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]  # Support text and multimodal content


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    systemPrompt: str | None = None
    mode: str = "chat"  # "chat", "vision", or "function"


class SearchRequest(BaseModel):
    query: str


async def generate_stream(messages: list, system_prompt: str | None, mode: str = "chat"):
    """Generator function for streaming OpenAI responses."""
    try:
        # Prepare conversation input for Chat Completions API
        conversation_input = []
        
        # Add system message if provided
        if system_prompt:
            conversation_input.append({"role": "system", "content": system_prompt})
        
        # Convert messages to OpenAI format
        for m in messages:
            msg_dict = {"role": m.role, "content": m.content}
            conversation_input.append(msg_dict)
        
        # Define tools for function calling mode
        tools = None
        if mode == "function":
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
                                    "description": "The city name, e.g., Tokyo, London, New York"
                                }
                            },
                            "required": ["location"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "getDeveloperDescription",
                        "description": "Get information about the solo developer who created this application. Returns attributes of a single individual developer.",
                        "parameters": {
                            "type": "object",
                            "properties": {}
                        }
                    }
                }
            ]
        
        # Use gpt-4o-mini for all modes (supports both vision and function calling)
        model = "gpt-4o-mini"
        
        # First API call
        stream = client.chat.completions.create(
            model=model,
            messages=conversation_input,
            tools=tools,
            stream=True,
        )
        
        # Collect the response
        tool_calls = []
        current_tool_call = None
        response_content = ""
        
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            
            if delta:
                # Handle content streaming
                if delta.content:
                    response_content += delta.content
                    yield f"data: {json.dumps({'content': delta.content})}\n\n"
                
                # Handle tool calls
                if delta.tool_calls:
                    for tool_call_delta in delta.tool_calls:
                        if tool_call_delta.index is not None:
                            # Initialize or get existing tool call
                            while len(tool_calls) <= tool_call_delta.index:
                                tool_calls.append({
                                    "id": "",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""}
                                })
                            current_tool_call = tool_calls[tool_call_delta.index]
                            
                            if tool_call_delta.id:
                                current_tool_call["id"] = tool_call_delta.id
                            if tool_call_delta.function:
                                if tool_call_delta.function.name:
                                    current_tool_call["function"]["name"] = tool_call_delta.function.name
                                if tool_call_delta.function.arguments:
                                    current_tool_call["function"]["arguments"] += tool_call_delta.function.arguments
            
            # Check if streaming is done
            if chunk.choices and chunk.choices[0].finish_reason:
                finish_reason = chunk.choices[0].finish_reason
                
                # If tool calls were made, execute them
                if finish_reason == "tool_calls" and tool_calls:
                    # Notify frontend that tool is being called
                    yield f"data: {json.dumps({'tool_calling': True})}\n\n"
                    
                    # Add assistant message with tool calls
                    conversation_input.append({
                        "role": "assistant",
                        "content": response_content or None,
                        "tool_calls": tool_calls
                    })
                    
                    # Execute tool calls
                    for tool_call in tool_calls:
                        function_name = tool_call["function"]["name"]
                        function_args = json.loads(tool_call["function"]["arguments"])
                        
                        if function_name == "getCurrentWeather":
                            function_response = get_current_weather(function_args["location"])
                        elif function_name == "getDeveloperDescription":
                            function_response = get_developer_description()
                        else:
                            function_response = {"error": "Unknown function"}
                        
                        # Añadir la respuesta de la herramienta a la conversación
                        conversation_input.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps(function_response)
                        })
                    
                    # Make second API call to get final response
                    second_stream = client.chat.completions.create(
                        model=model,
                        messages=conversation_input,
                        stream=True,
                    )
                    
                    for chunk in second_stream:
                        delta = chunk.choices[0].delta if chunk.choices else None
                        if delta and delta.content:
                            yield f"data: {json.dumps({'content': delta.content})}\n\n"
        
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        print(f"Error in generate_stream: {e}")
        error_data = json.dumps({"error": str(e)})
        yield f"data: {error_data}\n\n"


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat endpoint with streaming response."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array is required")
    
    return StreamingResponse(
        generate_stream(request.messages, request.systemPrompt, request.mode),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/search")
async def search(request: SearchRequest):
    """Semantic search endpoint using embeddings."""
    try:
        # Generate embedding for query
        query_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=request.query
        )
        query_embedding = query_response.data[0].embedding
        
        # Calculate similarities
        similarities = []
        for i, kb_embedding in enumerate(knowledge_base_embeddings):
            similarity = cosine_similarity(query_embedding, kb_embedding)
            similarities.append({
                "text": KNOWLEDGE_BASE[i],
                "similarity": similarity
            })
        
        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        
        # Return most relevant result
        return {
            "query": request.query,
            "result": similarities[0]["text"],
            "similarity": similarities[0]["similarity"],
            "all_results": similarities[:3]  # Top 3 results
        }
    except Exception as e:
        print(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Assistant API"}


if __name__ == "__main__":
    import uvicorn
    print("[INFO] Server running at http://localhost:3001")
    uvicorn.run(app, host="0.0.0.0", port=3001)
