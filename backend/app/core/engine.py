from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
import uuid
from backend.app.core.circuit import circuit_manager
from backend.app.core.tokenizer import tokenizer_estimator
from backend.app.core.profiler import RequestProfile

# Standardized Machine-Readable Rejection Codes (Industry Standard)
CODE_REJECTED_BUDGET = "REJECTED_BUDGET"
CODE_UNSUPPORTED_MODALITY = "UNSUPPORTED_MODALITY"
CODE_INSUFFICIENT_CONTEXT = "INSUFFICIENT_CONTEXT"
CODE_LATENCY_UNCERTAIN = "LATENCY_UNCERTAIN"
CODE_LATENCY_SLA_EXCEEDED = "LATENCY_SLA_EXCEEDED"
CODE_PROVIDER_UNHEALTHY = "PROVIDER_UNHEALTHY"
CODE_CAPABILITY_BELOW_THRESHOLD = "CAPABILITY_BELOW_THRESHOLD"
CODE_ADMINISTRATIVELY_INACTIVE = "ADMINISTRATIVELY_INACTIVE"
CODE_HIGH_UNCERTAINTY = "HIGH_UNCERTAINTY"
CODE_MISSING_FEATURE = "MISSING_FEATURE"

CODE_NO_FEASIBLE_MODEL = "NO_FEASIBLE_MODEL"

@dataclass
class RequestRoutingContext:
    messages: List[Dict[str, Any]]
    max_tokens: Optional[int] = None
    max_budget_usd: Optional[float] = None
    max_latency_sla_ms: Optional[float] = None
    min_capability: float = 0.0
    preference: str = "balanced"  # "cost", "cost_first", "latency", "latency_first", "quality", "quality_first", "balanced"
    task_type: str = "general"    # "code", "math", "extraction", "general", "summarization", "vision"
    requires_tools: bool = False
    requires_json: bool = False
    requires_vision: bool = False
    attachment_tokens_est: int = 0
    allow_unverified: bool = False
    requested_model: Optional[str] = None

@dataclass
class CandidateEvalResult:
    model_name: str
    provider: str
    model_profile: Dict[str, Any]
    is_eligible: bool
    rejection_reasons: List[str]
    rejection_codes: List[str] = field(default_factory=list)
    estimated_cost_usd: float = 0.0
    estimated_latency_ms: float = 0.0
    composite_score: float = 0.0
    sub_scores: Dict[str, float] = field(default_factory=dict)
    evidence: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RoutingDecisionResult:
    decision_id: str
    selected_model: Optional[Dict[str, Any]]
    fallback_chain: List[Dict[str, Any]]
    all_evaluations: List[CandidateEvalResult]
    preference_mode: str
    composite_score: float
    justification: str
    is_feasible: bool
    error_code: Optional[str] = None

