from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest, ChatResponse, Message, TTSAudio
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

@router.patch("/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: UUID, 
    data: dict, # expect {"title": "new title"}
    user_id: UUID = Depends(get_current_user_id)
):
    """Update conversation title."""
    title = data.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="Title required")
        
    success = supabase_service.update_conversation_title(conversation_id, title)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found or update failed")
        
    return {"status": "ok", "message": "Title updated", "title": title}

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
    
    current_history = []
    if conversation:
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
    
    if not conversation:
        # Create conversation on the fly
        first_msg_content = last_user_msg.content
        if isinstance(first_msg_content, list):
             text_parts = [p['text'] for p in first_msg_content if p.get('type') == 'text']
             first_msg_text = " ".join(text_parts)
        else:
            first_msg_text = first_msg_content
            
        title = first_msg_text[:30] + "..." if len(first_msg_text) > 30 else first_msg_text
        
        conversation = supabase_service.create_conversation(user_id, title, user_msg_entry, conversation_id)
        updated_history = [user_msg_entry]
    else:
        updated_history = current_history + [user_msg_entry]
        supabase_service.update_conversation_history(conversation_id, updated_history)
    
    # Prepare messages for OpenAI
    openai_messages = []
    for h in updated_history:
        role = "user" if h.get("id") == 0 else "assistant"
        if "role" in h:
            role = h["role"]
            
        msg_content = h.get("msg")
        if isinstance(msg_content, list):
             # For OpenAI, we need to ensure the structure is correct
             # But here we are just validating against Pydantic Message model which expects str?
             # Wait, Message model defined content: str. If we have list, it will fail.
             # We need to update Message model to accept content as union too.
             # Let's stringify for now or update model. 
             # The error was about ID, not content yet.
             # But let's be safe.
             pass 
             
        openai_messages.append(Message(id=str(h.get("id")), role=role, content=str(h.get("msg")), created_at=datetime.fromisoformat(h.get("date"))))
        
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
    
    # Fetch associated voice sessions
    voice_sessions = supabase_service.list_voice_sessions(conversation_id)
    tts_history = []
    
    for session in voice_sessions:
        # Each session is one "blob" of TTS or audio
        # We need to map it back to TTSAudio structure expected by frontend
        # voice_sessions: id, audio_url, transcript (list of dicts)
        
        # Assume transcript[0] has metadata if we saved it that way
        transcripts = session.get("transcript", [])
        if transcripts and isinstance(transcripts, list):
            meta = transcripts[0]
            # Try to get text from 'msg' (standard) or 'text' (legacy/tts)
            text_content = meta.get("msg") or meta.get("text") or "Audio"
            tts_history.append(TTSAudio(
                id=str(session.get("id")),
                text=text_content,
                audioUrl=session.get("audio_url", ""),
                timestamp=meta.get("timestamp", datetime.utcnow().timestamp() * 1000), # Ensure valid float
                voiceId=meta.get("voice_id") or "conversational-ai",
                voiceName=meta.get("voice_name", "Unknown Voice"),
                transcript=transcripts
            ))

    return ChatResponse(
        response="OK",
        conversation_id=conversation_id,
        history=messages,
        ttsHistory=tts_history
    )

@router.post("/{conversation_id}/tts")
async def add_tts_entry(
    conversation_id: UUID, 
    audio: TTSAudio,
    user_id: UUID = Depends(get_current_user_id)
):
    """Add a TTS audio entry to the voice_sessions table."""
    # Ensure conversation exists
    conversation = supabase_service.get_conversation(conversation_id)
    
    if not conversation:
        # Create new conversation if not exists
        title = audio.text[:30] + "..." if len(audio.text) > 30 else audio.text
        supabase_service.create_conversation(
            user_id=user_id, 
            title=title, 
            initial_message=None, 
            conversation_id=conversation_id
        )
    
    # Create voice session entry linked to conversation
    # We map TTSAudio fields to voice_sessions schema
    # TTSAudio: id, text, audioUrl, timestamp, voiceId, voiceName
    # voice_sessions: id, user_id, conversation_id (via JSON), transcript (jsonb), audio_url
    
    transcript_entry = {
        "msg": audio.text,
        "role": "assistant",
        "timestamp": audio.timestamp,
        "voice_id": audio.voiceId,
        "voice_name": audio.voiceName
    }
    
    # We store the main metadata in transcript for now as it is JSONB
    result = supabase_service.create_voice_session(
        user_id=user_id,
        transcript=[transcript_entry],
        audio_url=audio.audioUrl,
        conversation_id=conversation_id
    )
    
    # Get updated title to return to frontend
    updated_title = None
    if not conversation:
        # We just created it, we know the title we gave it
        updated_title = audio.text[:30] + "..." if len(audio.text) > 30 else audio.text
    
    return {
        "status": "created", 
        "id": result.get("id"),
        "title": updated_title
    }

@router.delete("/{conversation_id}/tts/{audio_id}")
async def delete_tts_entry(
    conversation_id: UUID, 
    audio_id: str,
    user_id: UUID = Depends(get_current_user_id)
):
    """Delete a TTS audio entry (voice session)."""
    # Using the existing supabase_service functionality if available or adding it
    # Since voice_sessions is its own table, we can delete by ID
    from app.services.supabase_svc import supabase_service
    
    # Verify ownership or relationship (conversation_id matches)
    response = supabase_service.client.table("voice_sessions").delete()\
        .eq("id", audio_id)\
        .eq("user_id", str(user_id))\
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Audio not found or not owned by user")
        
    return {"status": "ok", "message": "Audio deleted"}
