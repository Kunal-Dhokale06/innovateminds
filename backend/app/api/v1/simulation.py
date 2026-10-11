from fastapi import APIRouter
from backend.app.core.registry import model_catalog
from backend.app.core.circuit import circuit_manager
from backend.app.api.v1.schemas import SimulationConfigRequest

router = APIRouter()

@router.post("/simulation/config")
async def update_simulation_config(config: SimulationConfigRequest):
    """Dynamically inject latency, error status codes, or active toggles for judge testing."""
    payload = config.model_dump(exclude_none=True)
    target = payload.pop("target_model")

    model_catalog.set_simulation_override(target, payload)

    return {
        "status": "success",
        "message": f"Simulation overrides updated for model '{target}'.",
        "active_overrides": model_catalog.get_simulation_overrides()
    }

@router.get("/simulation/config")
async def get_simulation_config():
    """Retrieve all active simulation overrides and circuit states."""
    return {
        "overrides": model_catalog.get_simulation_overrides(),
        "circuits": circuit_manager.get_all_states()
    }

@router.post("/simulation/reset")
async def reset_simulation_config():
    """Clear all simulation overrides and restore baseline catalog."""
    model_catalog.reset_simulation()
    return {
        "status": "success",
        "message": "All simulation overrides have been cleared."
    }
