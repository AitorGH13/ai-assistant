from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from uuid import UUID

class Message(BaseModel):
    id: int  # 0 for user, 1 for AI (or maybe enum?)
    role: str # user, assistant, system
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # For now, let's keep it simple and match the requested JSONB structure
    # [ { "id": 0, "msg": "...", "date": "..." } ]
    # But for API request/response we might want standard fields

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    conversation_id: Optional[UUID] = None
    model: str = "gpt-4o-mini"
    
class ChatResponse(BaseModel):
    response: str
    conversation_id: UUID
    history: List[Dict[str, Any]]

class JSONBMessage(BaseModel):
    id: int # 0=User, 1=AI
    msg: str
    date: datetime
