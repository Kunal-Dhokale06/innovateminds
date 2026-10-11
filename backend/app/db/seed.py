import logging
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.db.models import Provider, ModelProfile, RoutingRule

logger = logging.getLogger("modelrouter.seed")

def seed_database(session: Session):
    """Populate default providers, models, and rules if empty."""
    stmt = select(Provider)
    result = session.execute(stmt)
    if result.scalars().first():
        rules_stmt = select(RoutingRule)
        if not session.execute(rules_stmt).scalars().first():
            _seed_default_rules(session)
        return

    logger.info("Seeding initial providers and model catalog...")

    # 1. Create Providers
    openai_p = Provider(
        name="openai",
        base_url="https://api.openai.com/v1",
        is_active=True
    )
    gemini_p = Provider(
        name="gemini",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        is_active=True
    )
    mock_p = Provider(
        name="mock",
        base_url="http://internal-mock",
        is_active=True
    )

    session.add_all([openai_p, gemini_p, mock_p])
    session.flush()

    # 2. Create Model Profiles
    models = [
        # OpenAI Models
        ModelProfile(
            provider_id=openai_p.id,
            provider_name="openai",
            model_name="gpt-4o",
            max_context_window=128000,
            cost_per_1k_prompt_usd=0.005000,
            cost_per_1k_completion_usd=0.015000,
            baseline_ttft_p95_ms=450.0,
            baseline_itl_p95_ms=12.0,
            baseline_p95_latency_ms=780.0,
            latency_variance_ms=80.0,
            code_score=0.902,
            math_score=0.958,
            extraction_score=0.985,
            general_score=0.887,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=500
        ),
        ModelProfile(
            provider_id=openai_p.id,
            provider_name="openai",
            model_name="gpt-4o-mini",
            max_context_window=128000,
            cost_per_1k_prompt_usd=0.000150,
            cost_per_1k_completion_usd=0.000600,
            baseline_ttft_p95_ms=280.0,
            baseline_itl_p95_ms=10.0,
            baseline_p95_latency_ms=480.0,
            latency_variance_ms=50.0,
            code_score=0.866,
            math_score=0.820,
            extraction_score=0.940,
            general_score=0.820,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=450
        ),
        # Gemini Models
        ModelProfile(
            provider_id=gemini_p.id,
            provider_name="gemini",
            model_name="gemini-1.5-pro",
            max_context_window=2000000,
            cost_per_1k_prompt_usd=0.003500,
            cost_per_1k_completion_usd=0.010500,
            baseline_ttft_p95_ms=520.0,
            baseline_itl_p95_ms=14.0,
            baseline_p95_latency_ms=890.0,
            latency_variance_ms=90.0,
            code_score=0.841,
            math_score=0.865,
            extraction_score=0.960,
            general_score=0.859,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=350
        ),
        ModelProfile(
            provider_id=gemini_p.id,
            provider_name="gemini",
            model_name="gemini-1.5-flash",
            max_context_window=1000000,
            cost_per_1k_prompt_usd=0.000075,
            cost_per_1k_completion_usd=0.000300,
            baseline_ttft_p95_ms=220.0,
            baseline_itl_p95_ms=8.0,
            baseline_p95_latency_ms=380.0,
            latency_variance_ms=40.0,
            code_score=0.743,
            math_score=0.789,
            extraction_score=0.920,
            general_score=0.789,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=600
        ),
        # Deterministic Mock Models for Testing and Chaos
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-balanced",
            max_context_window=32000,
            cost_per_1k_prompt_usd=0.000100,
            cost_per_1k_completion_usd=0.000200,
            baseline_ttft_p95_ms=80.0,
            baseline_itl_p95_ms=5.0,
            baseline_p95_latency_ms=150.0,
            latency_variance_ms=20.0,
            code_score=0.800,
            math_score=0.750,
            extraction_score=0.900,
            general_score=0.800,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=100
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-code-specialist",
            max_context_window=64000,
            cost_per_1k_prompt_usd=0.000300,
            cost_per_1k_completion_usd=0.000800,
            baseline_ttft_p95_ms=120.0,
            baseline_itl_p95_ms=6.0,
            baseline_p95_latency_ms=250.0,
            latency_variance_ms=30.0,
            code_score=0.920,
            math_score=0.700,
            extraction_score=0.900,
            general_score=0.750,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=120
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-cheap-general",
            max_context_window=16000,
            cost_per_1k_prompt_usd=0.000010,
            cost_per_1k_completion_usd=0.000020,
            baseline_ttft_p95_ms=50.0,
            baseline_itl_p95_ms=3.0,
            baseline_p95_latency_ms=90.0,
            latency_variance_ms=15.0,
            code_score=0.500,
            math_score=0.550,
            extraction_score=0.750,
            general_score=0.600,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=150
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-cheap-notools",
            max_context_window=8000,
            cost_per_1k_prompt_usd=0.000010,
            cost_per_1k_completion_usd=0.000020,
            baseline_ttft_p95_ms=40.0,
            baseline_itl_p95_ms=2.0,
            baseline_p95_latency_ms=80.0,
            latency_variance_ms=10.0,
            code_score=0.400,
            math_score=0.450,
            extraction_score=0.500,
            general_score=0.500,
            supports_tools=False,
            supports_json=False,
            is_active=True,
            sample_count=100
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-unverified-coldstart",
            max_context_window=16000,
            cost_per_1k_prompt_usd=0.000050,
            cost_per_1k_completion_usd=0.000100,
            baseline_ttft_p95_ms=150.0,
            baseline_itl_p95_ms=8.0,
            baseline_p95_latency_ms=350.0,
            latency_variance_ms=40.0,
            code_score=0.700,
            math_score=0.700,
            extraction_score=0.700,
            general_score=0.700,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=5
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-rate-limit-429",
            max_context_window=32000,
            cost_per_1k_prompt_usd=0.000100,
            cost_per_1k_completion_usd=0.000200,
            baseline_ttft_p95_ms=50.0,
            baseline_itl_p95_ms=5.0,
            baseline_p95_latency_ms=100.0,
            latency_variance_ms=10.0,
            code_score=0.850,
            math_score=0.850,
            extraction_score=0.850,
            general_score=0.850,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=100
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-server-error-500",
            max_context_window=32000,
            cost_per_1k_prompt_usd=0.000100,
            cost_per_1k_completion_usd=0.000200,
            baseline_ttft_p95_ms=50.0,
            baseline_itl_p95_ms=5.0,
            baseline_p95_latency_ms=100.0,
            latency_variance_ms=10.0,
            code_score=0.850,
            math_score=0.850,
            extraction_score=0.850,
            general_score=0.850,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=100
        ),
        ModelProfile(
            provider_id=mock_p.id,
            provider_name="mock",
            model_name="mock-timeout-504",
            max_context_window=32000,
            cost_per_1k_prompt_usd=0.000100,
            cost_per_1k_completion_usd=0.000200,
            baseline_ttft_p95_ms=50.0,
            baseline_itl_p95_ms=5.0,
            baseline_p95_latency_ms=6000.0,
            latency_variance_ms=100.0,
            code_score=0.850,
            math_score=0.850,
            extraction_score=0.850,
            general_score=0.850,
            supports_tools=True,
            supports_json=True,
            is_active=True,
            sample_count=100
        )
    ]

    session.add_all(models)
    _seed_default_rules(session)
    logger.info(f"Seeded {len(models)} model profiles and default routing rules successfully.")

def _seed_default_rules(session: Session):
    rules = [
        RoutingRule(
            name="default_balanced",
            max_budget_usd=0.05,
            max_latency_sla_ms=3000.0,
            min_capability=0.0,
            preference="balanced",
            weight_cost=0.40,
            weight_latency=0.30,
            weight_quality=0.30,
            is_default=True
        ),
        RoutingRule(
            name="cost_saver",
            max_budget_usd=0.005,
            max_latency_sla_ms=4000.0,
            min_capability=0.5,
            preference="cost",
            weight_cost=0.70,
            weight_latency=0.15,
            weight_quality=0.15,
            is_default=False
        ),
        RoutingRule(
            name="low_latency_interactive",
            max_budget_usd=0.02,
            max_latency_sla_ms=600.0,
            min_capability=0.6,
            preference="latency",
            weight_cost=0.15,
            weight_latency=0.70,
            weight_quality=0.15,
            is_default=False
        )
    ]
    session.add_all(rules)
    session.commit()
    logger.info("Seeded default routing rules successfully.")
