export interface RequestTraceItem {
  id: string;
  decision_id: string | null;
  http_status: number;
  total_latency_ms: number;
  gateway_overhead_ms: number;
  upstream_latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  metric_classification: string;
  error_code: string | null;
  created_at: string | null;
}

export interface CandidateEvaluationItem {
  model_name: string;
  provider: string;
  is_eligible: boolean;
  composite_score: number;
  estimated_cost_usd: number;
  estimated_latency_ms: number;
  rejection_reasons: string[];
}

export interface ExecutionAttemptItem {
  attempt_number: number;
  provider: string;
  model_name: string;
  status_code: number;
  latency_ms: number;
  error_message: string | null;
}

export interface DecisionDetail {
  id: string;
  rule_name: string | null;
  selected_model: string;
  selected_provider: string;
  preference_mode: string;
  composite_score: number;
  constraints_requested: Record<string, any>;
  fallback_chain: string[];
  justification: string;
  candidates: CandidateEvaluationItem[];
}

export interface TraceDetailResponse {
  trace: RequestTraceItem & { error_message: string | null };
  decision: DecisionDetail | null;
  attempts: ExecutionAttemptItem[];
}

export interface ModelProfileItem {
  id: string;
  model_name: string;
  provider_name: string;
  max_context_window: number;
  cost_per_1k_prompt_usd: number;
  cost_per_1k_completion_usd: number;
  baseline_p95_latency_ms: number;
  code_score: number;
  math_score: number;
  extraction_score: number;
  general_score: number;
  supports_tools: boolean;
  supports_json: boolean;
  is_active: boolean;
  circuit_state: string;
  sample_count: number;
  injected_error_code?: number | null;
}

export interface ModelAttributionItem {
  model: string;
  requests: number;
  share_percent: number;
  avg_latency_ms: number;
}

export interface SystemMetrics {
  total_requests: number;
  success_requests: number;
  error_requests: number;
  sla_compliance_rate_percent: number;
  total_cost_usd: number;
  average_gateway_overhead_ms: number;
  average_total_latency_ms: number;
  p50_latency_ms?: number;
  p95_latency_ms?: number;
  p99_latency_ms?: number;
  model_attribution?: ModelAttributionItem[];
  circuit_states: Record<string, { state: string; failure_count: number }>;
}

export interface RoutingRuleItem {
  id: string;
  name: string;
  max_budget_usd: number | null;
  max_latency_sla_ms: number | null;
  min_capability: number;
  preference: string;
  weight_cost: number;
  weight_latency: number;
  weight_quality: number;
  is_default: boolean;
}
