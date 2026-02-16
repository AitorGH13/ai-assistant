import requests
from app.core.config import settings
from typing import Optional, Generator, Iterator

class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.api_url = "https://api.elevenlabs.io/v1"
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        print(f"ElevenLabs Service initialized. Key length: {len(self.api_key) if self.api_key else 0}")

    def text_to_speech(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> bytes: # Default to Rachel
        url = f"{self.api_url}/text-to-speech/{voice_id}"
        
        data = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        response = requests.post(url, json=data, headers=self.headers)
        
        if response.status_code != 200:
            print(f"ElevenLabs API Error: {response.status_code} - {response.text}") # Debug
            # If default fails or quota exceeded, fallback or raise
            raise Exception(f"ElevenLabs API Error: {response.status_code} - {response.text}")
            
        return response.content

    def stream_text_to_speech(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> Iterator[bytes]:
        url = f"{self.api_url}/text-to-speech/{voice_id}/stream"
        
        data = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
             "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        response = requests.post(url, json=data, headers=self.headers, stream=True)
        
        if response.status_code != 200:
             raise Exception(f"ElevenLabs API Error: {response.status_code} - {response.text}")
             
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                yield chunk

elevenlabs_service = ElevenLabsService()
