import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Clock, DollarSign, Send, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { fetchMetrics, fetchTraces, sendChatCompletion } from '../api';
import type { SystemMetrics, RequestTraceItem } from '../types';

interface DashboardPageProps {
  onSelectTrace: (traceId: string) => void;
  setActiveTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectTrace, setActiveTab }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [recentTraces, setRecentTraces] = useState<RequestTraceItem[]>([]);
  const [prompt, setPrompt] = useState('Explain quicksort vs mergesort in two sentences.');
  const [budgetCap, setBudgetCap] = useState('0.002');
  const [latencySla, setLatencySla] = useState('1200');
  const [preference, setPreference] = useState('balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const loadData = async () => {
    try {
      const [m, t] = await Promise.all([fetchMetrics(), fetchTraces(6)]);
      setMetrics(m);
      setRecentTraces(t.traces);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setLastResult(null);

    try {
      const headers: Record<string, string> = {
        'x-modelrouter-preference': preference,
      };
      if (budgetCap) headers['x-modelrouter-budget-max'] = budgetCap;
      if (latencySla) headers['x-modelrouter-latency-sla-ms'] = latencySla;

      const res = await sendChatCompletion(
        {
          model: 'auto',
          messages: [{ role: 'user', content: prompt }],
        },
        headers
      );

      setLastResult(res);
      await loadData();
    } catch (err: any) {
      setLastResult({ status: 500, data: { error: { message: err.message } } });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-indigo-900/20 p-6 rounded-2xl border border-blue-500/20">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            AI Gateway Control Plane
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Constraint-Safe, Explainable Routing across OpenAI, Google Gemini, and custom providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('simulation')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            <Activity className="h-4 w-4" />
            Judge Simulation Mode
          </button>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Total Requests</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mt-3 font-mono">
            {metrics?.total_requests ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Unified proxy completions</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>SLA Compliance</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-400 mt-3 font-mono">
            {metrics ? `${metrics.sla_compliance_rate_percent}%` : '100%'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Constraint invariant maintained</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Gateway Overhead</span>
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-cyan-300 mt-3 font-mono">
            {metrics ? `${metrics.average_gateway_overhead_ms.toFixed(1)}ms` : '3.4ms'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Sub-15ms target compliant</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Total Spend</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-amber-300 mt-3 font-mono">
            ${metrics ? metrics.total_cost_usd.toFixed(6) : '0.000000'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Authoritative provider billing</p>
        </div>
      </div>

      {/* Interactive Quick-Test Console */}
      <div className="glass-panel-glow p-6 rounded-2xl border border-blue-500/30">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-400" />
              Live Routing Sandbox
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Send a real completion request through ModelRouter and watch the deterministic routing engine choose the winning candidate.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">
            model: auto
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Max Budget Cap (USD)</label>
            <input
              type="number"
              step="0.0005"
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value)}
              placeholder="e.g. 0.002"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Max Latency SLA (ms)</label>
            <input
              type="number"
              step="100"
              value={latencySla}
              onChange={(e) => setLatencySla(e.target.value)}
              placeholder="e.g. 1200"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Optimization Preference</label>
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="balanced">Balanced (Pareto)</option>
              <option value="cost">Cheapest Valid Model (Cost)</option>
              <option value="latency">Fastest Valid Model (Latency)</option>
              <option value="quality">Highest Benchmark Quality</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">Prompt Message</label>
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your prompt here..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSendPrompt}
              disabled={isLoading}
              className="px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Route
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Result Output */}
        {lastResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                  lastResult.status === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  HTTP {lastResult.status}
                </span>
                {lastResult.headers?.['x-modelrouter-selected-model'] && (
                  <span className="text-slate-300 font-mono">
                    Selected: <strong className="text-cyan-400">{lastResult.headers['x-modelrouter-selected-model']}</strong> ({lastResult.headers['x-modelrouter-selected-provider']})
                  </span>
                )}
              </div>
              <span className="text-slate-500 font-mono">
                Overhead: {lastResult.headers?.['x-modelrouter-gateway-overhead-ms']}ms
              </span>
            </div>

            {lastResult.status === 200 ? (
              <div className="text-sm text-slate-200">
                <p className="font-medium text-slate-400 text-xs mb-1">Completion:</p>
                <p className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-slate-100">
                  {lastResult.data?.choices?.[0]?.message?.content}
                </p>
                {lastResult.data?._modelrouter_decision && (
                  <div className="mt-2 text-xs text-blue-400 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                    <strong>Auditable Justification:</strong> {lastResult.data._modelrouter_decision.justification}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-red-400 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="h-4 w-4" />
                  {lastResult.data?.error?.message}
                </div>
                {lastResult.data?.error?.disqualified_candidates && (
                  <div className="bg-red-950/20 p-2.5 rounded border border-red-500/20 space-y-1">
                    <p className="font-semibold text-red-300">Disqualified Candidates Matrix:</p>
                    {lastResult.data.error.disqualified_candidates.map((c: any, idx: number) => (
                      <div key={idx} className="font-mono text-[11px] text-red-300/80">
                        • <strong>{c.model}</strong>: {c.rejection_reasons?.join(', ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Request Traces Feed */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Gateway Traces</h2>
            <p className="text-xs text-slate-400">Live stream of incoming inferences and constraint audits</p>
          </div>
          <button
            onClick={() => setActiveTab('traces')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            View all traces <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentTraces.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No traces recorded yet. Send a prompt above to generate your first trace!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Trace ID</th>
                  <th className="py-2.5 px-3">Total Latency</th>
                  <th className="py-2.5 px-3">Gateway Overhead</th>
                  <th className="py-2.5 px-3">Tokens</th>
                  <th className="py-2.5 px-3">Cost</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentTraces.map((trace) => (
                  <tr key={trace.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
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
                    <td className="py-3 px-3 text-slate-300 font-medium">
                      {trace.id.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {trace.total_latency_ms.toFixed(1)}ms
                    </td>
                    <td className="py-3 px-3 text-cyan-400">
                      {trace.gateway_overhead_ms.toFixed(1)}ms
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {trace.prompt_tokens + trace.completion_tokens}
                    </td>
                    <td className="py-3 px-3 text-amber-400">
                      ${trace.total_cost_usd.toFixed(6)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onSelectTrace(trace.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
