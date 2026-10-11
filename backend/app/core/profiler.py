from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import re
from backend.app.core.tokenizer import tokenizer_estimator

@dataclass
class RequestProfile:
    task_type: str                   # "code", "math", "extraction", "summarization", "general", "vision"
    requested_format: str            # "json_object", "text", "tools"
    modalities: List[str]            # ["text"], ["text", "image"], ["text", "document"]
    prompt_tokens_est: int
    completion_tokens_est: int
    required_context_tokens: int
    budget_max_usd: Optional[float]
    latency_sla_ms: Optional[float]
    min_capability: float
    preference: str                  # "cost_first", "latency_first", "quality_first", "balanced"
    requires_tools: bool
    requires_json: bool
    requires_vision: bool
    attachment_tokens_est: int
    allow_unverified: bool
    requested_model: Optional[str]
    is_auto_classified: bool = False
    classification_confidence: float = 1.0


class RequestProfiler:
    """
    Profiles incoming chat completion requests according to industry standards.
    Separates task classification from policy enforcement:
    Model-generated task classifications never override client-specified constraints.
    """

    CODE_PATTERNS = [
        re.compile(r"\b(def|class|function|import|export|const|let|var|return|sql|select|insert|update|delete|table|regex|algorithm|refactor|debug|compile|syntax)\b", re.I),
        re.compile(r"```[a-z0-9_-]*\n", re.I),
        re.compile(r"[{};()\[\]=><]{3,}")
    ]

    MATH_PATTERNS = [
        re.compile(r"\b(calculate|solve|equation|integral|derivative|matrix|probability|theorem|arithmetic|proof|formula)\b", re.I),
        re.compile(r"[0-9]+(\.[0-9]+)?\s*[\+\-\*\/\^]\s*[0-9]+"),
        re.compile(r"\\\[.*\\\]|\\\(.*\\\)")
    ]

    EXTRACTION_PATTERNS = [
        re.compile(r"\b(extract|parse|schema|json|csv|entities|key-value|structured|fields|attributes|tabular)\b", re.I),
        re.compile(r"\{[\s\S]*\"[a-zA-Z0-9_-]+\"\s*:\s*[\s\S]*\}")
    ]

    SUMMARIZATION_PATTERNS = [
        re.compile(r"\b(summarize|summary|tl;?dr|abstract|digest|bullet points|brief overview)\b", re.I)
    ]

    @classmethod
    def classify_task_content(cls, text: str) -> str:
        """Infer task domain from textual semantics if client header is omitted."""
        if not text:
            return "general"
        
        t = text.lower()
        # Code match
        code_score = sum(1 for p in cls.CODE_PATTERNS if p.search(text))
        if code_score >= 1 or "python" in t or "javascript" in t or "code" in t:
            return "code"

        # Math match
        math_score = sum(1 for p in cls.MATH_PATTERNS if p.search(text))
        if math_score >= 1:
            return "math"

        # Extraction match
        extraction_score = sum(1 for p in cls.EXTRACTION_PATTERNS if p.search(text))
        if extraction_score >= 1 or "json" in t:
            return "extraction"

        # Summarization match
        summarization_score = sum(1 for p in cls.SUMMARIZATION_PATTERNS if p.search(text))
        if summarization_score >= 1:
            return "summarization"

        return "general"

    @classmethod
    def profile_request(
        cls,
        messages: List[Dict[str, Any]],
        max_tokens: Optional[int] = None,
        tools: Optional[List[Any]] = None,
        response_format: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Any]] = None,
        client_budget_max: Optional[float] = None,
        client_latency_sla_ms: Optional[float] = None,
        client_min_capability: Optional[float] = None,
        client_preference: Optional[str] = None,
        client_task_type: Optional[str] = None,
        allow_unverified: bool = False,
        requested_model: Optional[str] = None,
        attachment_tokens_est: int = 0,
        has_images: bool = False,
        has_documents: bool = False
    ) -> RequestProfile:
        # 1. Modalities
        modalities = ["text"]
        if has_documents:
            modalities.append("document")
        if has_images:
            modalities.append("image")

        # 2. Vision & Tools & JSON requirements
        requires_vision = has_images
        if not requires_vision:
            for msg in messages:
                c = msg.get("content")
                if isinstance(c, list):
                    for part in c:
                        if isinstance(part, dict) and part.get("type") == "image_url":
                            requires_vision = True
                            if "image" not in modalities:
                                modalities.append("image")
                            break

        requires_tools = bool(tools and len(tools) > 0)
        requires_json = bool(response_format and response_format.get("type") == "json_object")

        # 3. Task type determination
        is_auto_classified = False
        confidence = 1.0
        
        if client_task_type and client_task_type.strip().lower() not in ("general", "auto", ""):
            task_type = client_task_type.strip().lower()
        else:
            # Extract combined user text for heuristic inference
            combined_text = ""
            for msg in messages:
                if msg.get("role") == "user":
                    content = msg.get("content")
                    if isinstance(content, str):
                        combined_text += " " + content
                    elif isinstance(content, list):
                        for p in content:
                            if isinstance(p, dict) and p.get("type") == "text":
                                combined_text += " " + p.get("text", "")
            
            if requires_vision:
                task_type = "vision"
                confidence = 0.95
            elif requires_json:
                task_type = "extraction"
                confidence = 0.95
            elif requires_tools:
                task_type = "code"
                confidence = 0.85
            else:
                task_type = cls.classify_task_content(combined_text)
                confidence = 0.80
                is_auto_classified = True

        # Map preference aliases
        pref = (client_preference or "balanced").strip().lower()
        if pref in ("cost", "cost_first"):
            pref = "cost"
        elif pref in ("latency", "latency_first", "speed", "speed_first"):
            pref = "latency"
        elif pref in ("quality", "quality_first"):
            pref = "quality"
        else:
            pref = "balanced"

        # 4. Context & Token Estimation
        p_tokens = tokenizer_estimator.estimate_prompt_tokens(messages) + attachment_tokens_est
        c_tokens = tokenizer_estimator.estimate_completion_tokens(max_tokens)
        required_context = p_tokens + c_tokens

        requested_format = "json_object" if requires_json else ("tools" if requires_tools else "text")

        return RequestProfile(
            task_type=task_type,
            requested_format=requested_format,
            modalities=modalities,
            prompt_tokens_est=p_tokens,
            completion_tokens_est=c_tokens,
            required_context_tokens=required_context,
            budget_max_usd=client_budget_max,
            latency_sla_ms=client_latency_sla_ms,
            min_capability=client_min_capability if client_min_capability is not None else 0.0,
            preference=pref,
            requires_tools=requires_tools,
            requires_json=requires_json,
            requires_vision=requires_vision,
            attachment_tokens_est=attachment_tokens_est,
            allow_unverified=allow_unverified,
            requested_model=requested_model,
            is_auto_classified=is_auto_classified,
            classification_confidence=confidence
        )

request_profiler = RequestProfiler()
