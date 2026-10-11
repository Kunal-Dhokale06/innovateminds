from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.db.models import RoutingRule
from backend.app.api.v1.schemas import RuleCreateRequest

router = APIRouter()

@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    result = db.execute(select(RoutingRule))
    rules = result.scalars().all()
    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "max_budget_usd": r.max_budget_usd,
                "max_latency_sla_ms": r.max_latency_sla_ms,
                "min_capability": r.min_capability,
                "preference": r.preference,
                "weight_cost": r.weight_cost,
                "weight_latency": r.weight_latency,
                "weight_quality": r.weight_quality,
                "is_default": r.is_default
            }
            for r in rules
        ]
    }

@router.post("/rules")
def create_rule(req: RuleCreateRequest, db: Session = Depends(get_db)):
    rule = RoutingRule(
        name=req.name,
        max_budget_usd=req.max_budget_usd,
        max_latency_sla_ms=req.max_latency_sla_ms,
        min_capability=req.min_capability,
        preference=req.preference,
        weight_cost=req.weight_cost,
        weight_latency=req.weight_latency,
        weight_quality=req.weight_quality,
        is_default=req.is_default
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"status": "created", "rule_id": rule.id, "name": rule.name}