class DeterministicRoutingEngine:
    @staticmethod
    def get_task_capability_score(model: Dict[str, Any], task_type: str) -> float:
        task = task_type.lower()
        if task in ("code", "coding"):
            return float(model.get("code_score", 0.8))
        elif task in ("math", "reasoning"):
            return float(model.get("math_score", 0.8))
        elif task in ("extraction", "structured"):
            return float(model.get("extraction_score", 0.8))
        elif task in ("vision", "multimodal"):
            return 0.95 if model.get("supports_vision") else 0.0
        elif task in ("summarization",):
            return float(model.get("general_score", 0.8))
        else:
            return float(model.get("general_score", 0.8))

    def evaluate_candidates(
        self,
        context: Union[RequestRoutingContext, RequestProfile],
        catalog: List[Dict[str, Any]]
    ) -> RoutingDecisionResult:
        decision_id = f"dec_{uuid.uuid4().hex[:12]}"

        # Unify RequestProfile vs RequestRoutingContext
        if isinstance(context, RequestProfile):
            prompt_tokens_est = context.prompt_tokens_est
            completion_tokens_est = context.completion_tokens_est
            required_total_tokens = context.required_context_tokens
            max_budget = context.budget_max_usd
            latency_sla = context.latency_sla_ms
            min_cap = context.min_capability
            preference = context.preference
            task_type = context.task_type
            requires_tools = context.requires_tools
            requires_json = context.requires_json
            requires_vision = context.requires_vision
            allow_unverified = context.allow_unverified
            requested_model = context.requested_model
        else:
            prompt_tokens_est = tokenizer_estimator.estimate_prompt_tokens(context.messages) + context.attachment_tokens_est
            completion_tokens_est = tokenizer_estimator.estimate_completion_tokens(context.max_tokens)
            required_total_tokens = prompt_tokens_est + completion_tokens_est
            max_budget = context.max_budget_usd
            latency_sla = context.max_latency_sla_ms
            min_cap = context.min_capability
            preference = context.preference
            task_type = context.task_type
            requires_tools = context.requires_tools
            requires_json = context.requires_json
            requires_vision = context.requires_vision
            allow_unverified = context.allow_unverified
            requested_model = context.requested_model

        # Map preference modes
        pref = preference.lower().strip()
        if pref in ("cost", "cost_first"):
            normalized_pref = "cost"
        elif pref in ("latency", "latency_first", "speed", "speed_first"):
            normalized_pref = "latency"
        elif pref in ("quality", "quality_first"):
            normalized_pref = "quality"
        else:
            normalized_pref = "balanced"

        evaluations: List[CandidateEvalResult] = []
        eligible_candidates: List[CandidateEvalResult] = []

        targeted_model = None
        if requested_model and requested_model not in ("auto", "modelrouter-auto", "default"):
            targeted_model = requested_model

        for model in catalog:
            reasons = []
            codes = []
            provider = model.get("provider_name", "mock")
            name = model.get("model_name", "unknown")

            # If user explicitly requested another model, skip
            if targeted_model and name != targeted_model:
                continue

            # Check Administrative Status
            if not model.get("is_active", True):
                codes.append(CODE_ADMINISTRATIVELY_INACTIVE)
                reasons.append(f"{CODE_ADMINISTRATIVELY_INACTIVE}: Model is administratively disabled.")

            # Check Circuit Breaker
            if not circuit_manager.is_available(provider):
                codes.append(CODE_PROVIDER_UNHEALTHY)
                reasons.append(f"{CODE_PROVIDER_UNHEALTHY} (CIRCUIT_OPEN): Provider '{provider}' circuit breaker is OPEN due to elevated errors.")

            # Hard Constraint 1: Context Window Capacity
            max_ctx = model.get("max_context_window", 128000)
            if max_ctx < required_total_tokens:
                codes.append(CODE_INSUFFICIENT_CONTEXT)
                reasons.append(
                    f"{CODE_INSUFFICIENT_CONTEXT} (REQUIRED_CONTEXT_EXCEEDED): Needed {required_total_tokens} tokens (prompt: {prompt_tokens_est}, comp: {completion_tokens_est}), candidate supports {max_ctx}."
                )

            # Hard Constraint 2: Feature / Capability Support
            if requires_tools and not model.get("supports_tools", True):
                codes.append(CODE_MISSING_FEATURE)
                reasons.append(f"{CODE_MISSING_FEATURE}: Candidate does not support required function/tool calling.")
            if requires_json and not model.get("supports_json", True):
                codes.append(CODE_MISSING_FEATURE)
                reasons.append(f"{CODE_MISSING_FEATURE}: Candidate does not support required structured JSON output.")
            if requires_vision and not model.get("supports_vision", False):
                codes.append(CODE_UNSUPPORTED_MODALITY)
                reasons.append(f"{CODE_UNSUPPORTED_MODALITY} (MISSING_FEATURE): Candidate does not support required multimodal vision / image inputs.")

            # Hard Constraint 3: Cost Ceiling
            cost_in = model.get("cost_per_1k_prompt_usd", 0.001)
            cost_out = model.get("cost_per_1k_completion_usd", 0.002)
            est_cost = ((prompt_tokens_est / 1000.0) * cost_in) + ((completion_tokens_est / 1000.0) * cost_out)

            if max_budget is not None and est_cost > max_budget:
                codes.append(CODE_REJECTED_BUDGET)
                reasons.append(
                    f"{CODE_REJECTED_BUDGET} (BUDGET_EXCEEDED): Conservative estimated cost (${est_cost:.6f}) exceeds budget cap (${max_budget:.6f})."
                )

            # Hard Constraint 4: Latency SLA Ceiling with Statistical Uncertainty
            base_p95 = model.get("baseline_p95_latency_ms", 500.0)
            variance = model.get("latency_variance_ms", 50.0)
            # Conservative latency (~90% confidence upper bound under observed queue distributions)
            conservative_lat = base_p95 + (1.28 * variance)

            if latency_sla is not None and conservative_lat > latency_sla:
                codes.append(CODE_LATENCY_SLA_EXCEEDED)
                reasons.append(
                    f"{CODE_LATENCY_SLA_EXCEEDED}: Conservative latency ({conservative_lat:.1f}ms) exceeds SLA ceiling ({latency_sla:.1f}ms)."
                )

            # Hard Constraint 5: Task Capability Score
            cap_score = self.get_task_capability_score(model, task_type)
            if cap_score < min_cap:
                codes.append(CODE_CAPABILITY_BELOW_THRESHOLD)
                reasons.append(
                    f"{CODE_CAPABILITY_BELOW_THRESHOLD}: {task_type.capitalize()} score ({cap_score:.3f}) is below minimum requirement ({min_cap:.3f})."
                )

            # Uncertainty / Cold-Start Quarantine Check
            sample_count = model.get("sample_count", 100)
            if sample_count < 30 and latency_sla is not None and latency_sla <= 1000.0:
                if not allow_unverified:
                    codes.append(CODE_HIGH_UNCERTAINTY)
                    reasons.append(
                        f"{CODE_HIGH_UNCERTAINTY} (LATENCY_UNCERTAIN): Cold-start model ({sample_count} samples observed) quarantined for tight latency SLAs without override."
                    )

            is_eligible = len(reasons) == 0
            evidence = {
                "sample_count": sample_count,
                "confidence": 0.95 if sample_count >= 100 else (0.75 if sample_count >= 30 else 0.40),
                "benchmark_score": cap_score,
                "baseline_p95_ms": base_p95,
                "conservative_latency_ms": conservative_lat,
                "cost_prompt_1k": cost_in,
                "cost_comp_1k": cost_out
            }

            eval_res = CandidateEvalResult(
                model_name=name,
                provider=provider,
                model_profile=model,
                is_eligible=is_eligible,
                rejection_reasons=reasons,
                rejection_codes=codes,
                estimated_cost_usd=est_cost,
                estimated_latency_ms=conservative_lat,
                composite_score=0.0,
                evidence=evidence
            )
            evaluations.append(eval_res)
            if is_eligible:
                eligible_candidates.append(eval_res)

        # Stage 4: Check if any candidates survived
        if not eligible_candidates:
            return RoutingDecisionResult(
                decision_id=decision_id,
                selected_model=None,
                fallback_chain=[],
                all_evaluations=evaluations,
                preference_mode=normalized_pref,
                composite_score=0.0,
                justification="Zero candidates satisfied the request's hard constraints.",
                is_feasible=False,
                error_code=CODE_NO_FEASIBLE_MODEL
            )

        # Stage 5: Preference-Based Multi-Objective Utility Ranking
        if normalized_pref == "cost":
            w_cost, w_lat, w_qual = 1.0, 0.0, 0.0
        elif normalized_pref == "latency":
            w_cost, w_lat, w_qual = 0.0, 1.0, 0.0
        elif normalized_pref == "quality":
            w_cost, w_lat, w_qual = 0.0, 0.0, 1.0
        else:  # "balanced"
            w_cost, w_lat, w_qual = 0.40, 0.30, 0.30

        # Min-Max Normalization across surviving eligible pool
        costs = [e.estimated_cost_usd for e in eligible_candidates]
        latencies = [e.estimated_latency_ms for e in eligible_candidates]
        min_c, max_c = min(costs), max(costs)
        min_l, max_l = min(latencies), max(latencies)

        for e in eligible_candidates:
            # Normalized Cost (Lower is better -> inverted)
            if max_c > min_c:
                norm_cost = 1.0 - ((e.estimated_cost_usd - min_c) / (max_c - min_c))
            else:
                norm_cost = 1.0

            # Normalized Latency (Lower is better -> inverted)
            if max_l > min_l:
                norm_lat = 1.0 - ((e.estimated_latency_ms - min_l) / (max_l - min_l))
            else:
                norm_lat = 1.0

            # Normalized Quality (Higher is better)
            norm_qual = self.get_task_capability_score(e.model_profile, task_type)

            e.composite_score = (w_cost * norm_cost) + (w_lat * norm_lat) + (w_qual * norm_qual)

            # Prioritize real upstream providers over simulated stubs when live API keys are configured
            from backend.app.config import settings
            if (
                (settings.GEMINI_API_KEY and e.provider == "gemini") or
                (settings.OPENAI_API_KEY and e.provider == "openai") or
                (settings.GROQ_API_KEY and e.provider == "groq")
            ):
                e.composite_score += 0.50

            e.sub_scores = {
                "norm_cost": norm_cost,
                "norm_latency": norm_lat,
                "norm_quality": norm_qual,
                "weight_cost": w_cost,
                "weight_latency": w_lat,
                "weight_quality": w_qual
            }

        # Multi-key deterministic tie-breaking:
        # 1. Highest composite score
        # 2. Lowest estimated latency
        # 3. Lowest estimated cost
        # 4. Lexicographical model name
        eligible_candidates.sort(
            key=lambda x: (
                -round(x.composite_score, 6),
                round(x.estimated_latency_ms, 2),
                round(x.estimated_cost_usd, 6),
                x.model_name
            )
        )

        winner = eligible_candidates[0]
        fallback_chain = [e.model_profile for e in eligible_candidates]

        justification = (
            f"Candidate '{winner.model_name}' ({winner.provider}) selected with highest composite score ({winner.composite_score:.3f}) "
            f"under preference '{normalized_pref}'. Passed all hard constraints."
        )

        return RoutingDecisionResult(
            decision_id=decision_id,
            selected_model=winner.model_profile,
            fallback_chain=fallback_chain,
            all_evaluations=evaluations,
            preference_mode=normalized_pref,
            composite_score=winner.composite_score,
            justification=justification,
            is_feasible=True,
            error_code=None
        )

routing_engine = DeterministicRoutingEngine()
