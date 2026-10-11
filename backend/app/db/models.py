import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Provider(Base):
    __tablename__ = "providers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), unique=True, nullable=False, index=True)
    base_url = Column(String(255), nullable=False)
    encrypted_api_key = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    models = relationship("ModelProfile", back_populates="provider_rel", cascade="all, delete-orphan")


class ModelProfile(Base):
    __tablename__ = "models"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider_id = Column(String(36), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    provider_name = Column(String(50), nullable=False)  # "openai", "gemini", "mock"
    model_name = Column(String(100), nullable=False, index=True)
    max_context_window = Column(Integer, nullable=False, default=128000)
    cost_per_1k_prompt_usd = Column(Float, nullable=False, default=0.001)
    cost_per_1k_completion_usd = Column(Float, nullable=False, default=0.002)
    baseline_ttft_p95_ms = Column(Float, nullable=False, default=300.0)
    baseline_itl_p95_ms = Column(Float, nullable=False, default=15.0)
    baseline_p95_latency_ms = Column(Float, nullable=False, default=500.0)
    latency_variance_ms = Column(Float, nullable=False, default=50.0)
    
    # Task-specific benchmark capability scores [0.0 - 1.0]
    code_score = Column(Float, nullable=False, default=0.80)
    math_score = Column(Float, nullable=False, default=0.80)
    extraction_score = Column(Float, nullable=False, default=0.80)
    general_score = Column(Float, nullable=False, default=0.80)

    supports_tools = Column(Boolean, default=True)
    supports_json = Column(Boolean, default=True)
    supports_vision = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sample_count = Column(Integer, default=100)
    created_at = Column(DateTime, default=utc_now)

    provider_rel = relationship("Provider", back_populates="models")


class RoutingRule(Base):
    __tablename__ = "routing_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    max_budget_usd = Column(Float, nullable=True)
    max_latency_sla_ms = Column(Float, nullable=True)
    min_capability = Column(Float, nullable=True, default=0.0)
    preference = Column(String(30), default="balanced")  # "cost", "latency", "quality", "balanced"
    weight_cost = Column(Float, default=0.40)
    weight_latency = Column(Float, default=0.30)
    weight_quality = Column(Float, default=0.30)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)


class RoutingDecision(Base):
    __tablename__ = "routing_decisions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    rule_name = Column(String(100), nullable=True)
    selected_model_id = Column(String(100), nullable=False)
    selected_provider = Column(String(50), nullable=False)
    preference_mode = Column(String(30), default="balanced")
    composite_score = Column(Float, default=0.0)
    constraints_requested = Column(JSON, nullable=False, default=dict)
    compiled_fallback_chain = Column(JSON, nullable=False, default=list)
    justification = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    candidates = relationship("CandidateEvaluation", back_populates="decision", cascade="all, delete-orphan")


class CandidateEvaluation(Base):
    __tablename__ = "candidate_evaluations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    decision_id = Column(String(64), ForeignKey("routing_decisions.id", ondelete="CASCADE"), nullable=False)
    model_name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)
    is_eligible = Column(Boolean, nullable=False)
    composite_score = Column(Float, default=0.0)
    estimated_cost_usd = Column(Float, default=0.0)
    estimated_latency_ms = Column(Float, default=0.0)
    rejection_reasons = Column(JSON, default=list)

    decision = relationship("RoutingDecision", back_populates="candidates")


class RequestTrace(Base):
    __tablename__ = "request_traces"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    decision_id = Column(String(64), nullable=True, index=True)
    client_key_hash = Column(String(64), nullable=True)
    http_status = Column(Integer, nullable=False)
    total_latency_ms = Column(Float, nullable=False)
    gateway_overhead_ms = Column(Float, nullable=False)
    upstream_latency_ms = Column(Float, nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_cost_usd = Column(Float, default=0.0)
    metric_classification = Column(String(30), default="MEASURED")
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    attempts = relationship("ExecutionAttempt", back_populates="trace", cascade="all, delete-orphan")


class ExecutionAttempt(Base):
    __tablename__ = "execution_attempts"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    trace_id = Column(String(64), ForeignKey("request_traces.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    provider = Column(String(50), nullable=False)
    model_name = Column(String(100), nullable=False)
    status_code = Column(Integer, nullable=False)
    latency_ms = Column(Float, nullable=False)
    error_message = Column(Text, nullable=True)

    trace = relationship("RequestTrace", back_populates="attempts")
