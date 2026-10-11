import time
from typing import Dict
from dataclasses import dataclass, field

@dataclass
class CircuitState:
    state: str = "CLOSED"  # "CLOSED", "OPEN", "HALF_OPEN"
    failure_count: int = 0
    success_count: int = 0
    total_count: int = 0
    last_failure_time: float = 0.0
    opened_at: float = 0.0
    cooldown_seconds: float = 15.0
    failure_threshold_ratio: float = 0.50
    min_requests: int = 5
    consecutive_successes_needed: int = 3
    current_consecutive_successes: int = 0

class CircuitBreakerManager:
    def __init__(self):
        self._circuits: Dict[str, CircuitState] = {}

    def get_circuit(self, provider: str) -> CircuitState:
        if provider not in self._circuits:
            self._circuits[provider] = CircuitState()
        return self._circuits[provider]

    def is_available(self, provider: str) -> bool:
        circuit = self.get_circuit(provider)
        now = time.time()

        if circuit.state == "CLOSED":
            return True
        elif circuit.state == "OPEN":
            if now - circuit.opened_at >= circuit.cooldown_seconds:
                # Transition to HALF_OPEN to test a probe
                circuit.state = "HALF_OPEN"
                circuit.current_consecutive_successes = 0
                return True
            return False
        elif circuit.state == "HALF_OPEN":
            # Allow limited probe requests
            return True
        return True

    def record_success(self, provider: str):
        circuit = self.get_circuit(provider)
        circuit.total_count += 1
        circuit.success_count += 1

        if circuit.state == "HALF_OPEN":
            circuit.current_consecutive_successes += 1
            if circuit.current_consecutive_successes >= circuit.consecutive_successes_needed:
                # Reset to CLOSED
                circuit.state = "CLOSED"
                circuit.failure_count = 0
                circuit.current_consecutive_successes = 0

    def record_failure(self, provider: str):
        circuit = self.get_circuit(provider)
        circuit.total_count += 1
        circuit.failure_count += 1
        circuit.last_failure_time = time.time()

        if circuit.state == "HALF_OPEN":
            # Immediate trip back to OPEN
            circuit.state = "OPEN"
            circuit.opened_at = time.time()
        elif circuit.state == "CLOSED":
            if circuit.total_count >= circuit.min_requests:
                fail_ratio = circuit.failure_count / circuit.total_count
                if fail_ratio >= circuit.failure_threshold_ratio:
                    circuit.state = "OPEN"
                    circuit.opened_at = time.time()

    def get_all_states(self) -> Dict[str, Dict]:
        return {
            p: {
                "state": c.state,
                "failure_count": c.failure_count,
                "total_count": c.total_count,
                "opened_at": c.opened_at
            }
            for p, c in self._circuits.items()
        }

circuit_manager = CircuitBreakerManager()
