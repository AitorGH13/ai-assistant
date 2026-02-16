from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from app.services.elevenlabs_svc import elevenlabs_service

class SpeakRequest(BaseModel):
    text: str
    voiceId: str = "21m00Tcm4TlvDq8ikWAM" # Default voice

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
