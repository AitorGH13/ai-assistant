from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest, ChatResponse, Message
from app.services.openai_svc import openai_service
from app.services.supabase_svc import supabase_service
from app.routers.auth import get_current_user_id
from uuid import UUID
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["chat"])

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
    # Basic title generation strategy: truncate first message
    title = first_msg_content[:30] + "..." if len(first_msg_content) > 30 else first_msg_content
    
    initial_msg = {
        "id": 0,
        "role": "user", 
        "msg": first_msg_content,
        "date": datetime.utcnow().isoformat()
    }
    
    conversation = supabase_service.create_conversation(user_id, title, initial_msg)
    
    # If we want to immediately stream response for the first message, 
    # the frontend might expect a different flow. 
    # For now, return the conversation ID so frontend can redirect or connect.
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
    # 1. Fetch conversation history logic could go here to append context
    # custom logic to merge DB history + new message? 
    # For now, we trust the client sends the relevant context in `request.messages` 
    # OR we fetch it from DB. 
    # The prompt says: "Fetch the JSONB history. Append the User message..."
    
    conversation = supabase_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Append User Message to DB immediately? or after? 
    # Let's append user message now.
    current_history = conversation.get("history", [])
    
    last_user_msg = request.messages[-1]
    user_msg_entry = {
        "id": 0, # User
        "role": "user",
        "msg": last_user_msg.content, 
        "date": datetime.utcnow().isoformat()
    }
    
    updated_history = current_history + [user_msg_entry]
    
    # Update DB with user message (Optimistic update or strictly wait for this?)
    # Validating inputs first
    if not last_user_msg.content.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    supabase_service.update_conversation_history(conversation_id, updated_history)
    
    # Prepare messages for OpenAI (system prompt + history + new message)
    # We can use the history from DB to ensure consistency, transforming it to OpenAI format
    openai_messages = []
    for h in updated_history:
        role = "user" if h["id"] == 0 else "assistant" # Simplified mapping
        # Or use 'role' field if we stored it (we added it to new entries)
        if "role" in h:
            role = h["role"]
            
        openai_messages.append(Message(id=h.get("id"), role=role, content=h.get("msg"), created_at=datetime.fromisoformat(h.get("date"))))
        
    async def stream_generator():
        full_response_content = ""
        async for chunk in openai_service.stream_chat(openai_messages):
            # Intercept content to build full response for saving
            if chunk.startswith("data: {") and not "[DONE]" in chunk:
                try:
                    import json
                    data = json.loads(chunk[6:])
                    if "content" in data:
                        full_response_content += data["content"]
                except:
                    pass
            yield chunk
            
        # After stream finishes, save AI response to DB
        ai_msg_entry = {
            "id": 1, # AI
            "role": "assistant",
            "msg": full_response_content,
            "date": datetime.utcnow().isoformat()
        }
        final_history = updated_history + [ai_msg_entry]
        supabase_service.update_conversation_history(conversation_id, final_history)

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@router.get("/{conversation_id}")
async def get_conversation(conversation_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    conversation = supabase_service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation
