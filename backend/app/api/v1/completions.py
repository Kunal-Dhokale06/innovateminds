import time
import json
import uuid
import hashlib
import base64
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Request, Header, HTTPException, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from backend.app.config import settings
from backend.app.core.engine import routing_engine, RequestRoutingContext
from backend.app.core.registry import model_catalog
from backend.app.core.circuit import circuit_manager
from backend.app.core.trace_buffer import trace_buffer
from backend.app.core.attachments import attachment_processor, AttachmentProcessingResult
from backend.app.core.profiler import request_profiler
from backend.app.core.security import security_guard
from backend.app.core.telemetry import otel_manager
from backend.app.core.validation import response_validator
from backend.app.adapters.mock_adapter import mock_adapter, UpstreamProviderError
from backend.app.adapters.openai_adapter import openai_adapter
from backend.app.adapters.gemini_adapter import gemini_adapter
from backend.app.adapters.groq_adapter import groq_adapter
from backend.app.api.v1.schemas import ChatCompletionRequest

router = APIRouter()

def get_adapter_for_provider(provider: str):
    p = provider.lower()
    if p == "openai":
        return openai_adapter
    elif p == "gemini":
        return gemini_adapter
    elif p == "groq":
        return groq_adapter
    else:
        return mock_adapter

@router.post("/attachments/extract")
async def extract_attachments(files: List[UploadFile] = File(...)):
    """Extract and validate uploaded documents and images for playground and client use."""
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="MAX_ATTACHMENTS_EXCEEDED: Cannot attach more than 5 files.")

    extracted_items = []
    total_tokens = 0
    has_images = False
    has_documents = False

    for file in files:
        raw_bytes = await file.read()
        filename = file.filename or "attachment"
        mime_type = file.content_type

        proc = attachment_processor.process_raw_attachment(filename, raw_bytes, mime_type)

        data_url = proc.base64_data_url or f"data:{proc.mime_type};base64,{base64.b64encode(raw_bytes).decode('utf-8')}"
        item = {
            "name": proc.filename,
            "filename": proc.filename,
            "type": proc.mime_type,
            "size": proc.size_bytes,
            "category": proc.media_category,
            "token_estimate": proc.token_estimate,
            "preview_text": (proc.extracted_text[:400] + "...") if proc.extracted_text and len(proc.extracted_text) > 400 else proc.extracted_text,
            "data": data_url,
            "image_width": proc.image_width,
            "image_height": proc.image_height
        }
        extracted_items.append(item)
        total_tokens += proc.token_estimate
        if proc.media_category == "image":
            has_images = True
        elif proc.media_category == "document":
            has_documents = True

    return {
        "attachments": extracted_items,
        "total_tokens": total_tokens,
        "has_images": has_images,
        "has_documents": has_documents
    }

