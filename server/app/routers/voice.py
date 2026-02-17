from fastapi import APIRouter, HTTPException, Response, Depends, Body
from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional, Dict, Any
from app.routers.auth import get_current_user_id
from app.services.elevenlabs_svc import elevenlabs_service
from app.services.voice_svc import voice_service

class SpeakRequest(BaseModel):
    text: str
    voiceId: str = "21m00Tcm4TlvDq8ikWAM" # Default voice

class VoiceSessionRequest(BaseModel):
    transcript: Optional[List[Dict[str, Any]]] = None
    app_conversation_id: Optional[str] = None

router = APIRouter(prefix="/voice", tags=["voice"])

@router.post("/speak")
async def text_to_speech(request: SpeakRequest):
    try:
        audio_content = elevenlabs_service.text_to_speech(request.text, request.voiceId)
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        print(f"Error generating speech: {e}")
        # Return the actual error message from ElevenLabs (which we raise in service)
        raise HTTPException(status_code=500, detail=f"ElevenLabs Error: {str(e)}")

@router.post("/process/{conversation_id}")
async def process_voice_session(
    conversation_id: str,
    request: VoiceSessionRequest = Body(...),
    user_id: UUID = Depends(get_current_user_id)
):
    """
    Process a completed voice session:
    1. Delegates logic to VoiceService to fetch audio/transcript and save to DB.
    2. Accepts optional fallback transcript in body.
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
