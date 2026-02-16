from fastapi import Header, HTTPException, Depends
from typing import Optional
from uuid import UUID

# For now, we'll iterate on this. 
# Ideally, we should verify a JWT token from Supabase Auth.
# To keep it simple for the refactor, we accept a user_id header 
# or default to a hardcoded "demo" user if not provided (for development).

DEMO_USER_ID = UUID('00000000-0000-0000-0000-000000000000')

async def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> UUID:
    if x_user_id:
        try:
            return UUID(x_user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid X-User-Id header format")
    
    # Fallback for dev/demo
    return DEMO_USER_ID
