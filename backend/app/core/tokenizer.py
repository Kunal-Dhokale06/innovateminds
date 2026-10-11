import math
from typing import List, Dict, Any

class TokenizerEstimator:
    @staticmethod
    def estimate_prompt_tokens(messages: List[Dict[str, Any]]) -> int:
        """
        Conservative pre-flight prompt token estimation:
        Calculates character length across all message roles and content,
        dividing by 3.5 and applying a 1.15 conservative multiplier to avoid
        underestimating token counts across varying BPE tokenizers.
        """
        total_chars = 0
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, str):
                total_chars += len(content)
            elif isinstance(content, list):
                # Multimodal or multipart text
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        total_chars += len(part["text"])
            
            # Count role and function name overhead
            total_chars += len(str(msg.get("role", "")))
            if "name" in msg:
                total_chars += len(str(msg["name"]))

        if total_chars == 0:
            return 1
            
        conservative_count = math.ceil((total_chars / 3.5) * 1.15)
        return max(1, conservative_count)

    @staticmethod
    def estimate_completion_tokens(max_tokens: int | None) -> int:
        """Returns max_tokens if provided, otherwise default upper bound of 1,000 tokens."""
        if max_tokens and max_tokens > 0:
            return max_tokens
        return 1000

    @staticmethod
    def count_tokens_text(text: str) -> int:
        """Fast token counter for streaming completion buffers (~3.8 chars per token)."""
        if not text:
            return 0
        return max(1, math.ceil(len(text) / 3.8))

tokenizer_estimator = TokenizerEstimator()
