from openai import OpenAI
from app.core.config import settings
from app.models.chat import ChatMessage
from typing import List, AsyncGenerator
import json

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    async def stream_chat(self, messages: List[ChatMessage], model: str = "gpt-4o-mini", system_prompt: str = None) -> AsyncGenerator[str, None]:
        conversation_input = []
        
        if system_prompt:
            conversation_input.append({"role": "system", "content": system_prompt})
        else:
            default_prompt = "Por defecto responderás siempre en español, a menos que el usuario te hable en otro idioma o te pida explícitamente lo contrario."
            conversation_input.append({"role": "system", "content": default_prompt})

        for m in messages:
            conversation_input.append(m.dict())

        stream = self.client.chat.completions.create(
            model=model,
            messages=conversation_input,
            stream=True,
        )

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield f"data: {json.dumps({'content': content})}\n\n"
        
        yield "data: [DONE]\n\n"

openai_service = OpenAIService()
