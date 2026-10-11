import time
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger("modelrouter.telemetry")

# OpenTelemetry GenAI Semantic Conventions Keys
ATTR_GENAI_SYSTEM = "gen_ai.system"
ATTR_GENAI_REQUEST_MODEL = "gen_ai.request.model"
ATTR_GENAI_RESPONSE_MODEL = "gen_ai.response.model"
ATTR_GENAI_OPERATION_NAME = "gen_ai.operation.name"
ATTR_GENAI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens"
ATTR_GENAI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens"
ATTR_GENAI_USAGE_TOTAL_TOKENS = "gen_ai.usage.total_tokens"
ATTR_GENAI_REQUEST_MAX_TOKENS = "gen_ai.request.max_tokens"
ATTR_GENAI_RESPONSE_FINISH_REASONS = "gen_ai.response.finish_reasons"
ATTR_GENAI_TOKEN_PROVENANCE = "gen_ai.token.provenance"
ATTR_GENAI_COST_USD = "gen_ai.cost.usd"
ATTR_GENAI_COST_PROVENANCE = "gen_ai.cost.provenance"

# Provenance classifications
PROVENANCE_MEASURED = "MEASURED"
PROVENANCE_PROVIDER_REPORTED = "PROVIDER_REPORTED"
PROVENANCE_ESTIMATED = "ESTIMATED"
PROVENANCE_BENCHMARK_DERIVED = "BENCHMARK_DERIVED"
PROVENANCE_SIMULATED = "SIMULATED"

@dataclass
class GenAISpanRecord:
    trace_id: str
    decision_id: Optional[str]
    start_time_monotonic: float
    end_time_monotonic: float = 0.0
    duration_ms: float = 0.0
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict[str, Any]] = field(default_factory=list)

    def finish(self, status_code: int = 200, error_message: Optional[str] = None):
        self.end_time_monotonic = time.perf_counter()
        self.duration_ms = max(0.01, (self.end_time_monotonic - self.start_time_monotonic) * 1000.0)
        self.attributes["http.status_code"] = status_code
        if error_message:
            self.attributes["error.type"] = "UpstreamError" if status_code >= 500 else "ClientError"
            self.attributes["error.message"] = error_message

    def to_otel_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "decision_id": self.decision_id,
            "duration_ms": round(self.duration_ms, 2),
            "attributes": self.attributes,
            "events": self.events
        }

class OpenTelemetryGenAIManager:
    """
    Manages telemetry aligned with OpenTelemetry GenAI Semantic Conventions.
    Uses high-precision monotonic clock. Non-blocking error containment.
    """

    def start_span(
        self,
        trace_id: str,
        decision_id: Optional[str],
        requested_model: str,
        system_provider: str = "modelrouter",
        max_tokens: Optional[int] = None
    ) -> GenAISpanRecord:
        span = GenAISpanRecord(
            trace_id=trace_id,
            decision_id=decision_id,
            start_time_monotonic=time.perf_counter(),
            attributes={
                ATTR_GENAI_SYSTEM: system_provider,
                ATTR_GENAI_REQUEST_MODEL: requested_model,
                ATTR_GENAI_OPERATION_NAME: "chat",
            }
        )
        if max_tokens:
            span.attributes[ATTR_GENAI_REQUEST_MAX_TOKENS] = max_tokens
        return span

    def record_completion_metrics(
        self,
        span: GenAISpanRecord,
        responding_model: str,
        responding_provider: str,
        prompt_tokens: int,
        completion_tokens: int,
        actual_cost_usd: float,
        is_provider_reported: bool = True,
        is_mock: bool = False,
        finish_reason: str = "stop"
    ):
        try:
            token_prov = PROVENANCE_SIMULATED if is_mock else (
                PROVENANCE_PROVIDER_REPORTED if is_provider_reported else PROVENANCE_ESTIMATED
            )
            cost_prov = PROVENANCE_SIMULATED if is_mock else (
                PROVENANCE_PROVIDER_REPORTED if is_provider_reported else PROVENANCE_ESTIMATED
            )

            span.attributes[ATTR_GENAI_SYSTEM] = responding_provider
            span.attributes[ATTR_GENAI_RESPONSE_MODEL] = responding_model
            span.attributes[ATTR_GENAI_USAGE_INPUT_TOKENS] = prompt_tokens
            span.attributes[ATTR_GENAI_USAGE_OUTPUT_TOKENS] = completion_tokens
            span.attributes[ATTR_GENAI_USAGE_TOTAL_TOKENS] = prompt_tokens + completion_tokens
            span.attributes[ATTR_GENAI_RESPONSE_FINISH_REASONS] = [finish_reason]
            span.attributes[ATTR_GENAI_TOKEN_PROVENANCE] = token_prov
            span.attributes[ATTR_GENAI_COST_USD] = round(actual_cost_usd, 6)
            span.attributes[ATTR_GENAI_COST_PROVENANCE] = cost_prov
        except Exception as e:
            # Telemetry errors must never disrupt the inference response
            logger.warning(f"Telemetry metric recording failed: {e}")

otel_manager = OpenTelemetryGenAIManager()
