from supabase import create_client, Client
from app.core.config import settings
from typing import List, Dict, Any, Optional, Union
from uuid import UUID

class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    def create_conversation(self, user_id: UUID, title: str, 
                          initial_message: Optional[Dict[str, Any]] = None, 
                          conversation_id: Optional[UUID] = None) -> Dict[str, Any]:
        data = {
            "user_id": str(user_id),
            "title": title,
            "history": [initial_message] if initial_message else []
        }
            
        if conversation_id:
            data["id"] = str(conversation_id)
            
        response = self.client.table("conversations").insert(data).execute()
        return response.data[0]

    def get_conversation(self, conversation_id: UUID) -> Dict[str, Any]:
        response = self.client.table("conversations").select("*").eq("id", str(conversation_id)).execute()
        if not response.data:
            return None
        return response.data[0]
        
    def list_conversations(self, user_id: UUID) -> List[Dict[str, Any]]:
        # Fetch conversations
        conv_resp = self.client.table("conversations").select("id, title, created_at, updated_at, history")\
            .eq("user_id", str(user_id))\
            .order("updated_at", desc=True)\
            .execute()
        
        # Fetch ALL voice sessions for this user to map icons without complex joins
        voice_resp = self.client.table("voice_sessions").select("id, conversation_id, transcript")\
            .eq("user_id", str(user_id))\
            .execute()
        
        conversations = conv_resp.data
        voice_sessions = voice_resp.data
        
        # Group voice sessions by conversation_id
        sessions_by_conv = {}
        for session in voice_sessions:
            c_id = session.get("conversation_id")
            if c_id:
                if c_id not in sessions_by_conv:
                    sessions_by_conv[c_id] = []
                sessions_by_conv[c_id].append(session)
        
        # Merge voice sessions into conversations
        for conv in conversations:
            conv_id = conv.get("id")
            conv["voice_sessions"] = sessions_by_conv.get(conv_id, [])
            
        return conversations

    def delete_conversation(self, conversation_id: UUID, user_id: UUID) -> bool:
        # Delete associated voice sessions first
        self.client.table("voice_sessions").delete()\
            .eq("conversation_id", str(conversation_id))\
            .execute()

        # Verify ownership implicitly by filter and delete conversation
        response = self.client.table("conversations").delete()\
            .eq("id", str(conversation_id))\
            .eq("user_id", str(user_id))\
            .execute()
        return len(response.data) > 0

    def update_conversation_history(self, conversation_id: UUID, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        response = self.client.table("conversations").update({"history": history}).eq("id", str(conversation_id)).execute()
        return response.data[0]
        
    def update_conversation_title(self, conversation_id: UUID, title: str) -> bool:
        response = self.client.table("conversations").update({"title": title}).eq("id", str(conversation_id)).execute()
        return len(response.data) > 0

    def create_voice_session(self, user_id: UUID, transcript: List[Dict[str, Any]], audio_url: Optional[str] = None, conversation_id: Optional[Union[UUID, str]] = None) -> Dict[str, Any]:
        """
        Creates a voice session. Can be linked to a conversation or standalone.
        """
        print(f"DEBUG: creating voice session for user {user_id}, conversation {conversation_id}")
        data = {
            "user_id": str(user_id),
            "transcript": transcript,
            "audio_url": audio_url
        }
        if conversation_id:
            data["conversation_id"] = str(conversation_id)
            
        response = self.client.table("voice_sessions").insert(data).execute()
        return response.data[0]
        
    def list_voice_sessions(self, conversation_id: UUID) -> List[Dict[str, Any]]:
        """List voice sessions for a specific conversation."""
        response = self.client.table("voice_sessions").select("*")\
            .eq("conversation_id", str(conversation_id))\
            .order("created_at", desc=False)\
            .execute()
        return response.data

supabase_service = SupabaseService()
