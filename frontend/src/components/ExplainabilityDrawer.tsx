import React from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import type { TraceDetailResponse } from '../types';

interface ExplainabilityDrawerProps {
  detail: TraceDetailResponse | null;
  isLoading: boolean;
  onClose: () => void;
}

export const ExplainabilityDrawer: React.FC<ExplainabilityDrawerProps> = ({
  detail,
  isLoading,
  onClose
}) => {
  if (!detail && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="h-6 w-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-gray-900">Decision Audit</h3>
                <span className="font-mono text-xs text-gray-500">
                  {detail?.trace.id}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Zero-LLM Fast Matrix Evaluation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <span>Fetching decision trace...</span>
            </div>
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs text-gray-800">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50/50">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block">Status</span>
                <span
                  className={`font-mono font-semibold text-xs ${
                    detail.trace.http_status === 200 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  HTTP {detail.trace.http_status}
                </span>
              </div>
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50/50">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block">Total Latency</span>
                <span className="font-mono font-semibold text-xs text-gray-900">
                  {detail.trace.total_latency_ms.toFixed(1)} ms
                </span>
              </div>
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50/50">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block">Gateway Overhead</span>
                <span className="font-mono font-semibold text-xs text-emerald-700">
                  {detail.trace.gateway_overhead_ms.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50/50">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block">Cost</span>
                <span className="font-mono font-semibold text-xs text-gray-900">
                  ${detail.trace.total_cost_usd.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Selected Candidate Summary */}
            {detail.decision && (
              <div className="p-4 rounded border border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-blue-900">
                      Selected Candidate:
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-900">
                      {detail.decision.selected_model}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {detail.decision.selected_provider}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-blue-800">
                    Score: {(detail.decision.composite_score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-white p-2.5 rounded border border-blue-100">
                  {detail.decision.justification}
                </p>
                <div className="flex items-center space-x-3 text-xs text-gray-500 font-mono">
                  <span>Policy: {detail.decision.rule_name || 'default'}</span>
                  <span>•</span>
                  <span>Preference: {detail.decision.preference_mode}</span>
                </div>
              </div>
            )}

            {/* Candidate Evaluation Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">
                  Candidate Evaluation Matrix ({detail.decision?.candidates.length || 0} Models)
                </h4>
                <span className="text-[11px] text-gray-500">Hard Constraints First</span>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse table-clean">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Provider</th>
                      <th>Eligibility</th>
                      <th>Score</th>
                      <th>Cost</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.decision?.candidates.map((cand) => (
                      <tr key={cand.model_name}>
                        <td className="font-mono font-medium text-gray-900">{cand.model_name}</td>
                        <td className="text-gray-500 font-mono text-xs">{cand.provider}</td>
                        <td>
                          {cand.is_eligible ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium text-xs">
                              <CheckCircle className="h-3 w-3" />
                              <span>Eligible</span>
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 text-red-600 font-medium text-xs">
                                <XCircle className="h-3 w-3" />
                                <span>Rejected</span>
                              </span>
                              <div className="text-[11px] text-gray-500 font-mono">
                                {cand.rejection_reasons.join(', ')}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="font-mono">
                          {cand.is_eligible ? (
                            <span className="text-blue-700 font-medium">
                              {(cand.composite_score * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="font-mono text-gray-600">
                          ${cand.estimated_cost_usd.toFixed(6)}
                        </td>
                        <td className="font-mono text-gray-600">
                          {cand.estimated_latency_ms.toFixed(0)} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fallback Chain Sequence */}
            {detail.decision?.fallback_chain && detail.decision.fallback_chain.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1.5">
                  Fallback Chain Sequence
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded border border-gray-200 bg-gray-50/50">
                  {detail.decision.fallback_chain.map((fb, idx) => (
                    <React.Fragment key={fb}>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded border ${
                          idx === 0
                            ? 'bg-blue-50 text-blue-800 border-blue-200 font-medium'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {idx + 1}. {fb}
                      </span>
                      {idx < detail.decision!.fallback_chain.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Attempts Waterfall */}
            <div>
              <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1.5">
                Execution Attempts ({detail.attempts.length})
              </h4>
              <div className="space-y-1.5">
                {detail.attempts.map((att) => (
                  <div
                    key={att.attempt_number}
                    className="p-2.5 rounded border border-gray-200 bg-white flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-gray-500 font-medium">
                        #{att.attempt_number}
                      </span>
                      <span className="font-mono font-medium text-gray-900">
                        {att.model_name}
                      </span>
                      <span className="text-gray-400 font-mono text-[11px]">
                        ({att.provider})
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-gray-600">
                        {att.latency_ms.toFixed(1)} ms
                      </span>
                      <span
                        className={`font-mono px-2 py-0.5 rounded text-xs font-medium ${
                          att.status_code === 200
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {att.status_code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
            No trace selected
          </div>
        )}
      </div>
    </div>
  );
};
