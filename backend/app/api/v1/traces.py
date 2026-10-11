from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session, selectinload

from backend.app.db.session import get_db
from backend.app.db.models import RequestTrace, RoutingDecision

router = APIRouter()

@router.get("/traces")
def list_traces(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    stmt = select(RequestTrace).order_by(desc(RequestTrace.created_at)).limit(limit).offset(offset)
    if status:
        stmt = stmt.where(RequestTrace.http_status == status)
    
    traces = db.execute(stmt).scalars().all()

    return {
        "traces": [
            {
                "id": t.id,
                "decision_id": t.decision_id,
                "http_status": t.http_status,
                "total_latency_ms": round(t.total_latency_ms, 2),
                "gateway_overhead_ms": round(t.gateway_overhead_ms, 2),
                "upstream_latency_ms": round(t.upstream_latency_ms, 2),
                "prompt_tokens": t.prompt_tokens,
                "completion_tokens": t.completion_tokens,
                "total_cost_usd": round(t.total_cost_usd, 6),
                "metric_classification": t.metric_classification,
                "error_code": t.error_code,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in traces
        ],
        "count": len(traces)
    }

@router.get("/traces/{trace_id}")
def get_trace_detail(
    trace_id: str,
    db: Session = Depends(get_db)
):
    stmt = (
        select(RequestTrace)
        .where(RequestTrace.id == trace_id)
        .options(selectinload(RequestTrace.attempts))
    )
    trace = db.execute(stmt).scalars().first()

    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")

    decision_data = None
    if trace.decision_id:
        dec_stmt = (
            select(RoutingDecision)
            .where(RoutingDecision.id == trace.decision_id)
            .options(selectinload(RoutingDecision.candidates))
        )
        decision = db.execute(dec_stmt).scalars().first()
        if decision:
            decision_data = {
                "id": decision.id,
                "rule_name": decision.rule_name,
                "selected_model": decision.selected_model_id,
                "selected_provider": decision.selected_provider,
                "preference_mode": decision.preference_mode,
                "composite_score": decision.composite_score,
                "constraints_requested": decision.constraints_requested,
                "fallback_chain": decision.compiled_fallback_chain,
                "justification": decision.justification,
                "candidates": [
                    {
                        "model_name": c.model_name,
                        "provider": c.provider,
                        "is_eligible": c.is_eligible,
                        "composite_score": round(c.composite_score, 4),
                        "estimated_cost_usd": round(c.estimated_cost_usd, 6),
                        "estimated_latency_ms": round(c.estimated_latency_ms, 1),
                        "rejection_reasons": c.rejection_reasons
                    }
                    for c in decision.candidates
                ]
            }

    return {
        "trace": {
            "id": trace.id,
            "decision_id": trace.decision_id,
            "http_status": trace.http_status,
            "total_latency_ms": round(trace.total_latency_ms, 2),
            "gateway_overhead_ms": round(trace.gateway_overhead_ms, 2),
            "upstream_latency_ms": round(trace.upstream_latency_ms, 2),
            "prompt_tokens": trace.prompt_tokens,
            "completion_tokens": trace.completion_tokens,
            "total_cost_usd": round(trace.total_cost_usd, 6),
            "metric_classification": trace.metric_classification,
            "error_code": trace.error_code,
            "error_message": trace.error_message,
            "created_at": trace.created_at.isoformat() if trace.created_at else None
        },
        "decision": decision_data,
        "attempts": [
            {
                "attempt_number": a.attempt_number,
                "provider": a.provider,
                "model_name": a.model_name,
                "status_code": a.status_code,
                "latency_ms": round(a.latency_ms, 2),
                "error_message": a.error_message
            }
            for a in trace.attempts
        ]
    }
