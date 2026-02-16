from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from uuid import UUID

class Message(BaseModel):
    id: int  # 0 for user, 1 for AI (or maybe enum?)
    role: str # user, assistant, system
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Message(BaseModel):
    """
    Standard API Message model.
    Decoupled from the internal DB JSONB structure.
    """
    id: Optional[str] = None # UUID from frontend or generated
    role: str # user, assistant, system
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # We can add validators here if needed to ensure role is valid


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
class ChatResponse(BaseModel):
    response: str
    conversation_id: UUID
    history: List[Message] # Return clean Message objects, not raw dicts

class JSONBMessage(BaseModel):
    id: int # 0=User, 1=AI
    msg: str
    date: datetime
