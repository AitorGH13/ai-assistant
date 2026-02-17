from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from uuid import UUID

class Message(BaseModel):
    """
    Standard API Message model.
    Decoupled from the internal DB JSONB structure.
    """
    id: Optional[Union[str, int]] = None # Allow both until we migrate fully
    role: str # user, assistant, system
    content: Union[str, List[Dict[str, Any]]]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]] 

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    conversation_id: Optional[UUID] = None
    model: str = "gpt-4o-mini"
    is_temporary: bool = False

class JSONBMessage(BaseModel):
    id: int # 0=User, 1=AI
    msg: str
    date: datetime

class TTSAudio(BaseModel):
    id: str
    text: str
    audioUrl: str
    timestamp: float
    voiceId: str
    voiceName: str
    transcript: Optional[List[Dict[str, Any]]] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: UUID
    title: Optional[str] = None
    history: List[Message]
    ttsHistory: Optional[List[TTSAudio]] = []
