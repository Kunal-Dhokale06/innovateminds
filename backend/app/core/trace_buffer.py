import asyncio
import logging
from typing import Dict, Any, List
from backend.app.db.session import SessionLocal
from backend.app.db.models import RequestTrace, RoutingDecision, CandidateEvaluation, ExecutionAttempt

logger = logging.getLogger("modelrouter.trace_buffer")

class TraceBufferWorker:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
        self._worker_task: asyncio.Task | None = None
        self._running = False

    def start(self):
        if not self._running:
            self._running = True
            self._worker_task = asyncio.create_task(self._process_queue())
            logger.info("TraceBuffer background persister worker started.")

    async def stop(self):
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            logger.info("TraceBuffer background persister worker stopped.")

    def enqueue(self, trace_payload: Dict[str, Any]):
        try:
            self.queue.put_nowait(trace_payload)
        except asyncio.QueueFull:
            logger.warning("TraceBuffer queue is full, dropping trace event.")

    async def _process_queue(self):
        while self._running:
            try:
                batch = []
                item = await self.queue.get()
                batch.append(item)
                self.queue.task_done()

                while len(batch) < 20 and not self.queue.empty():
                    item = self.queue.get_nowait()
                    batch.append(item)
                    self.queue.task_done()

                # Run persistence in thread pool
                await asyncio.to_thread(self._persist_batch_sync, batch)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in TraceBuffer worker: {e}", exc_info=True)
                await asyncio.sleep(0.5)

    def _persist_batch_sync(self, batch: List[Dict[str, Any]]):
        with SessionLocal() as session:
            try:
                for item in batch:
                    trace_info = item.get("trace", {})
                    decision_info = item.get("decision", {})
                    attempts = item.get("attempts", [])
                    evaluations = item.get("evaluations", [])

                    db_decision = None
                    if decision_info:
                        db_decision = RoutingDecision(
                            id=decision_info.get("id"),
                            trace_id=trace_info.get("id"),
                            rule_name=decision_info.get("rule_name"),
                            selected_model_id=decision_info.get("selected_model", ""),
                            selected_provider=decision_info.get("selected_provider", ""),
                            preference_mode=decision_info.get("preference_mode", "balanced"),
                            composite_score=decision_info.get("composite_score", 0.0),
                            constraints_requested=decision_info.get("constraints_requested", {}),
                            compiled_fallback_chain=decision_info.get("fallback_chain", []),
                            justification=decision_info.get("justification", "")
                        )
                        session.add(db_decision)

                        for ev in evaluations:
                            db_eval = CandidateEvaluation(
                                decision_id=db_decision.id,
                                model_name=ev.get("model_name", ""),
                                provider=ev.get("provider", ""),
                                is_eligible=ev.get("is_eligible", False),
                                composite_score=ev.get("composite_score", 0.0),
                                estimated_cost_usd=ev.get("estimated_cost_usd", 0.0),
                                estimated_latency_ms=ev.get("estimated_latency_ms", 0.0),
                                rejection_reasons=ev.get("rejection_reasons", [])
                            )
                            session.add(db_eval)

                    db_trace = RequestTrace(
                        id=trace_info.get("id"),
                        decision_id=db_decision.id if db_decision else None,
                        client_key_hash=trace_info.get("client_key_hash", "anonymous"),
                        http_status=trace_info.get("http_status", 200),
                        total_latency_ms=trace_info.get("total_latency_ms", 0.0),
                        gateway_overhead_ms=trace_info.get("gateway_overhead_ms", 0.0),
                        upstream_latency_ms=trace_info.get("upstream_latency_ms", 0.0),
                        prompt_tokens=trace_info.get("prompt_tokens", 0),
                        completion_tokens=trace_info.get("completion_tokens", 0),
                        total_cost_usd=trace_info.get("total_cost_usd", 0.0),
                        metric_classification=trace_info.get("metric_classification", "MEASURED"),
                        error_code=trace_info.get("error_code"),
                        error_message=trace_info.get("error_message")
                    )
                    session.add(db_trace)

                    for att in attempts:
                        db_att = ExecutionAttempt(
                            trace_id=db_trace.id,
                            attempt_number=att.get("attempt_number", 1),
                            provider=att.get("provider", ""),
                            model_name=att.get("model_name", ""),
                            status_code=att.get("status_code", 200),
                            latency_ms=att.get("latency_ms", 0.0),
                            error_message=att.get("error_message")
                        )
                        session.add(db_att)

                session.commit()
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to persist trace batch: {e}", exc_info=True)

trace_buffer = TraceBufferWorker()
