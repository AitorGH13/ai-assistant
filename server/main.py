from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import chat, voice, auth
import uvicorn

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)

# Include Routers
app.include_router(chat.router, prefix="/api")
app.include_router(voice.router, prefix="/api")

@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Assistant API (Refactored)"}

if __name__ == "__main__":
    print("[INFO] Server running at http://localhost:3001")
    uvicorn.run(app, host="0.0.0.0", port=3001)
