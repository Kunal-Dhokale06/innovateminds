import time
import json
import uuid
import httpx
from typing import Dict, Any, AsyncGenerator, List
from backend.app.config import settings
from backend.app.adapters.base import CompletionResponse
from backend.app.adapters.mock_adapter import UpstreamProviderError

class GeminiAdapter:
    def __init__(self):
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def _resolve_gemini_model_name(self, model_name: str) -> str:
        """Map legacy or aliased model names to available Google Generative AI models."""
        m = model_name.lower().strip()
        if m in ("gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest"):
            return m
        if "pro" in m:
            return "gemini-3.1-flash-lite"
        return "gemini-flash-lite-latest"

    def _translate_to_gemini(self, openai_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Translates OpenAI messages and tools to Gemini payload schema."""
        messages: List[Dict[str, Any]] = openai_payload.get("messages", [])
        system_texts = []
        contents = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                if isinstance(content, str):
                    system_texts.append(content)
                elif isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and "text" in part:
                            system_texts.append(part["text"])
                continue

            gemini_role = "user" if role == "user" else "model"
            parts = []

            if isinstance(content, str):
                parts.append({"text": content})
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        if part.get("type") == "text":
                            parts.append({"text": part.get("text", "")})
                        elif part.get("type") == "image_url":
                            img_obj = part.get("image_url", {})
                            url = img_obj.get("url", "")
                            if url.startswith("data:"):
                                try:
                                    meta, b64_data = url.split(",", 1)
                                    mime = meta.split(";")[0].replace("data:", "")
                                    parts.append({
                                        "inlineData": {
                                            "mimeType": mime,
                                            "data": b64_data
                                        }
                                    })
                                except Exception:
                                    pass
            if parts:
                contents.append({"role": gemini_role, "parts": parts})

        gemini_body: Dict[str, Any] = {"contents": contents}

        if system_texts:
            gemini_body["systemInstruction"] = {
                "parts": [{"text": "\n\n".join(system_texts)}]
            }

        generation_config: Dict[str, Any] = {}
        if "temperature" in openai_payload:
            generation_config["temperature"] = openai_payload["temperature"]
        if "max_tokens" in openai_payload:
            generation_config["maxOutputTokens"] = openai_payload["max_tokens"]
        if openai_payload.get("response_format", {}).get("type") == "json_object":
            generation_config["responseMimeType"] = "application/json"

        if generation_config:
            gemini_body["generationConfig"] = generation_config

        # Tools translation
        if "tools" in openai_payload:
            func_decls = []
            for t in openai_payload["tools"]:
                if t.get("type") == "function" and "function" in t:
                    func = t["function"]
                    func_decls.append({
                        "name": func.get("name"),
                        "description": func.get("description", ""),
                        "parameters": func.get("parameters", {})
                    })
            if func_decls:
                gemini_body["tools"] = [{"functionDeclarations": func_decls}]

        return gemini_body

    def _normalize_from_gemini(
        self,
        gemini_data: Dict[str, Any],
        model_name: str,
        elapsed_ms: float
    ) -> CompletionResponse:
        """Translates Gemini generateContent response into standard OpenAI schema."""
        candidates = gemini_data.get("candidates", [])
        content_text = ""
        tool_calls = []

        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            for p in parts:
                if "text" in p:
                    content_text += p["text"]
                elif "functionCall" in p:
                    fn = p["functionCall"]
                    tool_calls.append({
                        "id": f"call_{uuid.uuid4().hex[:8]}",
                        "type": "function",
                        "function": {
                            "name": fn.get("name"),
                            "arguments": json.dumps(fn.get("args", {}))
                        }
                    })

        usage_meta = gemini_data.get("usageMetadata", {})
        prompt_tokens = usage_meta.get("promptTokenCount", 0)
        completion_tokens = usage_meta.get("candidatesTokenCount", 0)
        total_tokens = prompt_tokens + completion_tokens

        msg: Dict[str, Any] = {"role": "assistant", "content": content_text}
        if tool_calls:
            msg["tool_calls"] = tool_calls

        payload = {
            "id": f"chatcmpl-gemini-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model_name,
            "choices": [
                {
                    "index": 0,
                    "message": msg,
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

    async def chat_completion(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> CompletionResponse:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            from backend.app.adapters.mock_adapter import mock_adapter
            return await mock_adapter.chat_completion(request_payload, model_name, timeout_ms, model_profile=model_profile)

        start_time = time.perf_counter()
        gemini_body = self._translate_to_gemini(request_payload)

        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }

        primary_model = self._resolve_gemini_model_name(model_name)
        candidates = [primary_model]
        for alt in ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest"]:
            if alt not in candidates:
                candidates.append(alt)

        timeout_sec = timeout_ms / 1000.0
        last_status = 502
        last_text = "All Gemini models failed"

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            for target_model in candidates:
                url = f"{self.base_url}/{target_model}:generateContent"
                try:
                    response = await client.post(url, headers=headers, json=gemini_body)
                    if response.status_code == 200:
                        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                        return self._normalize_from_gemini(response.json(), model_name, elapsed_ms)
                    else:
                        last_status = response.status_code
                        last_text = response.text
                except httpx.TimeoutException:
                    last_status = 504
                    last_text = f"Gemini upstream timeout after {timeout_ms}ms"
                except httpx.RequestError as e:
                    last_status = 502
                    last_text = f"Gemini connection error: {str(e)}"

        raise UpstreamProviderError(last_status, last_text)

    async def chat_completion_stream(
        self,
        request_payload: Dict[str, Any],
        model_name: str,
        timeout_ms: int,
        model_profile: Any = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            from backend.app.adapters.mock_adapter import mock_adapter
            async for chunk in mock_adapter.chat_completion_stream(request_payload, model_name, timeout_ms, model_profile=model_profile):
                yield chunk
            return

        gemini_body = self._translate_to_gemini(request_payload)
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }

        target_model = self._resolve_gemini_model_name(model_name)
        url = f"{self.base_url}/{target_model}:streamGenerateContent?alt=sse"
        timeout_sec = timeout_ms / 1000.0
        stream_id = f"chatcmpl-gemini-{uuid.uuid4().hex[:8]}"

        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            try:
                async with client.stream("POST", url, headers=headers, json=gemini_body) as resp:
                    if resp.status_code >= 400:
                        error_body = await resp.aread()
                        raise UpstreamProviderError(resp.status_code, error_body.decode("utf-8", "ignore"))

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        raw_json = line[6:]
                        if raw_json.strip() == "[DONE]":
                            break
                        try:
                            gem_chunk = json.loads(raw_json)
                            text = gem_chunk.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text:
                                openai_chunk = {
                                    "id": stream_id,
                                    "object": "chat.completion.chunk",
                                    "created": int(time.time()),
                                    "model": model_name,
                                    "choices": [{"index": 0, "delta": {"content": text}, "finish_reason": None}]
                                }
                                yield f"data: {json.dumps(openai_chunk)}\n\n"
                        except json.JSONDecodeError:
                            continue
            except httpx.TimeoutException:
                raise UpstreamProviderError(504, f"Gemini stream timeout after {timeout_ms}ms")
            except httpx.RequestError as e:
                raise UpstreamProviderError(502, f"Gemini stream error: {str(e)}")

        yield "data: [DONE]\n\n"

gemini_adapter = GeminiAdapter()
