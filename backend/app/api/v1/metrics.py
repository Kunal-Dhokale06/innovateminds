from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.db.models import RequestTrace, ExecutionAttempt
from backend.app.core.circuit import circuit_manager

router = APIRouter()

@router.get("/metrics")
def get_system_metrics(db: Session = Depends(get_db)):
    """Aggregates high-level telemetry and SLA compliance metrics."""
    total_requests = db.scalar(select(func.count(RequestTrace.id))) or 0
    success_requests = db.scalar(select(func.count(RequestTrace.id)).where(RequestTrace.http_status == 200)) or 0
    total_cost = db.scalar(select(func.sum(RequestTrace.total_cost_usd))) or 0.0
    avg_overhead = db.scalar(select(func.avg(RequestTrace.gateway_overhead_ms))) or 0.0
    avg_latency = db.scalar(select(func.avg(RequestTrace.total_latency_ms))) or 0.0

    sla_compliance_rate = 100.0 if total_requests == 0 else (success_requests / total_requests) * 100.0

    # Empirical latency percentiles from real traces
    lat_rows = db.execute(select(RequestTrace.total_latency_ms).order_by(RequestTrace.total_latency_ms.asc())).scalars().all()
    p50_latency = 0.0
    p95_latency = 0.0
    p99_latency = 0.0
    if lat_rows:
        n = len(lat_rows)
        p50_latency = round(lat_rows[min(int(n * 0.50), n - 1)], 1)
        p95_latency = round(lat_rows[min(int(n * 0.95), n - 1)], 1)
        p99_latency = round(lat_rows[min(int(n * 0.99), n - 1)], 1)

    # Real model attribution from execution attempts
    model_rows = db.execute(
        select(
            ExecutionAttempt.model_name,
            func.count(ExecutionAttempt.id),
            func.avg(ExecutionAttempt.latency_ms)
        ).group_by(ExecutionAttempt.model_name)
    ).all()

    model_attribution = []
    total_attempts = sum(row[1] for row in model_rows) or 1
    for row in model_rows:
        model_name, count, avg_lat = row
        share = round((count / total_attempts) * 100, 1)
        model_attribution.append({
            "model": model_name,
            "requests": count,
            "share_percent": share,
            "avg_latency_ms": round(avg_lat or 0.0, 1)
        })

    return {
        "total_requests": total_requests,
        "success_requests": success_requests,
        "error_requests": total_requests - success_requests,
        "sla_compliance_rate_percent": round(sla_compliance_rate, 2),
        "total_cost_usd": round(total_cost, 6),
        "average_gateway_overhead_ms": round(avg_overhead, 2),
        "average_total_latency_ms": round(avg_latency, 2),
        "p50_latency_ms": p50_latency,
        "p95_latency_ms": p95_latency,
        "p99_latency_ms": p99_latency,
        "model_attribution": model_attribution,
        "circuit_states": circuit_manager.get_all_states()
    }
