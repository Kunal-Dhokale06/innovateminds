import time
import base64
import urllib.parse
import httpx
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from backend.app.config import settings
from backend.app.adapters.mock_adapter import UpstreamProviderError

@dataclass
class ImageGenerationResponse:
    url: str
    b64_json: Optional[str]
    model_name: str
    provider: str
    latency_ms: float
    width: int
    height: int

class ImageGenerationAdapter:
    """
    Multi-provider Text-to-Image Generation Adapter.
    Supports Flux (high-speed photorealism), Google Gemini, and OpenAI DALL-E.
    """

    async def generate_flux(self, prompt: str, width: int = 1024, height: int = 1024) -> ImageGenerationResponse:
        start_time = time.perf_counter()
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={int(time.time())}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise UpstreamProviderError(resp.status_code, f"Flux generation failed: {resp.text[:150]}")

            img_bytes = resp.content
            b64_data = base64.b64encode(img_bytes).decode("utf-8")
            elapsed = (time.perf_counter() - start_time) * 1000.0

            return ImageGenerationResponse(
                url=url,
                b64_json=b64_data,
                model_name="flux-schnell",
                provider="flux",
                latency_ms=elapsed,
                width=width,
                height=height
            )

    async def generate_gemini(self, prompt: str, width: int = 1024, height: int = 1024) -> ImageGenerationResponse:
        start_time = time.perf_counter()
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise UpstreamProviderError(401, "Google Gemini API key not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                for cand in data.get("candidates", []):
                    for part in cand.get("content", {}).get("parts", []):
                        if "inlineData" in part:
                            b64 = part["inlineData"].get("data")
                            mime = part["inlineData"].get("mimeType", "image/png")
                            elapsed = (time.perf_counter() - start_time) * 1000.0
                            return ImageGenerationResponse(
                                url=f"data:{mime};base64,{b64}",
                                b64_json=b64,
                                model_name="gemini-2.5-flash-image",
                                provider="gemini",
                                latency_ms=elapsed,
                                width=width,
                                height=height
                            )
            raise UpstreamProviderError(resp.status_code, f"Gemini Image error: {resp.text[:150]}")

    async def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        width: int = 1024,
        height: int = 1024
    ) -> ImageGenerationResponse:
        target = (model or "auto").lower()

        # Try specified provider or auto failover chain
        candidates = []
        if "gemini" in target:
            candidates = [self.generate_gemini, self.generate_flux]
        elif "flux" in target or "auto" in target or not model:
            candidates = [self.generate_flux, self.generate_gemini]
        else:
            candidates = [self.generate_flux]

        last_err = None
        for fn in candidates:
            try:
                return await fn(prompt, width, height)
            except Exception as err:
                last_err = err
                continue

        raise UpstreamProviderError(500, f"All image generation providers failed: {str(last_err)}")

image_adapter = ImageGenerationAdapter()
