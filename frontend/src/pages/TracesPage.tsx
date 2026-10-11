import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, X, CheckCircle, XCircle, AlertTriangle, Layers, Clock } from 'lucide-react';
import { fetchTraces, fetchTraceDetail } from '../api';
import type { RequestTraceItem, TraceDetailResponse } from '../types';

interface TracesPageProps {
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
}

export const TracesPage: React.FC<TracesPageProps> = ({ selectedTraceId, onSelectTrace }) => {
  const [traces, setTraces] = useState<RequestTraceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<TraceDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTraces(100, 0, statusFilter);
      setTraces(res.traces);
    } catch (err) {
      console.error('Error fetching traces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraces();
  }, [statusFilter]);

  // Load trace detail whenever selectedTraceId changes
  useEffect(() => {
    if (!selectedTraceId) {
      setSelectedDetail(null);
      return;
    }

    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        const detail = await fetchTraceDetail(selectedTraceId);
        setSelectedDetail(detail);
      } catch (err) {
        console.error('Error loading trace detail:', err);
      } finally {
        setIsDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedTraceId]);

  const filteredTraces = traces.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.id.toLowerCase().includes(term) || (t.error_code && t.error_code.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            Live Trace Inspector & Explainability
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auditable execution logs, candidate evaluations, and mathematical decision breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTraces}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search trace ID or error code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === undefined ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Statuses
          </button>
          <button
            onClick={() => setStatusFilter(200)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 200 ? 'bg-emerald-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            200 OK (Success)
          </button>
          <button
            onClick={() => setStatusFilter(422)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 422 ? 'bg-amber-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            422 (Constraint Violation)
          </button>
          <button
            onClick={() => setStatusFilter(503)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 503 ? 'bg-red-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            503 (Outage / Exhausted)
          </button>
        </div>
      </div>

      {/* Main Traces Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trace ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Total Latency</th>
                <th className="py-3 px-4">Proxy Overhead</th>
                <th className="py-3 px-4">Tokens</th>
                <th className="py-3 px-4">Actual Cost</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTraces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    No traces found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredTraces.map((trace) => {
                  const isSelected = selectedTraceId === trace.id;
                  return (
                    <tr
                      key={trace.id}
                      onClick={() => onSelectTrace(trace.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-900/30 border-l-2 border-blue-500' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          trace.http_status === 200
                            ? 'badge-success'
                            : trace.http_status === 422
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}>
                          {trace.http_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-semibold">
                        {trace.id}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                        {trace.created_at ? new Date(trace.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {trace.total_latency_ms.toFixed(1)}ms
                      </td>
                      <td className="py-3 px-4 text-cyan-400 font-bold">
                        {trace.gateway_overhead_ms.toFixed(1)}ms
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {trace.prompt_tokens + trace.completion_tokens}
                      </td>
                      <td className="py-3 px-4 text-amber-300">
                        ${trace.total_cost_usd.toFixed(6)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-sans uppercase">
                          {trace.metric_classification}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-blue-400 hover:text-blue-300 font-sans text-xs underline">
                          Audit
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sliding Explainability Drawer */}
      {selectedTraceId && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[580px] lg:w-[680px] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 overflow-y-auto p-6 space-y-6 animate-slideLeft">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Decision Audit</span>
                {selectedDetail && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    selectedDetail.trace.http_status === 200 ? 'badge-success' : 'badge-danger'
                  }`}>
                    HTTP {selectedDetail.trace.http_status}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white font-mono mt-0.5">
                {selectedTraceId}
              </h2>
            </div>
            <button
              onClick={() => onSelectTrace(null)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isDetailLoading || !selectedDetail ? (
            <div className="py-24 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Loading explainability matrix...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Timing Waterfall Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Total Latency</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {selectedDetail.trace.total_latency_ms.toFixed(1)}ms
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-cyan-400 font-medium">Proxy Overhead</span>
                  <div className="text-lg font-bold text-cyan-300 font-mono mt-1">
                    {selectedDetail.trace.gateway_overhead_ms.toFixed(1)}ms
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-amber-400 font-medium">Authoritative Cost</span>
                  <div className="text-lg font-bold text-amber-300 font-mono mt-1">
                    ${selectedDetail.trace.total_cost_usd.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Justification Banner */}
              {selectedDetail.decision ? (
                <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      Winning Model: <strong className="text-white font-mono">{selectedDetail.decision.selected_model}</strong> ({selectedDetail.decision.selected_provider})
                    </span>
                    <span className="font-mono bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                      Score: {selectedDetail.decision.composite_score.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedDetail.decision.justification}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {selectedDetail.trace.error_message || 'Zero candidates met hard constraints.'}
                </div>
              )}

              {/* Candidate Evaluation Matrix */}
              {selectedDetail.decision?.candidates && selectedDetail.decision.candidates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-blue-400" />
                      Candidate Evaluation Matrix ({selectedDetail.decision.candidates.length} evaluated)
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {selectedDetail.decision.candidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs transition-all ${
                          cand.is_eligible
                            ? 'bg-slate-900/60 border-slate-700/80 hover:border-blue-500/50'
                            : 'bg-red-950/15 border-red-900/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {cand.is_eligible ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                            <span className="font-mono font-bold text-white">{cand.model_name}</span>
                            <span className="text-[10px] uppercase text-slate-500">({cand.provider})</span>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-slate-400">${cand.estimated_cost_usd.toFixed(6)}</span>
                            <span className="text-slate-400">{cand.estimated_latency_ms.toFixed(0)}ms</span>
                            {cand.is_eligible ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                                Score: {cand.composite_score.toFixed(3)}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">
                                Disqualified
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Explicit Rejection Reasons */}
                        {!cand.is_eligible && cand.rejection_reasons.length > 0 && (
                          <div className="mt-2 pl-6 space-y-1">
                            {cand.rejection_reasons.map((r, rIdx) => (
                              <div key={rIdx} className="text-[11px] text-red-400/90 font-mono flex items-start gap-1.5">
                                <span className="text-red-500">•</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Attempts Waterfall */}
              {selectedDetail.attempts && selectedDetail.attempts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-400" />
                    Execution Attempts & Failover Waterfall
                  </h3>

                  <div className="space-y-2">
                    {selectedDetail.attempts.map((att) => (
                      <div
                        key={att.attempt_number}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 font-mono">
                          <span className="text-slate-500">Attempt #{att.attempt_number}</span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            att.status_code === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {att.status_code}
                          </span>
                          <span className="text-white">{att.model_name}</span>
                        </div>
                        <div className="font-mono text-slate-400 text-right">
                          <span>{att.latency_ms.toFixed(1)}ms</span>
                          {att.error_message && (
                            <p className="text-[10px] text-red-400 max-w-[200px] truncate">{att.error_message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
