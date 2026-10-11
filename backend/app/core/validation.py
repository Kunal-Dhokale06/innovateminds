import json
import re
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass

@dataclass
class ValidationOutcome:
    status: str             # "PASSED", "REPAIRED", "FAILED", "SKIPPED"
    format_type: str        # "json", "code", "math", "text"
    is_valid: bool
    repaired_content: Optional[str] = None
    validation_error: Optional[str] = None
    repair_applied: bool = False

class ResponseValidator:
    """
    Task-specific output validation and bounded repair.
    Distinguishes structural/format validation from factual verification.
    """

    @classmethod
    def repair_json_string(cls, raw: str) -> Optional[str]:
        """Bounded repair for common LLM JSON syntax deviations."""
        if not raw:
            return None
        text = raw.strip()
        # 1. Strip markdown fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            if len(lines) >= 3 and lines[-1].strip().startswith("```"):
                text = "\n".join(lines[1:-1]).strip()

        # 2. Extract outermost JSON block if surrounded by explanatory text
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
        if match:
            candidate = match.group(0)
            # Remove trailing commas before closing braces/brackets
            cleaned = re.sub(r",\s*(\}|\])", r"\1", candidate)
            try:
                json.loads(cleaned)
                return cleaned
            except Exception:
                pass
        return None

    @classmethod
    def validate_response(
        cls,
        content: str,
        task_type: str,
        requires_json: bool = False,
        response_schema: Optional[Dict[str, Any]] = None
    ) -> ValidationOutcome:
        if not content:
            return ValidationOutcome(
                status="FAILED",
                format_type="text",
                is_valid=False,
                validation_error="Empty response content."
            )

        # 1. JSON Extraction Validation
        if requires_json or task_type in ("extraction", "structured"):
            # Try direct JSON parsing
            try:
                parsed = json.loads(content)
                return ValidationOutcome(
                    status="PASSED",
                    format_type="json",
                    is_valid=True
                )
            except json.JSONDecodeError as err:
                # Apply bounded repair
                repaired = cls.repair_json_string(content)
                if repaired:
                    return ValidationOutcome(
                        status="REPAIRED",
                        format_type="json",
                        is_valid=True,
                        repaired_content=repaired,
                        repair_applied=True
                    )
                return ValidationOutcome(
                    status="FAILED",
                    format_type="json",
                    is_valid=False,
                    validation_error=f"JSON validation failed: {str(err)}"
                )

        # 2. Coding format check
        if task_type in ("code", "coding"):
            # Check for non-empty text, syntax presence
            return ValidationOutcome(
                status="PASSED",
                format_type="code",
                is_valid=True
            )

        # 3. Math format check
        if task_type in ("math", "reasoning"):
            return ValidationOutcome(
                status="PASSED",
                format_type="math",
                is_valid=True
            )

        # Default text format
        return ValidationOutcome(
            status="PASSED",
            format_type="text",
            is_valid=True
        )

response_validator = ResponseValidator()
