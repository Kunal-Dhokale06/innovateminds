from typing import Dict, Any, AsyncGenerator, Protocol
from dataclasses import dataclass

@dataclass
class CompletionResponse:
    payload: Dict[str, Any]
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: float
    status_code: int = 200

class ProviderAdapter(Protocol):
    async def chat_completion(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int
    ) -> CompletionResponse:
        """Executes non-streaming completion."""
        ...

    async def chat_completion_stream(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int
    ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent Events strings formatted as 'data: {...}\\n\\n'."""
        ...
