from fastapi import APIRouter, HTTPException, Response, Depends, Body, Request, Header, BackgroundTasks
from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional, Dict, Any
import hmac
import hashlib
import json
import base64

from app.core.config import settings
from app.routers.auth import get_current_user_id
from app.services.elevenlabs_svc import elevenlabs_service
from app.services.voice_svc import voice_service
from app.services.storage_service import storage_service

class SpeakRequest(BaseModel):
    text: str
    voiceId: str = "21m00Tcm4TlvDq8ikWAM" # Default voice

class VoiceSessionRequest(BaseModel):
    transcript: Optional[List[Dict[str, Any]]] = None
    app_conversation_id: Optional[str] = None

# Prefix in main.py is "/api", so we define prefix="/voice" here = "/api/voice"
# But endpoints need to match user expectation or update frontend.
# User wants "/api/voices". If we use prefix="/voice", we get "/api/voice/voices".
# I will stick to this and update frontend.
router = APIRouter(prefix="/voice", tags=["voice"])

@router.get("/voices")
async def get_voices():
    """
    Fetch available voices from ElevenLabs and map to frontend format.
    """
    try:
        data = elevenlabs_service.get_voices()
        voices = data.get("voices", [])
        
        # Map to frontend format
        simplified_voices = []
        for voice in voices:
            simplified_voices.append({
                "id": voice.get("voice_id"),
                "name": voice.get("name"),
                "category": voice.get("category", "general"),
                "preview_url": voice.get("preview_url", "")
            })
            
        return simplified_voices
    except Exception as e:
        print(f"Error fetching voices: {e}")
        # Return empty list or error? Frontend expects array.
        return []

@router.get("/conversation-signature")
async def get_conversation_signature():
    """
    Returns the agent ID.
    """
    if not settings.ELEVENLABS_AGENT_ID:
        raise HTTPException(status_code=500, detail="ELEVENLABS_AGENT_ID not configured")
    
    return {"agentId": settings.ELEVENLABS_AGENT_ID}

@router.post("/speak")
async def text_to_speech(request: SpeakRequest):
    try:
        audio_content = elevenlabs_service.text_to_speech(request.text, request.voiceId)
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        print(f"Error generating speech: {e}")
        raise HTTPException(status_code=500, detail=f"ElevenLabs Error: {str(e)}")

@router.post("/process/{conversation_id}")
async def process_voice_session(
    conversation_id: str,
    request: VoiceSessionRequest = Body(...),
    user_id: UUID = Depends(get_current_user_id)
):
    """
    Process a completed voice session.
    """
    try:
        result = await voice_service.process_and_save_session(
            conversation_id=conversation_id,
            user_id=user_id,
            fallback_transcript=request.transcript,
            app_conversation_id=request.app_conversation_id
        )
        return result

    except Exception as e:
        print(f"Error processing voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    elevenlabs_signature: Optional[str] = Header(None)
):
    """
    Handle ElevenLabs webhook.
    """
    # 1. Read Raw Body
    try:
        body = await request.body()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading body: {str(e)}")

    # 2. Validate Signature
    if settings.ELEVENLABS_WEBHOOK_SECRET:
        if not elevenlabs_signature:
             print("[Webhook] Missing signature header.")
             raise HTTPException(status_code=401, detail="Missing signature")
             
        # Signature format: "t=timestamp,v1=signature" (usually? Or just signature?)
        # ElevenLabs Docs say the header is `elevenlabs-signature`
        # and checking usually involves:
        # const [timestamp, signature] = header.split(',') (handling prefixes 't=' and 'v1=')
        # const payload = `${timestamp}.${body}`
        # const hmac = sha256(payload, secret)
        # Verify strict equality.
        
        try:
            # Parse header
            parts = {k:v for k,v in [p.split('=') for p in elevenlabs_signature.split(',')]}
            timestamp = parts.get('t')
            sig = parts.get('v0') or parts.get('v1') # Docs vary, check both or just split?
            # If standard simple signature:
            # User's old code: `const timestamp = signatureHeader.split(",")[0]?.substring(2) || "";` -> 't=...' -> substring(2) implies skipping 't='
            # `const signature = signatureHeader.split(",")[1] || "";`
            
            # Replicate user's old logic for safety:
            header_parts = elevenlabs_signature.split(',')
            t_part = header_parts[0] if len(header_parts) > 0 else ""
            s_part = header_parts[1] if len(header_parts) > 1 else ""
            
            # User old code: `substring(2)`. This assumes "t=" is 2 chars? No, "t=" is 2 chars.
            # timestamp = t_part[2:] if t_part.startswith("t=") else t_part
            # signature = s_part # old code just took it? "v0=" part?
            # Old code: `const computed = 'v0=' + mac.digest('hex');`
            # and `const isValid = signature === computed;`
            # So `signature` variable in old code was the FULL string "v0=..."?
            # Old code: `const signature = signatureHeader.split(",")[1] || "";`
            # If header is "t=123,v0=abc", signature is "v0=abc".
            
            timestamp = t_part[2:] if t_part.startswith("t=") else t_part
            signature_to_check = s_part # e.g. "v0=abcdef..."
            
            # Construct payload
            # Old code: `${timestamp}.${body}`
            # Here body is BYTES. So we need bytes payload.
            # python: payload = f"{timestamp}.".encode() + body
            
            payload = f"{timestamp}.".encode() + body
            
            mac = hmac.new(
                settings.ELEVENLABS_WEBHOOK_SECRET.encode(),
                msg=payload,
                digestmod=hashlib.sha256
            )
            computed = f"v0={mac.hexdigest()}"
            
            if not hmac.compare_digest(signature_to_check, computed):
                print(f"[Webhook] Signature mismatch. Expected: {signature_to_check}, Computed: {computed}")
                raise HTTPException(status_code=401, detail="Invalid signature")
                
            print("[Webhook] Signature validated.")
            
        except Exception as e:
            print(f"Error validating signature: {e}")
            raise HTTPException(status_code=401, detail="Signature validation error")

    # 3. Parse Multipart Form
    try:
        form = await request.form()
    except Exception as e:
        print(f"Error parsing form: {e}")
        raise HTTPException(status_code=400, detail="Invalid form data")
        
    audio_file = form.get("audio")
    conversation_id_val = form.get("conversation_id")
    
    if not conversation_id_val:
        print("[Webhook] Missing conversation_id")
        return {"status": "ignored", "reason": "missing conversation_id"}
        
    conversation_id = str(conversation_id_val)

    if audio_file:
        try:
            # Upload Audio
            # audio_file should be UploadFile compatible in Starlette
            file_content = await audio_file.read()
            file_name = f"{conversation_id}.mp3"
            bucket_name = "voice-sessions"
            
            print(f"[Webhook] Uploading audio for {conversation_id} ({len(file_content)} bytes)")
            
            await storage_service.upload_file(
                file_content=file_content,
                file_name=file_name,
                content_type="audio/mpeg",
                bucket_name=bucket_name,
                use_original_name=True
            )
            print("[Webhook] Audio uploaded successfully.")
        except Exception as e:
            print(f"[Webhook] Error uploading audio: {e}")
            raise HTTPException(status_code=500, detail="Upload failed")
            
    return {"status": "success"}
