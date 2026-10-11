import time
import httpx
from typing import Dict, Any, AsyncGenerator
from backend.app.config import settings
from backend.app.adapters.base import CompletionResponse
from backend.app.adapters.mock_adapter import UpstreamProviderError

class OpenAIAdapter:
    def __init__(self):
        self.base_url = "https://api.openai.com/v1"

    async def chat_completion(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> CompletionResponse:
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            # Fallback to simulated response if no live key configured
            from backend.app.adapters.mock_adapter import mock_adapter
            return await mock_adapter.chat_completion(request_payload, model_name, timeout_ms, model_profile=model_profile)

        start_time = time.perf_counter()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Ensure correct model name is passed to upstream
        payload = dict(request_payload)
        payload["model"] = model_name
        payload.pop("stream", None)

        timeout_sec = timeout_ms / 1000.0

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
            except httpx.TimeoutException:
                raise UpstreamProviderError(504, f"OpenAI upstream socket timeout after {timeout_ms}ms")
            except httpx.RequestError as e:
                raise UpstreamProviderError(502, f"OpenAI connection error: {str(e)}")

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        if response.status_code >= 400:
            raise UpstreamProviderError(response.status_code, response.text)

        data = response.json()
        usage = data.get("usage", {})

        return CompletionResponse(
            payload=data,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            latency_ms=elapsed_ms,
            status_code=response.status_code
        )

    async def chat_completion_stream(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            from backend.app.adapters.mock_adapter import mock_adapter
            async for chunk in mock_adapter.chat_completion_stream(request_payload, model_name, timeout_ms, model_profile=model_profile):
                yield chunk
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = dict(request_payload)
        payload["model"] = model_name
        payload["stream"] = True

        timeout_sec = timeout_ms / 1000.0

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                ) as stream_resp:
                    if stream_resp.status_code >= 400:
                        error_body = await stream_resp.aread()
                        raise UpstreamProviderError(stream_resp.status_code, error_body.decode("utf-8", "ignore"))

                    async for line in stream_resp.aiter_lines():
                        if line:
                            yield f"{line}\n\n"
            except httpx.TimeoutException:
                raise UpstreamProviderError(504, f"OpenAI stream timeout after {timeout_ms}ms")
            except httpx.RequestError as e:
                raise UpstreamProviderError(502, f"OpenAI stream connection drop: {str(e)}")

openai_adapter = OpenAIAdapter()
