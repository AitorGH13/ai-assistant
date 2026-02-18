import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "AI Assistant API"
    API_V1_STR: str = "/api"
    
    # OpenAI
    OPENAI_API_KEY: str
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str 
    
    # ElevenLabs
    ELEVENLABS_API_KEY: str
    ELEVENLABS_AGENT_ID: Optional[str] = None
    ELEVENLABS_WEBHOOK_SECRET: Optional[str] = None
    
    # Cors
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