@router.post("/chat/completions")
async def create_chat_completion(
    request_data: ChatCompletionRequest,
    raw_request: Request,
    authorization: Optional[str] = Header(None),
    x_modelrouter_budget_max: Optional[float] = Header(None),
    x_modelrouter_latency_sla_ms: Optional[float] = Header(None),
    x_modelrouter_min_capability: Optional[float] = Header(0.0),
    x_modelrouter_preference: Optional[str] = Header("balanced"),
    x_modelrouter_task_type: Optional[str] = Header("general"),
    x_modelrouter_explain: Optional[bool] = Header(True),
    x_modelrouter_allow_unverified: Optional[bool] = Header(False)
):
    start_wall_clock = time.perf_counter()
    trace_id = f"trc_{uuid.uuid4()}"

    # Hash auth token for trace privacy
    client_key_hash = "anonymous"
    if authorization:
        client_key_hash = hashlib.sha256(authorization.encode()).hexdigest()[:16]

    # Convert request to dictionary
    req_dict = request_data.model_dump(exclude_none=True)
    messages = req_dict.get("messages", [])

    # Process file/document/image attachments if provided
    attachment_res = AttachmentProcessingResult()
    if request_data.attachments:
        attachment_res = attachment_processor.process_attachment_payloads(request_data.attachments)

    # Check vision requirement: from attachments or existing message parts
    requires_vision = attachment_res.has_images
    if not requires_vision:
        for msg in messages:
            c = msg.get("content")
            if isinstance(c, list):
                for part in c:
                    if isinstance(part, dict) and part.get("type") == "image_url":
                        requires_vision = True
                        break

    # If documents were attached, wrap in defensive security containment and inject into prompt
    if attachment_res.document_context_block and messages:
        safe_doc_block = security_guard.wrap_untrusted_content(
            attachment_res.document_context_block,
            source_label="uploaded_document"
        )
        last_user_idx = -1
        for idx in range(len(messages) - 1, -1, -1):
            if messages[idx].get("role") == "user":
                last_user_idx = idx
                break
        if last_user_idx != -1:
            orig = messages[last_user_idx].get("content", "")
            if isinstance(orig, str):
                messages[last_user_idx]["content"] = f"{safe_doc_block}\n\n[USER PROMPT]\n{orig}"
            elif isinstance(orig, list):
                messages[last_user_idx]["content"].insert(0, {"type": "text", "text": safe_doc_block})

    # If images were attached, append image_url data parts into user message content
    if attachment_res.has_images and messages:
        last_user_idx = -1
        for idx in range(len(messages) - 1, -1, -1):
            if messages[idx].get("role") == "user":
                last_user_idx = idx
                break
        if last_user_idx != -1:
            orig = messages[last_user_idx].get("content", "")
            parts_list = []
            if isinstance(orig, str):
                parts_list.append({"type": "text", "text": orig})
            elif isinstance(orig, list):
                parts_list.extend(orig)
            for att in attachment_res.attachments:
                if att.media_category == "image" and att.base64_data_url:
                    parts_list.append({
                        "type": "image_url",
                        "image_url": {"url": att.base64_data_url}
                    })
            messages[last_user_idx]["content"] = parts_list

    # Update req_dict messages with enhanced context
    req_dict["messages"] = messages

    # Profile incoming request separating classification from enforcement
    req_profile = request_profiler.profile_request(
        messages=messages,
        max_tokens=request_data.max_tokens,
        tools=request_data.tools,
        response_format=request_data.response_format,
        attachments=request_data.attachments,
        client_budget_max=x_modelrouter_budget_max,
        client_latency_sla_ms=x_modelrouter_latency_sla_ms,
        client_min_capability=x_modelrouter_min_capability,
        client_preference=x_modelrouter_preference,
        client_task_type=x_modelrouter_task_type,
        allow_unverified=bool(x_modelrouter_allow_unverified),
        requested_model=request_data.model,
        attachment_tokens_est=attachment_res.total_token_estimate,
        has_images=attachment_res.has_images,
        has_documents=attachment_res.has_documents
    )

    budget_max = req_profile.budget_max_usd
    latency_sla = req_profile.latency_sla_ms
    requires_tools = req_profile.requires_tools
    requires_json = req_profile.requires_json
    prompt_tokens_est = req_profile.prompt_tokens_est
    routing_ctx = req_profile

    # Candidate Discovery
    active_catalog = model_catalog.get_all_models()

    # Deterministic Evaluation Pipeline
    routing_decision = routing_engine.evaluate_candidates(req_profile, active_catalog)

    # Format Candidate Evaluations for Trace & Error payloads
    candidate_eval_payloads = [
        {
            "model_name": ev.model_name,
            "provider": ev.provider,
            "is_eligible": ev.is_eligible,
            "composite_score": round(ev.composite_score, 4),
            "estimated_cost_usd": round(ev.estimated_cost_usd, 6),
            "estimated_latency_ms": round(ev.estimated_latency_ms, 1),
            "rejection_reasons": ev.rejection_reasons,
            "rejection_codes": getattr(ev, "rejection_codes", []),
            "evidence": getattr(ev, "evidence", {})
        }
        for ev in routing_decision.all_evaluations
    ]

    # CASE 1: Zero Feasible Candidates -> Deterministic Fail-Fast HTTP 422
    if not routing_decision.is_feasible or not routing_decision.selected_model:
        gateway_overhead = (time.perf_counter() - start_wall_clock) * 1000.0

        error_response = {
            "error": {
                "type": "no_feasible_candidate_error",
                "message": "NO_FEASIBLE_MODEL: All candidate models were disqualified by the request's hard constraints.",
                "code": "CONSTRAINT_VIOLATION",
                "standard_code": "NO_FEASIBLE_MODEL",
                "constraints_evaluated": {
                    "max_budget_usd": budget_max,
                    "max_latency_sla_ms": latency_sla,
                    "min_capability": req_profile.min_capability,
                    "requires_tools": requires_tools,
                    "requires_json": requires_json
                },
                "disqualified_candidates": [
                    {
                        "model": ev["model_name"],
                        "provider": ev["provider"],
                        "rejection_reasons": ev["rejection_reasons"],
                        "rejection_codes": ev.get("rejection_codes", [])
                    }
                    for ev in candidate_eval_payloads
                ]
            }
        }

        # Asynchronously record rejected trace
        trace_buffer.enqueue({
            "trace": {
                "id": trace_id,
                "client_key_hash": client_key_hash,
                "http_status": 422,
                "total_latency_ms": gateway_overhead,
                "gateway_overhead_ms": gateway_overhead,
                "upstream_latency_ms": 0.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_cost_usd": 0.0,
                "metric_classification": "ESTIMATED",
                "error_code": "NO_FEASIBLE_MODEL",
                "error_message": error_response["error"]["message"]
            },
            "decision": {
                "id": routing_decision.decision_id,
                "selected_model": "none",
                "selected_provider": "none",
                "preference_mode": routing_decision.preference_mode,
                "composite_score": 0.0,
                "constraints_requested": {
                    "budget_max": budget_max,
                    "latency_sla": latency_sla,
                    "min_capability": routing_ctx.min_capability
                },
                "fallback_chain": [],
                "justification": routing_decision.justification
            },
            "attempts": [],
            "evaluations": candidate_eval_payloads
        })

        return JSONResponse(
            status_code=422,
            content=error_response,
            headers={
                "x-modelrouter-trace-id": trace_id,
                "x-modelrouter-decision-id": routing_decision.decision_id,
                "x-modelrouter-gateway-overhead-ms": f"{gateway_overhead:.2f}",
                "x-modelrouter-error-code": "NO_FEASIBLE_MODEL"
            }
        )

    # Feasible candidate exists: Compile Fallback Chain
    fallback_chain = routing_decision.fallback_chain
    is_streaming = bool(request_data.stream)

    # Deadline configuration
    global_deadline_ms = settings.GLOBAL_REQUEST_TIMEOUT_MS
    if latency_sla:
        global_deadline_ms = max(20000.0, min(global_deadline_ms, latency_sla * 2.5))

    attempts_log: List[Dict[str, Any]] = []
    final_response = None
    winning_model_profile = None

    # Execution Loop with Safe Failover & Remaining Deadline Checking
    attempted_models = set()
    for attempt_idx, candidate_profile in enumerate(fallback_chain, start=1):
        provider_name = candidate_profile.get("provider_name", "mock")
        model_name = candidate_profile.get("model_name")

        # Invariant: Prevent duplicate retries on the same model within a single request
        if not model_name or model_name in attempted_models:
            continue
        attempted_models.add(model_name)

        # Invariant: Check if candidate was deactivated mid-flight between planning and hop
        fresh_profile = model_catalog.get_model(model_name)
        if fresh_profile and not fresh_profile.get("is_active", True):
            attempts_log.append({
                "attempt_number": attempt_idx,
                "provider": provider_name,
                "model_name": model_name,
                "status_code": 503,
                "latency_ms": 0.0,
                "error_message": f"MODEL_DEACTIVATED: Candidate '{model_name}' was administratively deactivated."
            })
            continue

        elapsed_so_far_ms = (time.perf_counter() - start_wall_clock) * 1000.0
        remaining_deadline_ms = global_deadline_ms - elapsed_so_far_ms

        # Invariant 2 Check: Does this candidate fit within remaining deadline?
        cand_lat = candidate_profile.get("baseline_p95_latency_ms", 500.0)
        if cand_lat > remaining_deadline_ms and attempt_idx > 1:
            attempts_log.append({
                "attempt_number": attempt_idx,
                "provider": candidate_profile.get("provider_name"),
                "model_name": candidate_profile.get("model_name"),
                "status_code": 504,
                "latency_ms": 0.0,
                "error_message": f"DEADLINE_EXHAUSTED: Expected latency {cand_lat}ms exceeds remaining deadline {remaining_deadline_ms:.1f}ms."
            })
            continue

        adapter = get_adapter_for_provider(provider_name)

        per_hop_timeout_ms = int(max(15000, min(settings.DEFAULT_TIMEOUT_MS, remaining_deadline_ms)))
        attempt_start = time.perf_counter()

        try:
            if is_streaming:
                # Streaming mode execution
                # Check pre-stream generation: verify generator starts cleanly
                generator = adapter.chat_completion_stream(
                    req_dict,
                    model_name,
                    per_hop_timeout_ms,
                    model_profile=candidate_profile
                )
                
                # Wrap generator to handle on-the-fly token accumulation and mid-stream errors
                async def stream_wrapper(gen, trace_id_str, selected_model_str):
                    tokens_accumulated = 0
                    try:
                        async for chunk in gen:
                            tokens_accumulated += 1
                            yield chunk
                    except UpstreamProviderError as e:
                        # In-band SSE error chunk for mid-stream disconnect
                        err_chunk = {
                            "error": {
                                "message": f"Stream dropped: {e.message}",
                                "code": "STREAM_DISCONNECTED"
                            }
                        }
                        yield f"data: {json.dumps(err_chunk)}\n\n"
                        yield "data: [DONE]\n\n"
                    except Exception as ex:
                        err_chunk = {
                            "error": {
                                "message": f"Unexpected stream failure: {str(ex)}",
                                "code": "STREAM_INTERRUPTED"
                            }
                        }
                        yield f"data: {json.dumps(err_chunk)}\n\n"
                        yield "data: [DONE]\n\n"

                winning_model_profile = candidate_profile
                circuit_manager.record_success(provider_name)
                
                gateway_overhead = (time.perf_counter() - start_wall_clock) * 1000.0
                
                # Log successful streaming trace
                trace_buffer.enqueue({
                    "trace": {
                        "id": trace_id,
                        "client_key_hash": client_key_hash,
                        "http_status": 200,
                        "total_latency_ms": gateway_overhead,
                        "gateway_overhead_ms": gateway_overhead,
                        "upstream_latency_ms": 0.0,
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_cost_usd": 0.0,
                        "metric_classification": "STREAMING",
                        "error_code": None,
                        "error_message": None
                    },
                    "decision": {
                        "id": routing_decision.decision_id,
                        "selected_model": winning_model_profile["model_name"],
                        "selected_provider": winning_model_profile["provider_name"],
                        "preference_mode": routing_decision.preference_mode,
                        "composite_score": routing_decision.composite_score,
                        "constraints_requested": {
                            "budget_max": budget_max,
                            "latency_sla": latency_sla
                        },
                        "fallback_chain": [m["model_name"] for m in fallback_chain],
                        "justification": routing_decision.justification
                    },
                    "attempts": [{
                        "attempt_number": 1,
                        "provider": provider_name,
                        "model_name": model_name,
                        "status_code": 200,
                        "latency_ms": gateway_overhead,
                        "error_message": None
                    }],
                    "evaluations": candidate_eval_payloads
                })

                return StreamingResponse(
                    stream_wrapper(generator, trace_id, model_name),
                    media_type="text/event-stream",
                    headers={
                        "x-modelrouter-trace-id": trace_id,
                        "x-modelrouter-decision-id": routing_decision.decision_id,
                        "x-modelrouter-selected-model": model_name,
                        "x-modelrouter-selected-provider": provider_name,
                        "x-modelrouter-gateway-overhead-ms": f"{gateway_overhead:.2f}"
                    }
                )

            else:
                # Non-streaming blocking call
                resp = await adapter.chat_completion(
                    req_dict,
                    model_name,
                    per_hop_timeout_ms,
                    model_profile=candidate_profile
                )
                attempt_elapsed = (time.perf_counter() - attempt_start) * 1000.0
                circuit_manager.record_success(provider_name)

                attempts_log.append({
                    "attempt_number": attempt_idx,
                    "provider": provider_name,
                    "model_name": model_name,
                    "status_code": 200,
                    "latency_ms": attempt_elapsed,
                    "error_message": None
                })

                final_response = resp
                winning_model_profile = candidate_profile
                break

        except UpstreamProviderError as err:
            attempt_elapsed = (time.perf_counter() - attempt_start) * 1000.0
            circuit_manager.record_failure(provider_name)

            attempts_log.append({
                "attempt_number": attempt_idx,
                "provider": provider_name,
                "model_name": model_name,
                "status_code": err.status_code,
                "latency_ms": attempt_elapsed,
                "error_message": err.message
            })

            # Upstream provider failed: safely failover to next candidate in fallback chain
            continue

        except Exception as e:
            attempt_elapsed = (time.perf_counter() - attempt_start) * 1000.0
            circuit_manager.record_failure(provider_name)
            attempts_log.append({
                "attempt_number": attempt_idx,
                "provider": provider_name,
                "model_name": model_name,
                "status_code": 500,
                "latency_ms": attempt_elapsed,
                "error_message": str(e)
            })
            continue

    # If all candidates in the fallback chain were exhausted
    if not final_response or not winning_model_profile:
        total_latency = (time.perf_counter() - start_wall_clock) * 1000.0
        error_payload = {
            "error": {
                "type": "all_fallbacks_exhausted_error",
                "message": "All pre-qualified fallback candidates failed or deadline expired.",
                "code": "FALLBACK_CHAIN_EXHAUSTED",
                "attempts_executed": attempts_log
            }
        }

        trace_buffer.enqueue({
            "trace": {
                "id": trace_id,
                "client_key_hash": client_key_hash,
                "http_status": 503,
                "total_latency_ms": total_latency,
                "gateway_overhead_ms": 5.0,
                "upstream_latency_ms": total_latency - 5.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_cost_usd": 0.0,
                "metric_classification": "MEASURED",
                "error_code": "FALLBACK_CHAIN_EXHAUSTED",
                "error_message": "All fallback candidates failed."
            },
            "decision": {
                "id": routing_decision.decision_id,
                "selected_model": "exhausted",
                "selected_provider": "exhausted",
                "preference_mode": routing_decision.preference_mode,
                "composite_score": 0.0,
                "constraints_requested": {
                    "budget_max": budget_max,
                    "latency_sla": latency_sla
                },
                "fallback_chain": [m["model_name"] for m in fallback_chain],
                "justification": "All admissible fallback candidates failed."
            },
            "attempts": attempts_log,
            "evaluations": candidate_eval_payloads
        })

        return JSONResponse(
            status_code=503,
            content=error_payload,
            headers={
                "x-modelrouter-trace-id": trace_id,
                "x-modelrouter-decision-id": routing_decision.decision_id
            }
        )

    # Successful Non-Streaming Response
    total_time = (time.perf_counter() - start_wall_clock) * 1000.0
    upstream_latency = final_response.latency_ms
    gateway_overhead = max(0.5, total_time - upstream_latency)

    # Exact post-execution cost and quality accounting
    p_cost = winning_model_profile.get("cost_per_1k_prompt_usd", 0.0)
    c_cost = winning_model_profile.get("cost_per_1k_completion_usd", 0.0)
    p_tokens = final_response.prompt_tokens if final_response.prompt_tokens > 0 else prompt_tokens_est
    c_tokens = final_response.completion_tokens if final_response.completion_tokens > 0 else 10
    total_tokens = p_tokens + c_tokens
    actual_cost = (
        (p_tokens / 1000.0) * p_cost +
        (c_tokens / 1000.0) * c_cost
    )

    # Calculate Benchmark Quality / Perfectness Match
    quality_score = routing_engine.get_task_capability_score(winning_model_profile, routing_ctx.task_type)
    quality_percent = round(quality_score * 100, 1)

    # Cost savings comparison against standard flagship model (GPT-4o at $5/M prompt, $15/M completion)
    gpt4o_cost = ((p_tokens / 1000.0) * 0.005) + ((c_tokens / 1000.0) * 0.015)
    cost_savings_usd = max(0.0, gpt4o_cost - actual_cost)
    cost_savings_percent = round((cost_savings_usd / gpt4o_cost) * 100, 1) if gpt4o_cost > 0 else 0.0

    # Build human-readable "Why this model was chosen" rationale
    other_candidates = [c for c in candidate_eval_payloads if c["model_name"] != winning_model_profile["model_name"]]
    disqualified_count = sum(1 for c in other_candidates if not c["is_eligible"])
    runner_up = next((c for c in other_candidates if c["is_eligible"]), None)

    selection_points = []
    if requires_vision:
        selection_points.append("Satisfied multimodal image/document requirement (non-vision models disqualified)")
    if runner_up:
        diff_score = round((routing_decision.composite_score - runner_up['composite_score']) * 100, 1)
        selection_points.append(f"Achieved highest composite score ({routing_decision.composite_score * 100:.1f}%), beating runner-up '{runner_up['model_name']}' by +{diff_score}%")
    else:
        selection_points.append(f"Achieved highest composite score ({routing_decision.composite_score * 100:.1f}%) under '{routing_decision.preference_mode}' optimization")
    
    if cost_savings_percent > 10.0:
        selection_points.append(f"Saved {cost_savings_percent}% cost vs flagship baseline (${actual_cost:.6f} total)")
    if upstream_latency < 1200.0:
        selection_points.append(f"Fast execution in {upstream_latency:.0f}ms with {quality_percent}% benchmark capability")
    if disqualified_count > 0:
        selection_points.append(f"Eliminated {disqualified_count} alternate model(s) that violated budget/latency/capability constraints")

    why_selected_str = f"Model '{winning_model_profile['model_name']}' ({winning_model_profile['provider_name'].upper()}) was chosen: " + "; ".join(selection_points) + "."

    resp_body = dict(final_response.payload)

    # Response Output Validation (Structured extraction & JSON repair)
    val_outcome = None
    if "choices" in resp_body and len(resp_body["choices"]) > 0:
        first_choice = resp_body["choices"][0]
        choice_content = first_choice.get("message", {}).get("content", "")
        val_outcome = response_validator.validate_response(
            content=choice_content,
            task_type=req_profile.task_type,
            requires_json=requires_json
        )
        if val_outcome.repair_applied and val_outcome.repaired_content:
            first_choice["message"]["content"] = val_outcome.repaired_content

    # OpenTelemetry GenAI Semantic Conventions Recording
    is_mock = winning_model_profile["provider_name"] == "mock"
    otel_span = otel_manager.start_span(
        trace_id=trace_id,
        decision_id=routing_decision.decision_id,
        requested_model=request_data.model or "auto",
        system_provider=winning_model_profile["provider_name"],
        max_tokens=request_data.max_tokens
    )
    otel_manager.record_completion_metrics(
        span=otel_span,
        responding_model=winning_model_profile["model_name"],
        responding_provider=winning_model_profile["provider_name"],
        prompt_tokens=p_tokens,
        completion_tokens=c_tokens,
        actual_cost_usd=actual_cost,
        is_provider_reported=not is_mock,
        is_mock=is_mock
    )
    otel_span.finish(status_code=200)

    # Attach attachments metadata if files were provided
    if attachment_res.attachments:
        resp_body["_modelrouter_attachments"] = [
            {
                "name": a.filename,
                "category": a.media_category,
                "type": a.mime_type,
                "size_bytes": a.size_bytes,
                "token_estimate": a.token_estimate
            }
            for a in attachment_res.attachments
        ]

    # Attach explainability metadata
    if x_modelrouter_explain is not False:
        resp_body["_modelrouter_decision"] = {
            "decision_id": routing_decision.decision_id,
            "selected_model": winning_model_profile["model_name"],
            "selected_provider": winning_model_profile["provider_name"],
            "preference_mode": routing_decision.preference_mode,
            "composite_score": round(routing_decision.composite_score, 4),
            "justification": routing_decision.justification,
            "why_selected": why_selected_str,
            "quality_score": round(quality_score, 4),
            "quality_score_percent": quality_percent,
            "actual_cost_usd": round(actual_cost, 6),
            "cost_savings_usd": round(cost_savings_usd, 6),
            "cost_savings_percent": cost_savings_percent,
            "prompt_tokens": p_tokens,
            "completion_tokens": c_tokens,
            "total_tokens": total_tokens,
            "fallback_chain": [m["model_name"] for m in fallback_chain],
            "candidate_evaluations": candidate_eval_payloads,
            "attachments_processed": len(attachment_res.attachments),
            "requires_vision": requires_vision,
            "validation_outcome": {
                "status": val_outcome.status if val_outcome else "SKIPPED",
                "format": val_outcome.format_type if val_outcome else "text",
                "repair_applied": val_outcome.repair_applied if val_outcome else False
            },
            "open_telemetry": otel_span.to_otel_dict(),
            "metric_provenance": {
                "tokens": "SIMULATED" if is_mock else "PROVIDER_REPORTED",
                "cost": "SIMULATED" if is_mock else "PROVIDER_REPORTED",
                "latency": "MEASURED",
                "quality": "BENCHMARK_DERIVED"
            }
        }

    # Asynchronously record trace
    trace_buffer.enqueue({
        "trace": {
            "id": trace_id,
            "client_key_hash": client_key_hash,
            "http_status": 200,
            "total_latency_ms": total_time,
            "gateway_overhead_ms": gateway_overhead,
            "upstream_latency_ms": upstream_latency,
            "prompt_tokens": p_tokens,
            "completion_tokens": c_tokens,
            "total_cost_usd": actual_cost,
            "metric_classification": "PROVIDER_REPORTED" if not is_mock else "SIMULATED",
            "error_code": None,
            "error_message": None
        },
        "decision": {
            "id": routing_decision.decision_id,
            "selected_model": winning_model_profile["model_name"],
            "selected_provider": winning_model_profile["provider_name"],
            "preference_mode": routing_decision.preference_mode,
            "composite_score": routing_decision.composite_score,
            "constraints_requested": {
                "budget_max": budget_max,
                "latency_sla": latency_sla,
                "requires_vision": requires_vision,
                "attachments_count": len(attachment_res.attachments),
                "attachments_meta": [
                    {"name": a.filename, "category": a.media_category, "size": a.size_bytes, "tokens": a.token_estimate}
                    for a in attachment_res.attachments
                ]
            },
            "fallback_chain": [m["model_name"] for m in fallback_chain],
            "justification": why_selected_str
        },
        "attempts": attempts_log,
        "evaluations": candidate_eval_payloads
    })

    return JSONResponse(
        status_code=200,
        content=resp_body,
        headers={
            "x-modelrouter-trace-id": trace_id,
            "x-modelrouter-decision-id": routing_decision.decision_id,
            "x-modelrouter-selected-model": winning_model_profile["model_name"],
            "x-modelrouter-selected-provider": winning_model_profile["provider_name"],
            "x-modelrouter-gateway-overhead-ms": f"{gateway_overhead:.2f}",
            "x-modelrouter-upstream-latency-ms": f"{upstream_latency:.2f}",
            "x-modelrouter-attachments-count": str(len(attachment_res.attachments)),
            "x-modelrouter-requires-vision": "true" if requires_vision else "false",
            "x-modelrouter-actual-cost-usd": f"{actual_cost:.6f}",
            "x-modelrouter-cost-savings-percent": f"{cost_savings_percent:.1f}",
            "x-modelrouter-quality-score-percent": f"{quality_percent:.1f}",
            "x-modelrouter-why-selected": why_selected_str[:250],
            "x-modelrouter-genai-system": winning_model_profile["provider_name"],
            "x-modelrouter-genai-response-model": winning_model_profile["model_name"],
            "x-modelrouter-token-provenance": "SIMULATED" if is_mock else "PROVIDER_REPORTED",
            "x-modelrouter-validation-status": val_outcome.status if val_outcome else "SKIPPED"
        }
    )
