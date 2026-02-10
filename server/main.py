from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from pathlib import Path

# Load environment variables (robust path handling)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Initialize OpenAI client 
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("[!] WARNING: OPENAI_API_KEY not found in environment variables")
else:
    # Print first 8 chars to verify correct key is loaded without printing full secret
    print(f"[OK] Loaded API Key starting with: {api_key[:8]}...")

client = OpenAI(api_key=api_key)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    systemPrompt: str | None = None


async def generate_stream(messages: list, system_prompt: str | None):
    """Generator function for streaming OpenAI responses."""
    try:
        # Prepare conversation input for Responses API
        # We pass the full history as input since we are stateless
        conversation_input = [{"role": m.role, "content": m.content} for m in messages]
        
        # Create streaming response using the new Responses API
        stream = client.responses.create(
            model="gpt-4o-mini",
            input=conversation_input,
            instructions=system_prompt,
            stream=True,
        )
        
        # Stream the response chunks
        for event in stream:
            if event.type == "response.output_text.delta":
                content = event.delta
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
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
        generate_stream(request.messages, request.systemPrompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Assistant API"}


if __name__ == "__main__":
    import uvicorn
    print("[INFO] Server running at http://localhost:3001")
    uvicorn.run(app, host="0.0.0.0", port=3001)
