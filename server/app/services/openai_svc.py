from openai import OpenAI
from app.core.config import settings
from app.models.chat import ChatMessage
from app.services.tools_svc import tools_service
from typing import List, AsyncGenerator
import json
import asyncio

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
            # Pydantic .dict() handles nested models or basic types well
            msg_dict = m.dict()
            # Ensure content is string if needed? ChatMessage allows list for multimodal.
            # OpenAI handles array content for multimodal if structured correctly.
            conversation_input.append(msg_dict)

        # Get available tools
        tools = tools_service.get_tool_definitions()
        
        # Initial call
        stream = self.client.chat.completions.create(
            model=model,
            messages=conversation_input,
            tools=tools if tools else None,
            tool_choice="auto" if tools else None,
            stream=True,
        )

        tool_calls = []
        full_response_content = ""

        # Process the stream
        for chunk in stream:
            if not chunk.choices:
                continue
                
            delta = chunk.choices[0].delta
            
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if len(tool_calls) <= tc.index:
                        tool_calls.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    
                    tool_call = tool_calls[tc.index]
                    
                    if tc.id:
                        tool_call["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_call["function"]["name"] = tc.function.name
                        if tc.function.arguments:
                            tool_call["function"]["arguments"] += tc.function.arguments

            if delta.content:
                content = delta.content
                full_response_content += content
                yield f"data: {json.dumps({'content': content})}\n\n"

        # If we had tool calls, we need to execute them and call again
        if tool_calls:
             print(f"DEBUG: Tool calls detected: {len(tool_calls)}")
             
             # Add the assistant's message with tool calls to history
             # OpenAI expects the assistant message to have tool_calls field.
             # Note: content cannot be empty string if tool_calls is present? 
             # OpenAI API allows content=None if tool_calls is present.
             assistant_msg = {
                 "role": "assistant",
                 "content": full_response_content if full_response_content else None,
                 "tool_calls": tool_calls
             }
             conversation_input.append(assistant_msg)
             
             # Execute each tool
             for tool_call in tool_calls:
                 function_name = tool_call["function"]["name"]
                 arguments_str = tool_call["function"]["arguments"]
                 tool_result_content = ""
                 tool_call_id = tool_call["id"]
                 
                 try:
                     # Parse arguments
                     if not arguments_str:
                         arguments = {}
                     else:
                         arguments = json.loads(arguments_str)
                     
                     print(f"Executing tool: {function_name} with args: {arguments}")
                     
                     # Execute tool via service
                     result = await tools_service.execute_tool(function_name, arguments)
                     
                     # Ensure result is string
                     if isinstance(result, str):
                         tool_result_content = result
                     else:
                         tool_result_content = json.dumps(result)
                         
                 except Exception as e:
                     print(f"Error executing tool {function_name}: {e}")
                     tool_result_content = json.dumps({"error": str(e)})

                 conversation_input.append({
                     "tool_call_id": tool_call_id,
                     "role": "tool",
                     "name": function_name,
                     "content": tool_result_content
                 })
             
             # Signal that tools were used so frontend can show badge
             yield f"data: {json.dumps({'tool_used': True})}\n\n"

             # Second call to OpenAI with tool outputs
             stream_2 = self.client.chat.completions.create(
                model=model,
                messages=conversation_input,
                stream=True
             )
             
             for chunk in stream_2:
                if chunk.choices and chunk.choices[0].delta.content:
                    content_2 = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'content': content_2})}\n\n"

        yield "data: [DONE]\n\n"

openai_service = OpenAIService()
