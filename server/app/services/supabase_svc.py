from supabase import create_client, Client
from app.core.config import settings
from typing import List, Dict, Any, Optional
from uuid import UUID

class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    def create_conversation(self, user_id: UUID, title: str, initial_message: Dict[str, Any]) -> Dict[str, Any]:
        data = {
            "user_id": str(user_id),
            "title": title,
            "history": [initial_message]
        }
        response = self.client.table("conversations").insert(data).execute()
        return response.data[0]

    def get_conversation(self, conversation_id: UUID) -> Dict[str, Any]:
        response = self.client.table("conversations").select("*").eq("id", str(conversation_id)).execute()
        if not response.data:
            return None
        return response.data[0]
        
    def list_conversations(self, user_id: UUID) -> List[Dict[str, Any]]:
        response = self.client.table("conversations").select("id, title, created_at, updated_at")\
            .eq("user_id", str(user_id))\
            .order("updated_at", desc=True)\
            .execute()
        return response.data

    def delete_conversation(self, conversation_id: UUID, user_id: UUID) -> bool:
        # Verify ownership implicitly by filter
        response = self.client.table("conversations").delete()\
            .eq("id", str(conversation_id))\
            .eq("user_id", str(user_id))\
            .execute()
        return len(response.data) > 0

    def update_conversation_history(self, conversation_id: UUID, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        response = self.client.table("conversations").update({"history": history}).eq("id", str(conversation_id)).execute()
        return response.data[0]

    def create_voice_session(self, user_id: UUID, transcript: List[Dict[str, Any]], audio_url: Optional[str] = None) -> Dict[str, Any]:
        data = {
            "user_id": str(user_id),
            "transcript": transcript,
            "audio_url": audio_url
        }
        response = self.client.table("voice_sessions").insert(data).execute()
        return response.data[0]

supabase_service = SupabaseService()
