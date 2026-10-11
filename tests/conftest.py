import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import pytest_asyncio
import httpx
from backend.app.main import app
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.db.seed import seed_database
from backend.app.core.registry import model_catalog
from backend.app.core.circuit import circuit_manager

@pytest_asyncio.fixture(autouse=True)
async def init_test_db():
    """Ensure database schema is created, seeded, and state clean before tests."""
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as session:
        seed_database(session)

    await model_catalog.initialize()
    model_catalog.reset_simulation()
    circuit_manager._circuits.clear()
    yield

@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
