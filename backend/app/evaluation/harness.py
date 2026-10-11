import time
from typing import List, Dict, Any
from dataclasses import dataclass, field
from backend.app.core.engine import routing_engine, RequestRoutingContext
from backend.app.core.registry import model_catalog

BENCHMARK_TASKS = [
    {
        "id": "task_code_01",
        "domain": "code",
        "prompt": "Write a python function to compute the longest palindromic substring in O(n^2) time.",
        "requires_tools": False,
        "requires_json": False,
        "min_capability": 0.85
    },
    {
        "id": "task_math_01",
        "domain": "math",
        "prompt": "Solve the system of equations: 3x + 2y = 16 and x - y = 2.",
        "requires_tools": False,
        "requires_json": False,
        "min_capability": 0.80
    },
    {
        "id": "task_extract_01",
        "domain": "extraction",
        "prompt": "Extract the customer name, order total, and currency from: 'Invoice #8492 for Jane Doe: total $450.25 USD'.",
        "requires_tools": False,
        "requires_json": True,
        "min_capability": 0.75
    },
    {
        "id": "task_general_01",
        "domain": "general",
        "prompt": "Explain the significance of the Turing Test in modern artificial intelligence philosophy.",
        "requires_tools": False,
        "requires_json": False,
        "min_capability": 0.70
    },
    {
        "id": "task_budget_constrained",
        "domain": "general",
        "prompt": "Summarize this sentence concisely.",
        "max_budget_usd": 0.00005,
        "requires_tools": False,
        "requires_json": False,
        "min_capability": 0.50
    },
    {
        "id": "task_latency_constrained",
        "domain": "general",
        "prompt": "Quick status check.",
        "max_latency_sla_ms": 300.0,
        "requires_tools": False,
        "requires_json": False,
        "min_capability": 0.50
    }
]

@dataclass
class StrategyMetrics:
    strategy: str
    sample_size: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: float = 0.0
    total_capability_score: float = 0.0
    feasible_count: int = 0
    violation_count: int = 0
    selected_models: Dict[str, int] = field(default_factory=dict)

    def summary(self) -> Dict[str, Any]:
        count = max(1, self.feasible_count)
        return {
            "strategy": self.strategy,
            "sample_size": self.sample_size,
            "feasibility_rate_percent": round((self.feasible_count / max(1, self.sample_size)) * 100, 1),
            "mean_cost_usd": round(self.total_cost_usd / count, 6),
            "mean_latency_ms": round(self.total_latency_ms / count, 1),
            "mean_quality_score_percent": round((self.total_capability_score / count) * 100, 1),
            "constraint_violations": self.violation_count,
            "model_selection_distribution": self.selected_models
        }

class EvaluationHarness:
    """
    Reproducible evaluation harness comparing routing strategies with
    fixed-model baselines on representative tasks.
    """

    def run_strategy_benchmark(self, strategies: List[str] = None) -> Dict[str, Any]:
        if strategies is None:
            strategies = ["cost_first", "latency_first", "quality_first", "balanced"]

        catalog = model_catalog.get_all_models()
        results = {}

        for strat in strategies:
            metric = StrategyMetrics(strategy=strat)
            for task in BENCHMARK_TASKS:
                metric.sample_size += 1
                ctx = RequestRoutingContext(
                    messages=[{"role": "user", "content": task["prompt"]}],
                    max_budget_usd=task.get("max_budget_usd"),
                    max_latency_sla_ms=task.get("max_latency_sla_ms"),
                    min_capability=task.get("min_capability", 0.0),
                    preference=strat,
                    task_type=task["domain"],
                    requires_tools=task.get("requires_tools", False),
                    requires_json=task.get("requires_json", False)
                )

                decision = routing_engine.evaluate_candidates(ctx, catalog)
                if decision.is_feasible and decision.selected_model:
                    metric.feasible_count += 1
                    model = decision.selected_model
                    m_name = model["model_name"]
                    metric.selected_models[m_name] = metric.selected_models.get(m_name, 0) + 1

                    # Compute cost and latency for sample
                    p_tok = 50
                    c_tok = 50
                    c_in = model.get("cost_per_1k_prompt_usd", 0.001)
                    c_out = model.get("cost_per_1k_completion_usd", 0.002)
                    sample_cost = ((p_tok / 1000.0) * c_in) + ((c_tok / 1000.0) * c_out)
                    metric.total_cost_usd += sample_cost
                    metric.total_latency_ms += model.get("baseline_p95_latency_ms", 300.0)
                    metric.total_capability_score += routing_engine.get_task_capability_score(model, task["domain"])
                else:
                    metric.violation_count += 1

            results[strat] = metric.summary()

        return {
            "evaluation_timestamp": time.time(),
            "total_benchmark_tasks": len(BENCHMARK_TASKS),
            "strategies_evaluated": results
        }

evaluation_harness = EvaluationHarness()
