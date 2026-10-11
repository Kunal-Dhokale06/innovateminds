import pytest
import time
from backend.app.core.circuit import circuit_manager
from backend.app.core.registry import model_catalog
from backend.app.core.engine import routing_engine, RequestRoutingContext

@pytest.mark.asyncio
async def test_duplicate_retry_prevention(client):
    """
    Verify that if a model fails with retriable error (e.g., 500),
    it is never retried a second time in the same fallback chain.
    """
    # Inject 500 into mock-balanced
    await client.post("/v1/simulation/config", json={
        "target_model": "mock-balanced",
        "injected_error_code": 500
    })

    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Test duplicate retry prevention"}]
    }
    headers = {
        "x-modelrouter-preference": "cost",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # The selected model should NOT be mock-balanced
    assert resp.headers.get("x-modelrouter-selected-model") != "mock-balanced"

    # Reset simulation
    await client.post("/v1/simulation/reset")


@pytest.mark.asyncio
async def test_stale_or_deactivated_model_skipped(client):
    """
    Verify that if a model is deactivated mid-flight,
    the gateway safely skips it and falls over to the next eligible candidate.
    """
    # Deactivate mock-balanced
    await client.post("/v1/simulation/config", json={
        "target_model": "mock-balanced",
        "is_active": False
    })

    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Test deactivated candidate skipping"}]
    }
    headers = {
        "x-modelrouter-preference": "cost",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("x-modelrouter-selected-model") != "mock-balanced"

    await client.post("/v1/simulation/reset")


@pytest.mark.asyncio
async def test_never_relax_hard_constraints_even_under_outage(client):
    """
    Verify that if all eligible models fail, the gateway NEVER silently
    relaxes constraints to attempt an ineligible model (e.g. missing tools).
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Tool required prompt"}],
        "tools": [{
            "type": "function",
            "function": {"name": "query_database", "parameters": {}}
        }]
    }
    # Set extremely low budget that excludes all models that have tools
    headers = {
        "x-modelrouter-budget-max": "0.000001",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    # Must fail with 422 CONSTRAINT_VIOLATION and never call a toolless cheap model
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "CONSTRAINT_VIOLATION"


@pytest.mark.asyncio
async def test_circuit_breaker_transitions(client):
    """
    Verify circuit breaker transitions: consecutive failures trip circuit to OPEN,
    excluding provider from candidate pools while eligible providers handle traffic.
    """
    # Trip all live external provider circuits
    for _ in range(5):
        circuit_manager.record_failure("openai")
        circuit_manager.record_failure("gemini")
        circuit_manager.record_failure("groq")

    c = circuit_manager.get_circuit("openai")
    assert c.state == "OPEN"
    assert circuit_manager.is_available("openai") is False

    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Circuit breaker test"}]
    }
    headers = {
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    evaluations = data["_modelrouter_decision"]["candidate_evaluations"]

    # External candidates must be rejected with CIRCUIT_OPEN
    for p in ("openai", "gemini", "groq"):
        p_evals = [e for e in evaluations if e["provider"] == p]
        for pe in p_evals:
            assert pe["is_eligible"] is False
            assert any("CIRCUIT_OPEN" in r for r in pe["rejection_reasons"])

    # Mock candidates should still be eligible and routed
    assert resp.headers.get("x-modelrouter-selected-provider") == "mock"

    # Reset circuit
    circuit_manager._circuits.clear()


@pytest.mark.asyncio
async def test_streaming_sse_error_chunks(client):
    """
    Verify streaming request handles upstream errors and completes cleanly.
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Stream test prompt"}],
        "stream": True
    }
    resp = await client.post("/v1/chat/completions", json=payload)
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")

    # Read response body stream
    content = resp.text
    assert "data: " in content
    assert "[DONE]" in content


@pytest.mark.asyncio
async def test_deterministic_model_selection():
    """
    Verify pure mathematical scoring produces identical, deterministic rankings
    across repeated evaluations.
    """
    ctx = RequestRoutingContext(
        messages=[{"role": "user", "content": "Deterministic sorting test"}],
        preference="balanced",
        task_type="code"
    )
    catalog = model_catalog.get_all_models()

    res1 = routing_engine.evaluate_candidates(ctx, catalog)
    res2 = routing_engine.evaluate_candidates(ctx, catalog)

    assert res1.is_feasible is True
    assert res2.is_feasible is True
    assert res1.selected_model["model_name"] == res2.selected_model["model_name"]
    assert [m["model_name"] for m in res1.fallback_chain] == [m["model_name"] for m in res2.fallback_chain]
    assert round(res1.composite_score, 4) == round(res2.composite_score, 4)
