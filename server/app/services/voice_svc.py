import requests
import time
from datetime import datetime
from uuid import UUID
from typing import List, Dict, Any, Optional
from app.services.elevenlabs_svc import elevenlabs_service
from app.services.storage_service import storage_service
from app.services.supabase_svc import supabase_service

class VoiceService:
    async def process_and_save_session(self, conversation_id: str, user_id: UUID, fallback_transcript: Optional[List[Dict[str, Any]]] = None, app_conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a completed voice session:
        1. Fetch audio from Local Webhook Server (Bun) OR ElevenLabs and upload to Supabase.
        2. Fetch transcript from ElevenLabs (or use fallback).
        3. Format data and save to voice_sessions table.
        """
        print(f"Processing voice session: {conversation_id} (App ID: {app_conversation_id}) for user {user_id}")
        
        # 1. Audio Persistence
        audio_url = None
        audio_content = None
        bucket_name = "voice-sessions" 
        file_name = f"{conversation_id}.mp3"

        # Check Supabase Storage first (Webhook might have saved it)
        try:
            print(f"Checking storage for audio: {file_name}")
            # list_files returns list of FileObjects. match exactly.
            files = storage_service.list_files(bucket_name, file_name)
            # Supabase storage list might return prefix matches, so check name
            if files and any(f.get('name') == file_name for f in files):
                print(f"Audio found in storage: {file_name}")
                audio_url = storage_service.get_public_url(bucket_name, file_name)
            else:
                 print("Audio not found in storage. Falling back to ElevenLabs API.")
        except Exception as e:
            print(f"Error checking storage: {e}")

        # Fallback to ElevenLabs API with retry (only if not found in storage)
        if not audio_url and not audio_content:
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    print(f"Fetching audio from ElevenLabs (Attempt {attempt+1}/{max_retries}): {conversation_id}")
                    audio_content = elevenlabs_service.get_audio(conversation_id)
                    break 
                except Exception as e:
                    print(f"Error processing audio (Attempt {attempt+1}): {e}")
                    if "404" in str(e) and attempt < max_retries - 1:
                        time.sleep(2) # Wait a bit for ElevenLabs to process
                    else:
                        break # Don't retry other errors or if max retries reached
        
        if audio_content and not audio_url:
            try:
                print(f"Uploading audio to bucket: {bucket_name}")
                
                # Upload using original name so we can find it easily if needed
                public_url_resp = await storage_service.upload_file(
                    file_content=audio_content, 
                    file_name=file_name, 
                    content_type="audio/mpeg",
                    bucket_name=bucket_name,
                    use_original_name=True
                )
                
                if isinstance(public_url_resp, dict) and 'publicUrl' in public_url_resp:
                        audio_url = public_url_resp['publicUrl']
                else:
                    audio_url = public_url_resp
                    
                print(f"Audio uploaded. URL: {audio_url}")
            except Exception as e:
                print(f"Error uploading audio to storage: {e}")
        elif not audio_url:
            print("Failed to retrieve audio content from any source.")

        # 2. Transcript Retrieval & Reliability
        transcript_data = []
        try:
            print(f"Fetching transcript for conversation: {conversation_id}")
            conv_data = elevenlabs_service.get_conversation(conversation_id)
            transcript_data = conv_data.get("transcript", [])
        except Exception as e:
            print(f"Error fetching transcript from ElevenLabs: {e}")
            if fallback_transcript:
                print("Using fallback transcript from client.")
                transcript_data = fallback_transcript
            else:
                print("No transcript available.")

        # 3. Strict ID Mapping & Formatting
        processed_transcript = []
        for item in transcript_data:
            # Handle different formats (ElevenLabs vs Client fallback)
            # ElevenLabs: role="agent"/"user", text="..."
            # Client Fallback: role="assistant"/"user", message="..." (mapped in frontend)
            
            role = item.get("role")
            text = item.get("text") or item.get("message") # Fallback key
            
            # Map role
            if role in ["agent", "assistant"]:
                msg_id = 1
                role_str = "agent" # Standardize on agent for DB ?? Or keep as is? User asked for id=1 for agent.
            else:
                msg_id = 0
                role_str = "user"
                
            # Skip empty messages if any
            if not text:
                continue
                
            processed_transcript.append({
                "id": msg_id,
                "role": role_str,
                "msg": text, # DB expects 'msg' based on user request example
                "date": item.get("time_in_call_secs") or item.get("timestamp") # Keep available timing info
            })
            
        # 4. Save to DB (Voice Sessions ONLY)
        print(f"Saving voice session with {len(processed_transcript)} messages.")
        
        target_conversation_id = conversation_id
        
        # If App ID provided, prioritize it and ensure conversation exists
        if app_conversation_id:
            print(f"Linking voice session to App Conversation ID: {app_conversation_id}")
            # Ensure the conversation exists in `conversations` table
            # We don't have a direct 'ensure_exists' method but create_conversation might handle it or we check first?
            # supabase_service.get_conversation returns None if not found.
            
            existing_conv = supabase_service.get_conversation(app_conversation_id)
            if not existing_conv:
                # Create it!
                print(f"Conversation {app_conversation_id} not found. Creating placeholder.")
                # We need a title. Use date or something generic.
                now = datetime.now()
                title = f"Conversación - {now.strftime('%H:%M')}"
                         
                # Create minimal conversation entry
                supabase_service.create_conversation(
                    user_id=user_id,
                    title=title,
                    initial_message=None, # Voice session has its own storage
                    conversation_id=app_conversation_id
                )
            
            target_conversation_id = app_conversation_id

        # Save Voice Session linked to the Target Conversation ID
        result = supabase_service.create_voice_session(
            user_id=user_id,
            transcript=processed_transcript,
            audio_url=audio_url,
            conversation_id=target_conversation_id 
        )
        
        return {
            "status": "success",
            "id": result.get("id"),
            "audio_url": audio_url,
            "message_count": len(processed_transcript)
        }

voice_service = VoiceService()
