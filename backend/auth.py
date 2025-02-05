from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase.client import Client
from .db import supabase

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Validate JWT token and return user_id.
    Raises HTTPException if token is invalid.
    """
    try:
        # Get the JWT token from the Authorization header
        token = credentials.credentials
        
        # Verify the token with Supabase
        user = supabase.auth.get_user(token)
        
        if not user or not user.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )
        
        return user.user.id
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        ) 