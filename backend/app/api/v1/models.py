from fastapi import APIRouter, HTTPException
from backend.app.core.registry import model_catalog
from backend.app.core.circuit import circuit_manager

router = APIRouter()

@router.get("/models")
async def list_models():
    """Retrieve all models from the in-memory catalog with live circuit status and simulation parameters."""
    models = model_catalog.get_all_models()
    circuit_states = circuit_manager.get_all_states()

    formatted_models = []
    for m in models:
        provider = m.get("provider_name", "mock")
        circuit = circuit_states.get(provider, {"state": "CLOSED"})
        
        formatted_models.append({
            "id": m.get("id"),
            "model_name": m.get("model_name"),
            "provider_name": provider,
            "max_context_window": m.get("max_context_window"),
            "cost_per_1k_prompt_usd": m.get("cost_per_1k_prompt_usd"),
            "cost_per_1k_completion_usd": m.get("cost_per_1k_completion_usd"),
            "baseline_p95_latency_ms": m.get("baseline_p95_latency_ms"),
            "code_score": m.get("code_score"),
            "math_score": m.get("math_score"),
            "extraction_score": m.get("extraction_score"),
            "general_score": m.get("general_score"),
            "supports_tools": m.get("supports_tools"),
            "supports_json": m.get("supports_json"),
            "is_active": m.get("is_active"),
            "circuit_state": circuit.get("state", "CLOSED"),
            "sample_count": m.get("sample_count", 100),
            "injected_error_code": m.get("injected_error_code")
        })

    return {"models": formatted_models, "count": len(formatted_models)}

@router.post("/models/{model_name}/toggle")
async def toggle_model_active(model_name: str):
    """Toggle a model active / inactive state."""
    model = model_catalog.get_model(model_name)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    new_state = not model.get("is_active", True)
    model_catalog.set_simulation_override(model_name, {"is_active": new_state})

    return {
        "status": "success",
        "model_name": model_name,
        "is_active": new_state
    }
