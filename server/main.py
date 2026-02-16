from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import asyncio

from app.core.config import settings
from app.routers import chat, voice, search # Import routers including search

app = FastAPI(title="AI Assistant API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(chat.router, prefix="/api")
app.include_router(voice.router, prefix="/api") # Include voice router with /api prefix so it becomes /api/voice
app.include_router(search.router, prefix="/api") # Include search router

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
