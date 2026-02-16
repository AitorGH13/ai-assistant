from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest, ChatResponse, Message
from app.services.openai_svc import openai_service
from app.services.supabase_svc import supabase_service
from app.services.storage_service import storage_service
from app.routers.auth import get_current_user_id
from uuid import UUID
from typing import List, Optional
from datetime import datetime
import json

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/")
async def list_conversations(user_id: UUID = Depends(get_current_user_id)):
    """List all conversations for the current user."""
    return supabase_service.list_conversations(user_id)

@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    """Delete a conversation."""
    success = supabase_service.delete_conversation(conversation_id, user_id)
    if not success:
        # Could be 404 or just not allowed/not found
        raise HTTPException(status_code=404, detail="Conversation not found or could not be deleted")
    return {"status": "ok", "message": "Conversation deleted"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id)
):
    """Upload a file (image/audio) and return the public URL."""
    try:
        content = await file.read()
        public_url_resp = await storage_service.upload_file(content, file.filename, file.content_type)
        
        # storage-py `get_public_url` returns a string URL or object depending on version
        # If it's just the URL string, return it. If it's an object/response, extract it.
        # Assuming our storage_service.py returns the URL string or Response object.
        # Let's verify what `get_public_url` returns. Usually it returns the URL string directly in newer versions, 
        # or we might need to construct it.
        
        # Adjust based on storage_service implementation which calls `get_public_url`
        return {"url": public_url_resp} 
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/new")
async def create_conversation(
    request: ChatRequest,
    user_id: UUID = Depends(get_current_user_id)
):
    """
    Create a new conversation.
    Generates a title from the first message if not provided.
    """
    first_msg_content = request.messages[0].content if request.messages else "New Conversation"
    
    # Handle multimodal content for title generation
    if isinstance(first_msg_content, list):
         # Extract text from list of content parts
         text_parts = [p['text'] for p in first_msg_content if p.get('type') == 'text']
         first_msg_text = " ".join(text_parts)
    else:
        first_msg_text = first_msg_content

    # Basic title generation strategy: truncate first message
    title = first_msg_text[:30] + "..." if len(first_msg_text) > 30 else first_msg_text
    
    initial_msg = {
        "id": 0,
        "role": "user", 
        "msg": first_msg_content,
        "date": datetime.utcnow().isoformat()
    }
    
    conversation = supabase_service.create_conversation(user_id, title, initial_msg)
    return conversation

@router.post("/{conversation_id}/message")
async def send_message(
    conversation_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(get_current_user_id)
):
    """
    Send a message to an existing conversation and stream the response.
    """
    conversation = supabase_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    current_history = conversation.get("history", [])
    
    last_user_msg = request.messages[-1]
    
    # Validation
    if isinstance(last_user_msg.content, str) and not last_user_msg.content.strip():
         raise HTTPException(status_code=400, detail="Empty message")

    user_msg_entry = {
        "id": 0, # User
        "role": "user",
        "msg": last_user_msg.content, 
        "date": datetime.utcnow().isoformat()
    }
    
    updated_history = current_history + [user_msg_entry]
    
    supabase_service.update_conversation_history(conversation_id, updated_history)
    
    # Prepare messages for OpenAI
    openai_messages = []
    for h in updated_history:
        role = "user" if h["id"] == 0 else "assistant"
        if "role" in h:
            role = h["role"]
            
        openai_messages.append(Message(id=h.get("id"), role=role, content=h.get("msg"), created_at=datetime.fromisoformat(h.get("date"))))
        
    async def stream_generator():
        full_response_content = ""
        async for chunk in openai_service.stream_chat(openai_messages):
            if chunk.startswith("data: {") and not "[DONE]" in chunk:
                try:
                    data = json.loads(chunk[6:])
                    if "content" in data:
                        full_response_content += data["content"]
                except:
                    pass
            yield chunk
            
        ai_msg_entry = {
            "id": 1, # AI
            "role": "assistant",
            "msg": full_response_content,
            "date": datetime.utcnow().isoformat()
        }
        final_history = updated_history + [ai_msg_entry]
        supabase_service.update_conversation_history(conversation_id, final_history)

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@router.get("/{conversation_id}", response_model=ChatResponse)
async def get_conversation(conversation_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    conversation = supabase_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    history_data = conversation.get("history", [])
    messages = []
    
    for item in history_data:
        # Map legacy 0/1 IDs to roles if 'role' is missing
        role = "user" if item.get("id") == 0 else "assistant"
        if "role" in item:
            role = item["role"]
        
        content = item.get("msg", "")
        
        # Parse timestamp
        date_str = item.get("date")
        try:
            timestamp = datetime.fromisoformat(date_str) if date_str else datetime.utcnow()
        except ValueError:
            timestamp = datetime.utcnow()
        
        # Generate stable-ish ID or use Random UUID to ensure frontend keys are unique
        # (Internal ID 0/1 is not unique)
        import uuid
        msg_id = str(uuid.uuid4())
        
        messages.append(Message(
            id=msg_id,
            role=role,
            content=content,
            created_at=timestamp
        ))
        
    return ChatResponse(
        response="OK",
        conversation_id=conversation_id,
        history=messages
    )
