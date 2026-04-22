import time
from typing import Any, Dict

from app.schemas import AgentDefinitionTool
from app.utils.schema_validator import validate_payload_against_schema

class ToolAdapter:    
    def __init__(self, tools: Dict[str, AgentDefinitionTool]):
        self.tools = tools
        self.executors = {
            "Weather API": self._execute_weather_api,
            "News API": self._execute_news_api,
        }
    
    def validate_params(self, tool_name: str, params: Dict[str, Any]) -> bool:
        if tool_name not in self.tools:
            return False

        if not isinstance(params, dict):
            return False
        
        tool_def = self.tools[tool_name]
        input_schema = tool_def.input_schema

        try:
            validate_payload_against_schema(input_schema, params)
            return True
        except ValueError:
            return False

    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Any:
        if tool_name not in self.executors:
            raise NotImplementedError(
                f"No executor configured for tool '{tool_name}'. "
                "Register an executor before invoking this tool."
            )

        executor = self.executors[tool_name]
        return executor(params)
    
    def invoke_tool(
        self,
        tool_name: str,
        params: Dict[str, Any],
        interception_hook: callable
    ) -> Dict[str, Any]:
        if tool_name not in self.tools:
            raise ValueError(f"Tool not found: {tool_name}")
        
        if not self.validate_params(tool_name, params):
            raise ValueError(f"Invalid parameters for tool: {tool_name}")
        
        # Get tool_id for interception
        tool_def = self.tools[tool_name]
        tool_id = tool_def.id
        
        # Pre-execution interception
        start_time = time.time()
        interception_decision = interception_hook(tool_name, params, tool_id)
        
        # Handle enforcement decisions
        if interception_decision.decision == "block":
            return {
                "success": False,
                "tool": tool_name,
                "error": f"Tool execution blocked: {interception_decision.reason}",
                "blocked": True,
                "duration_ms": (time.time() - start_time) * 1000
            }
        
        if interception_decision.decision == "pause":
            return {
                "success": False,
                "tool": tool_name,
                "error": f"Tool execution paused: {interception_decision.reason}",
                "paused": True,
                "duration_ms": (time.time() - start_time) * 1000
            }
        
        try:
            result = self.execute_tool(tool_name, params)
            duration = (time.time() - start_time) * 1000
            
            return {
                "success": True,
                "tool": tool_name,
                "result": result,
                "duration_ms": duration
            }
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            # Never silently swallow errors
            return {
                "success": False,
                "tool": tool_name,
                "error": str(e),
                "duration_ms": duration
            }

    def _execute_weather_api(self, params: Dict[str, Any]) -> Dict[str, Any]:
        city = str(params.get("city", "")).strip()
        if not city:
            raise ValueError("'city' is required")

        return {
            "city": city,
            "temperature_c": 18,
            "condition": "clear",
            "unit": "celsius",
            "reply": f"The weather in {city} is 18 degrees Celsius.",
        }

    def _execute_news_api(self, params: Dict[str, Any]) -> Dict[str, Any]:
        topic = str(params.get("topic", "")).strip()
        if not topic:
            raise ValueError("'topic' is required")

        headlines = [
            f"{topic.title()}: local team announces product milestone",
            f"{topic.title()}: analysts report steady adoption",
            f"{topic.title()}: community event scheduled this week",
        ]
        return {
            "topic": topic,
            "headlines": headlines,
            "reply": f"Top headlines for {topic}: " + "; ".join(headlines),
        }
