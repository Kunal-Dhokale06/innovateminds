import asyncio
import time
import json
import uuid
from typing import Dict, Any, AsyncGenerator
from backend.app.adapters.base import CompletionResponse

class UpstreamProviderError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message

class MockProviderAdapter:
    def __init__(self):
        pass

    def _check_injected_error(self, model_name: str, model_profile: Dict[str, Any] | None = None):
        injected_code = None
        if model_profile and "injected_error_code" in model_profile:
            injected_code = model_profile["injected_error_code"]
        
        # Check model name patterns
        if "429" in model_name or injected_code == 429:
            raise UpstreamProviderError(429, "Rate limit exceeded (Simulated HTTP 429)")
        if "500" in model_name or injected_code == 500:
            raise UpstreamProviderError(500, "Internal server error (Simulated HTTP 500)")
        if "503" in model_name or injected_code == 503:
            raise UpstreamProviderError(503, "Service unavailable (Simulated HTTP 503)")
        if "504" in model_name or injected_code == 504:
            raise UpstreamProviderError(504, "Gateway timeout (Simulated HTTP 504)")

    async def chat_completion(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Dict[str, Any] | None = None
    ) -> CompletionResponse:
        start_time = time.perf_counter()

        # Check for simulated errors
        self._check_injected_error(model_name, model_profile)

        # Check for simulated latency
        sim_latency = 0.05  # Default fast latency for tests
        if model_profile and "baseline_p95_latency_ms" in model_profile:
            # Scale down for test speed unless simulated explicitly
            sim_latency = min(0.3, model_profile["baseline_p95_latency_ms"] / 1000.0)

        await asyncio.sleep(sim_latency)

        messages = request_payload.get("messages", [])
        last_msg = messages[-1].get("content", "") if messages else "Hello"

        num_images = 0
        text_parts = []
        if isinstance(last_msg, list):
            for part in last_msg:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        text_parts.append(part.get("text", ""))
                    elif part.get("type") == "image_url":
                        num_images += 1
            prompt_str = " ".join(text_parts)
        else:
            prompt_str = str(last_msg)

        low_p = prompt_str.lower()
        if "two-sum" in low_p or "two sum" in low_p:
            reply_content = """def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []

# Complexity: O(n) Time | O(n) Space"""
        elif "fibonacci" in low_p:
            reply_content = """def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b"""
        elif "capital of france" in low_p:
            reply_content = "The capital of France is Paris."
        elif "lock" in low_p and ("optimistic" in low_p or "pessimistic" in low_p):
            reply_content = """Optimistic locking assumes conflicts are rare, checking a version column at commit time without holding DB locks.
Pessimistic locking uses 'SELECT ... FOR UPDATE' to acquire an exclusive lock immediately, preventing concurrent modifications until transaction commit."""
        elif "square root" in low_p and "144" in low_p:
            reply_content = "12"
        elif "feedback" in low_p and "3-word" in low_p:
            reply_content = "Fast, smooth app."
        elif "poem" in low_p or "rhyme" in low_p:
            reply_content = """Whispers of light through velvet skies,
Where silent worlds in wonder rise.
Stars that drift and comets gleam,
Floating in an endless dream."""
        elif "hello" in low_p or "hi" in low_p or "hey" in low_p:
            reply_content = "Hello! I am ready to assist you. How can I help with your project or inquiry today?"
        elif "analyze" in low_p or "summarize" in low_p or "specification" in low_p or "spec" in low_p:
            reply_content = f"Analysis Summary:\n• Processed request context ({len(prompt_str)} characters).\n• Key requirements identified: reliability, low-latency routing, and multi-model failover.\n• System constraints verified and ready for execution."
        elif num_images > 0:
            reply_content = f"Visual analysis complete for {num_images} attachment(s). Detected clean UI components, validated color contrast ratios, and structured elements."
        else:
            reply_content = f"Thank you for your prompt. Here is the response generated for '{prompt_str[:60]}...':\n\nThe requested operation was processed successfully under optimal routing parameters. All constraints and performance budgets were satisfied."

        prompt_tokens = max(10, len(prompt_str) // 4 + (num_images * 800))
        completion_tokens = max(15, len(reply_content) // 4)
        total_tokens = prompt_tokens + completion_tokens

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        payload = {
            "id": f"chatcmpl-mock-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model_name,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": reply_content
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens
            }
        }

        return CompletionResponse(
            payload=payload,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=elapsed_ms,
            status_code=200
        )

    async def chat_completion_stream(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        # Pre-stream error check: if error occurs before first chunk, it raises immediately
        self._check_injected_error(model_name, model_profile)

        chunks = ["ModelRouter ", "Mock ", "Streaming ", "Response ", "Complete."]
        stream_id = f"chatcmpl-mock-{uuid.uuid4().hex[:8]}"

        for i, token in enumerate(chunks):
            # Check for simulated mid-stream connection drop
            if "mid-error" in model_name and i == 2:
                raise UpstreamProviderError(500, "Connection dropped mid-stream (Simulated error)")

            await asyncio.sleep(0.02)
            chunk_data = {
                "id": stream_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model_name,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": token} if i > 0 else {"role": "assistant", "content": token},
                        "finish_reason": "stop" if i == len(chunks) - 1 else None
                    }
                ]
            }
            yield f"data: {json.dumps(chunk_data)}\n\n"

        yield "data: [DONE]\n\n"

mock_adapter = MockProviderAdapter()
