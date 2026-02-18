from supabase import create_client, Client
from app.core.config import settings
import uuid
from typing import Optional

class StorageService:
    def __init__(self):
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        self.bucket = "chat-assets" # Make sure this bucket exists in Supabase

    async def upload_file(self, file_content: bytes, file_name: str, content_type: str, bucket_name: Optional[str] = None, use_original_name: bool = False) -> str:
        """
        Uploads a file to Supabase Storage and returns the public URL.
        """
        target_bucket = bucket_name if bucket_name else self.bucket
        
        if use_original_name:
            path = f"uploads/{file_name}"
        else:
            file_ext = file_name.split(".")[-1] if "." in file_name else "bin"
            unique_name = f"{uuid.uuid4()}.{file_ext}"
            path = f"uploads/{unique_name}"

        response = self.client.storage.from_(target_bucket).upload(
            path=path,
            file=file_content,
            file_options={"content-type": content_type}
        )
        
        # In newer supabase-py versions, upload might not return the URL directly,
        # so we construct it or use get_public_url
        public_url_response = self.client.storage.from_(target_bucket).get_public_url(path)
        return public_url_response

    def list_files(self, bucket_name: str, path: Optional[str] = None) -> List[Any]:
        """
        Lists files in a bucket, optionally filtering by path prefix.
        """
        try:
            res = self.client.storage.from_(bucket_name).list(path)
            return res
        except Exception as e:
            print(f"Error listing files in storage: {e}")
            return []

    def get_public_url(self, bucket_name: str, path: str) -> str:
        """
        Get public URL for a file.
        """
        return self.client.storage.from_(bucket_name).get_public_url(path)

storage_service = StorageService()
