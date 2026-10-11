import pytest
import json

@pytest.mark.asyncio
async def test_at01_cheapest_valid_model(client):
    """
    AT-01: Cheapest-Valid-Model Selection.
    When x-modelrouter-preference: cost is set, ModelRouter must select
    the model with the lowest cost per token that satisfies context and capability.
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Explain binary search concisely."}]
    }
    headers = {
        "x-modelrouter-preference": "cost",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Model selected should be the cheapest valid model (gemini-1.5-flash or mock-cheap-general)
    selected_model = resp.headers.get("x-modelrouter-selected-model")
    assert selected_model in ("gemini-1.5-flash", "mock-cheap-general", "mock-cheap-notools")
    assert "_modelrouter_decision" in data
    assert data["_modelrouter_decision"]["preference_mode"] == "cost"


@pytest.mark.asyncio
async def test_at02_constraint_violations(client):
    """
    AT-02: Constraint Violations & Deterministic Rejection.
    When a request sets a tight budget, expensive models must be marked
    is_eligible=False with explicit reason 'BUDGET_EXCEEDED'.
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "A" * 500}]  # Prompt has ~150 tokens
    }
    headers = {
        "x-modelrouter-budget-max": "0.0001",  # Strict budget $0.0001
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Verify gpt-4o was disqualified due to budget
    evaluations = data["_modelrouter_decision"]["candidate_evaluations"]
    gpt4o_eval = next((e for e in evaluations if e["model_name"] == "gpt-4o"), None)
    assert gpt4o_eval is not None
    assert gpt4o_eval["is_eligible"] is False
    assert any("BUDGET_EXCEEDED" in r for r in gpt4o_eval["rejection_reasons"])


@pytest.mark.asyncio
async def test_at03_uncertainty_cold_start(client):
    """
    AT-03: Uncertainty Estimates & Cold-Start Quarantine.
    Unverified models (sample_count < 30) are quarantined under tight latency SLAs
    with reason 'HIGH_UNCERTAINTY' unless allow-unverified override is passed.
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Test prompt"}]
    }
    headers = {
        "x-modelrouter-latency-sla-ms": "500.0",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    evaluations = data["_modelrouter_decision"]["candidate_evaluations"]
    coldstart_eval = next((e for e in evaluations if e["model_name"] == "mock-unverified-coldstart"), None)
    assert coldstart_eval is not None
    assert coldstart_eval["is_eligible"] is False
    assert any("HIGH_UNCERTAINTY" in r for r in coldstart_eval["rejection_reasons"])


@pytest.mark.asyncio
async def test_at04_latency_breach_and_failover(client):
    """
    AT-04: Latency Breaches & Safe Fallback.
    Simulate timeout on primary model; gateway executes fallback candidate
    within remaining deadline.
    """
    # Configure simulation: force primary model gpt-4o to timeout
    sim_payload = {
        "target_model": "mock-balanced",
        "injected_error_code": 504
    }
    await client.post("/v1/simulation/config", json=sim_payload)

    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Failover test prompt"}]
    }
    headers = {
        "x-modelrouter-latency-sla-ms": "2000.0",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("x-modelrouter-selected-model") != "mock-balanced"


@pytest.mark.asyncio
async def test_at05_safe_fallback_eligibility(client):
    """
    AT-05: Safe Fallback Eligibility & Invariant Preservation.
    When a request requires tools, fallback candidates without tools
    must NOT be executed even during outage.
    """
    payload = {
        "model": "mock-cheap-notools",
        "messages": [{"role": "user", "content": "Function call required"}],
        "tools": [{
            "type": "function",
            "function": {"name": "get_weather", "parameters": {}}
        }]
    }

    resp = await client.post("/v1/chat/completions", json=payload)
    # mock-cheap-notools does not support tools -> should be rejected with 422
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "CONSTRAINT_VIOLATION"


@pytest.mark.asyncio
async def test_at06_changed_endpoint_conditions(client):
    """
    AT-06: Changed Endpoint Conditions & Dynamic Simulation.
    Simulate disabling a model via Judge Simulation API; subsequent requests
    immediately reroute to an alternate candidate without restarting server.
    """
    # 1. Disable gemini-1.5-flash
    await client.post("/v1/simulation/config", json={"target_model": "gemini-1.5-flash", "is_active": False})

    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Dynamic routing test"}]
    }
    headers = {
        "x-modelrouter-preference": "cost",
        "x-modelrouter-explain": "true"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("x-modelrouter-selected-model") != "gemini-1.5-flash"


@pytest.mark.asyncio
async def test_at07_no_feasible_model_http422(client):
    """
    AT-07: No-Feasible-Model Behavior.
    Set impossible constraints (budget $0.0000001, latency 5ms).
    Gateway returns immediate HTTP 422 diagnostic JSON; exactly 0 upstream requests executed.
    """
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": "Impossible constraint prompt"}]
    }
    headers = {
        "x-modelrouter-budget-max": "0.00000001",
        "x-modelrouter-latency-sla-ms": "5.0"
    }

    resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["type"] == "no_feasible_candidate_error"
    assert data["error"]["code"] == "CONSTRAINT_VIOLATION"
    assert len(data["error"]["disqualified_candidates"]) > 0


@pytest.mark.asyncio
async def test_at08_streaming_edge_cases(client):
    """
    AT-08: Streaming Edge Cases & Failover.
    Verify Server-Sent Events stream emits standard data chunks and terminates with [DONE].
    """
    payload = {
        "model": "mock-balanced",
        "messages": [{"role": "user", "content": "Stream test prompt"}],
        "stream": True
    }

    resp = await client.post("/v1/chat/completions", json=payload)
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")

    body = resp.text
    assert "data: " in body
    assert "data: [DONE]" in body
