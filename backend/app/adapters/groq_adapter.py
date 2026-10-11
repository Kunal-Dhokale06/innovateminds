import time
import httpx
from typing import Dict, Any, AsyncGenerator
from backend.app.config import settings
from backend.app.adapters.base import CompletionResponse
from backend.app.adapters.mock_adapter import UpstreamProviderError

class GroqAdapter:
    def __init__(self):
        self.base_url = "https://api.groq.com/openai/v1"

    def _resolve_groq_model_name(self, model_name: str) -> str:
        """Map requested model alias to active, verified Groq models."""
        m = model_name.lower().strip()
        if "120b" in m or "flagship" in m:
            return "openai/gpt-oss-120b"
        if "27b" in m or "qwen" in m:
            return "qwen/qwen3.8-27b"
        if "20b" in m or "fast" in m or "cheap" in m:
            return "openai/gpt-oss-20b"
        if m in ("openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"):
            return m
        return "openai/gpt-oss-120b"

    async def chat_completion(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> CompletionResponse:
        api_key = settings.GROQ_API_KEY
        if not api_key:
            from backend.app.adapters.mock_adapter import mock_adapter
            return await mock_adapter.chat_completion(request_payload, model_name, timeout_ms, model_profile=model_profile)

        start_time = time.perf_counter()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        primary_model = self._resolve_groq_model_name(model_name)
        candidates = [primary_model]
        for alt in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
            if alt not in candidates:
                candidates.append(alt)

        timeout_sec = timeout_ms / 1000.0
        last_status = 502
        last_text = "All Groq model attempts failed"

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            for target_model in candidates:
                payload = dict(request_payload)
                payload["model"] = target_model
                payload.pop("stream", None)
                payload.pop("attachments", None)

                # Clean message contents if they have multimodal structures
                clean_messages = []
                for msg in payload.get("messages", []):
                    c = msg.get("content", "")
                    if isinstance(c, list):
                        text_parts = [part["text"] for part in c if isinstance(part, dict) and part.get("type") == "text"]
                        clean_messages.append({"role": msg.get("role", "user"), "content": " ".join(text_parts)})
                    else:
                        clean_messages.append(msg)
                payload["messages"] = clean_messages

                try:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    if response.status_code == 200:
                        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
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
                    else:
                        last_status = response.status_code
                        last_text = response.text
                except httpx.TimeoutException:
                    last_status = 504
                    last_text = f"Groq upstream timeout after {timeout_ms}ms"
                except httpx.RequestError as e:
                    last_status = 502
                    last_text = f"Groq connection error: {str(e)}"

        raise UpstreamProviderError(last_status, last_text)

    async def chat_completion_stream(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        api_key = settings.GROQ_API_KEY
        if not api_key:
            from backend.app.adapters.mock_adapter import mock_adapter
            async for chunk in mock_adapter.chat_completion_stream(request_payload, model_name, timeout_ms, model_profile=model_profile):
                yield chunk
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        primary_model = self._resolve_groq_model_name(model_name)
        candidates = [primary_model, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
        timeout_sec = timeout_ms / 1000.0

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            for target_model in candidates:
                payload = dict(request_payload)
                payload["model"] = target_model
                payload["stream"] = True
                payload.pop("attachments", None)

                clean_messages = []
                for msg in payload.get("messages", []):
                    c = msg.get("content", "")
                    if isinstance(c, list):
                        text_parts = [part["text"] for part in c if isinstance(part, dict) and part.get("type") == "text"]
                        clean_messages.append({"role": msg.get("role", "user"), "content": " ".join(text_parts)})
                    else:
                        clean_messages.append(msg)
                payload["messages"] = clean_messages

                try:
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload
                    ) as resp:
                        if resp.status_code >= 400:
                            continue

                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            yield f"{line}\n\n"
                        return
                except (httpx.TimeoutException, httpx.RequestError):
                    continue

        raise UpstreamProviderError(503, "All Groq streaming attempts failed")

groq_adapter = GroqAdapter()
