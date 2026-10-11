from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: system, user, assistant, or tool")
    content: Optional[Any] = Field(None, description="String content or multipart list")
    name: Optional[str] = None
    tool_call_id: Optional[str] = None

class ChatCompletionRequest(BaseModel):
    model: str = Field(default="auto", description="Target model name, alias, or 'auto'")
    messages: List[ChatMessage] = Field(..., description="Conversation history")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0)
    stream: Optional[bool] = Field(default=False)
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[Any] = None
    response_format: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional uploaded file and document attachments")

    model_config = ConfigDict(extra="allow")

class SimulationConfigRequest(BaseModel):
    target_model: str
    simulated_latency_ms: Optional[float] = None
    injected_error_code: Optional[int] = None
    is_active: Optional[bool] = None

class RuleCreateRequest(BaseModel):
    name: str
    max_budget_usd: Optional[float] = None
    max_latency_sla_ms: Optional[float] = None
    min_capability: Optional[float] = 0.0
    preference: str = "balanced"
    weight_cost: float = 0.40
    weight_latency: float = 0.30
    weight_quality: float = 0.30
    is_default: bool = False
