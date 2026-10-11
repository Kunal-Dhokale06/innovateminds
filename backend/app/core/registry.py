import asyncio
import logging
from typing import List, Dict, Optional, Any
from sqlalchemy import select
from backend.app.db.models import ModelProfile
from backend.app.db.session import SessionLocal

logger = logging.getLogger("modelrouter.registry")

class InMemoryModelCatalog:
    def __init__(self):
        self._models: Dict[str, Dict[str, Any]] = {}
        self._simulation_overrides: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self):
        """Warm up in-memory cache from database."""
        async with self._lock:
            self._reload_from_db()
            self._initialized = True

    def _reload_from_db(self):
        try:
            with SessionLocal() as session:
                stmt = select(ModelProfile)
                result = session.execute(stmt)
                db_models = result.scalars().all()
                new_cache = {}
                for m in db_models:
                    new_cache[m.model_name] = {
                        "id": m.id,
                        "provider_id": m.provider_id,
                        "provider_name": m.provider_name,
                        "model_name": m.model_name,
                        "max_context_window": m.max_context_window,
                        "cost_per_1k_prompt_usd": m.cost_per_1k_prompt_usd,
                        "cost_per_1k_completion_usd": m.cost_per_1k_completion_usd,
                        "baseline_ttft_p95_ms": m.baseline_ttft_p95_ms,
                        "baseline_itl_p95_ms": m.baseline_itl_p95_ms,
                        "baseline_p95_latency_ms": m.baseline_p95_latency_ms,
                        "latency_variance_ms": m.latency_variance_ms,
                        "code_score": m.code_score,
                        "math_score": m.math_score,
                        "extraction_score": m.extraction_score,
                        "general_score": m.general_score,
                        "supports_tools": m.supports_tools,
                        "supports_json": m.supports_json,
                        "supports_vision": getattr(m, "supports_vision", False),
                        "is_active": m.is_active,
                        "sample_count": m.sample_count,
                    }
                self._models = new_cache
                logger.info(f"Loaded {len(self._models)} models into memory catalog cache.")
        except Exception as e:
            logger.error(f"Failed to reload models from DB: {e}")

    def get_all_models(self) -> List[Dict[str, Any]]:
        """Return all models, applying active simulation overrides."""
        models = []
        for name, profile in self._models.items():
            model_copy = dict(profile)
            if name in self._simulation_overrides:
                override = self._simulation_overrides[name]
                if "simulated_latency_ms" in override and override["simulated_latency_ms"] is not None:
                    model_copy["baseline_p95_latency_ms"] = float(override["simulated_latency_ms"])
                if "is_active" in override and override["is_active"] is not None:
                    model_copy["is_active"] = bool(override["is_active"])
                if "injected_error_code" in override:
                    model_copy["injected_error_code"] = override["injected_error_code"]
            models.append(model_copy)
        return models

    def get_model(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific model with simulation overrides applied."""
        if model_name not in self._models:
            return None
        model_copy = dict(self._models[model_name])
        if model_name in self._simulation_overrides:
            override = self._simulation_overrides[model_name]
            if "simulated_latency_ms" in override and override["simulated_latency_ms"] is not None:
                model_copy["baseline_p95_latency_ms"] = float(override["simulated_latency_ms"])
            if "is_active" in override and override["is_active"] is not None:
                model_copy["is_active"] = bool(override["is_active"])
            if "injected_error_code" in override:
                model_copy["injected_error_code"] = override["injected_error_code"]
        return model_copy

    def set_simulation_override(self, model_name: str, config: Dict[str, Any]):
        """Inject simulation parameters (latency, error code, active toggle)."""
        if model_name not in self._simulation_overrides:
            self._simulation_overrides[model_name] = {}
        self._simulation_overrides[model_name].update(config)
        logger.info(f"Set simulation override for {model_name}: {config}")

    def reset_simulation(self):
        """Clear all active simulation overrides."""
        self._simulation_overrides.clear()
        logger.info("Cleared all simulation overrides.")

    def get_simulation_overrides(self) -> Dict[str, Dict[str, Any]]:
        return dict(self._simulation_overrides)

model_catalog = InMemoryModelCatalog()
