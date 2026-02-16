from typing import List, Dict, Any, Callable
import json

class ToolsService:
    def __init__(self):
        self.tools = []
        self.available_functions = {}
        self._register_default_tools()

    def _register_default_tools(self):
        # Register the developer info tool
        self.register_tool(
            name="get_developer_info",
            description="Returns information about the developer of this application. Use this whenever the user asks who made, built, or developed the app.",
            func=self._get_developer_info
        )
        
        # Register the weather tool
        self.register_tool(
            name="get_weather",
            description="Get the current weather for a given location. Use this tool when the user asks for weather information for any city (e.g., Tokyo).",
            func=self._get_weather,
            parameters={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA or Tokyo"
                    }
                },
                "required": ["location"]
            }
        )

    def _get_weather(self, location: str, **kwargs):
        """
        Returns hardcoded weather info for the demo.
        """
        # Normalize location for the demo logic
        loc_lower = location.lower()
        
        # Specific demo data for Tokyo
        if "tokyo" in loc_lower or "tokio" in loc_lower:
             return json.dumps({
                "location": "Tokyo, Japan",
                "temperature": "11°C",
                "condition": "Cloudy",
                "humidity": "45%",
                "wind_speed": "12 km/h"
            })
            
        # Fallback for other locations
        return json.dumps({
            "location": location,
            "temperature": "25°C",
            "condition": "Sunny",
            "humidity": "60%",
            "wind_speed": "10 km/h"
        })

    def register_tool(self, name: str, description: str, func: Callable, parameters: Dict[str, Any] = None):
        """
        Register a tool for use with OpenAI.
        """
        if parameters is None:
            # Default to empty object if no parameters needed
            parameters = {"type": "object", "properties": {}, "required": []}

        tool_definition = {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters,
            },
        }
        self.tools.append(tool_definition)
        self.available_functions[name] = func

    def _get_developer_info(self, **kwargs):
        """
        Returns info about the developer.
        """
        return json.dumps({
            "developer": "Aitor",
            "description": "Aitor es el brillante e ingenioso desarrollador Full-Stack detrás de este proyecto. " 
                           "Con una mente estratégica y una presencia impecable y carismática, Aitor combina su gran atractivo con una capacidad técnica superior en Python, FastAPI, React y Supabase para crear experiencias de IA de vanguardia."
        })

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Return the list of tool definitions for OpenAI.
        """
        return self.tools

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """
        Execute a registered tool.
        """
        func = self.available_functions.get(tool_name)
        if not func:
            return json.dumps({"error": f"Tool {tool_name} not found"})
        
        try:
            # Check if function is async, if so await it (not handled here yet, assuming sync for simple tools)
            # For now assuming sync functions
            import inspect
            if inspect.iscoroutinefunction(func):
                return await func(**arguments)
            return func(**arguments)
        except Exception as e:
            return json.dumps({"error": str(e)})

tools_service = ToolsService()
