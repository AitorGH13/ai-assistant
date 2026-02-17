from fastapi import Header, HTTPException, Depends
from typing import Optional
from uuid import UUID
from app.services.supabase_svc import supabase_service

async def get_current_user_id(authorization: Optional[str] = Header(None)) -> UUID:
    """
    Verifies the Supabase JWT token from the Authorization header 
    and returns the user ID.
    """
    if not authorization:
        # For development ease, we could allow a fallback if explicitly configured, 
        # but for "completing" the app, strict auth is better. 
        # However, to avoid breaking local dev if the user hasn't set up full auth flow perfectly:
        # strictly require auth but handle the error gracefully.
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    try:
        # Expecting format "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
            
        # Verify token using Supabase client
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
             raise HTTPException(status_code=401, detail="Invalid session token")
             
        return UUID(user_response.user.id)
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    except Exception as e:
        # Supabase client might raise errors for invalid tokens
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
