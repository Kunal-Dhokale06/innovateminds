import os
import sys
import types
import logging
from contextlib import asynccontextmanager

# Enable seamless imports whether running from project root or inside backend/ directory (e.g. Render/Docker)
_app_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_app_dir)
_parent_dir = os.path.dirname(_backend_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
if "backend" not in sys.modules:
    _backend_mod = types.ModuleType("backend")
    _backend_mod.__path__ = [_backend_dir]
    sys.modules["backend"] = _backend_mod

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.db.seed import seed_database
from backend.app.core.registry import model_catalog
from backend.app.core.trace_buffer import trace_buffer

from backend.app.api.v1.completions import router as completions_router
from backend.app.api.v1.traces import router as traces_router
from backend.app.api.v1.simulation import router as simulation_router
from backend.app.api.v1.models import router as models_router
from backend.app.api.v1.rules import router as rules_router
from backend.app.api.v1.metrics import router as metrics_router
from backend.app.api.v1.images import router as images_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("modelrouter.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing ModelRouter AI Gateway...")
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as session:
        seed_database(session)

    await model_catalog.initialize()
    trace_buffer.start()
    logger.info("ModelRouter AI Gateway startup completed successfully.")
    
    yield
    
    # Shutdown sequence
    logger.info("Shutting down ModelRouter AI Gateway...")
    await trace_buffer.stop()
    engine.dispose()
    logger.info("ModelRouter shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-Grade, Constraint-Safe, and Explainable AI Gateway",
    version="2.1.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register API v1 routes
app.include_router(completions_router, prefix="/v1", tags=["Completions"])
app.include_router(images_router, prefix="/v1", tags=["Image Generation"])
app.include_router(traces_router, prefix="/v1", tags=["Traces & Observability"])
app.include_router(simulation_router, prefix="/v1", tags=["Judge Simulation"])
app.include_router(models_router, prefix="/v1", tags=["Models & Health"])
app.include_router(rules_router, prefix="/v1", tags=["Routing Rules"])
app.include_router(metrics_router, prefix="/v1", tags=["Metrics"])

@app.get("/", tags=["System"])
@app.get("/health", tags=["System"])
@app.get("/healthz", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "2.1.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
