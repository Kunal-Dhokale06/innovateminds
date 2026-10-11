import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Server,
  ChevronRight
} from 'lucide-react';
import { fetchMetrics, fetchTraces } from '../api';
import type { SystemMetrics, RequestTraceItem } from '../types';

interface OverviewPageProps {
  onSelectTrace: (traceId: string) => void;
  setActiveTab: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onSelectTrace, setActiveTab }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [recentTraces, setRecentTraces] = useState<RequestTraceItem[]>([]);
  const [timeRange, setTimeRange] = useState('24h');

  const loadData = async () => {
    try {
      const [m, t] = await Promise.all([fetchMetrics(), fetchTraces(10)]);
      setMetrics(m);
      setRecentTraces(t.traces);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const successRate = metrics
    ? metrics.total_requests > 0
      ? ((metrics.success_requests / metrics.total_requests) * 100).toFixed(1)
      : '100.0'
    : '100.0';

  return (
    <div className="space-y-6">
      {/* Page Title & Time Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry, routing performance, and upstream provider health across all environments.
          </p>
        </div>

        <div className="flex items-center space-x-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
          {['1h', '24h', '7d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                timeRange === range
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Requests */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Requests</span>
            <Activity className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {metrics?.total_requests ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">100% processed</div>
        </div>

        {/* Success Rate */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Success Rate</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {successRate}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{metrics?.error_requests ?? 0} errors</div>
        </div>

        {/* Gateway Overhead */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Gateway Overhead</span>
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {(metrics?.average_gateway_overhead_ms ?? 0.0).toFixed(2)} <span className="text-xs font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-mono font-medium">Sub-millisecond routing</div>
        </div>

        {/* Total Latency */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Avg Total Latency</span>
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {(metrics?.average_total_latency_ms ?? 0.0).toFixed(0)} <span className="text-xs font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">End-to-end trace</div>
        </div>

        {/* SLA Compliance */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>SLA Compliance</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {(metrics?.sla_compliance_rate_percent ?? 100).toFixed(0)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Active SLA bounds</div>
        </div>

        {/* AI Spend */}
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total AI Spend</span>
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ${(metrics?.total_cost_usd ?? 0.0).toFixed(6)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Attributed spend</div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Routing Decisions Table */}
        <div className="lg:col-span-8 space-y-5">
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Recent Routing Decisions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological trace log of requests evaluated by the constraint engine
                </p>
              </div>
              <button
                onClick={() => setActiveTab('logs')}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 font-medium transition-colors"
              >
                <span>View all logs</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse table-clean">
                <thead>
                  <tr>
                    <th>Trace ID</th>
                    <th>Status</th>
                    <th>Total Latency</th>
                    <th>Overhead</th>
                    <th>Cost</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTraces.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                        No requests recorded yet. Run a test prompt in the Playground.
                      </td>
                    </tr>
                  ) : (
                    recentTraces.map((t) => (
                      <tr
                        key={t.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => onSelectTrace(t.id)}
                      >
                        <td className="font-mono text-xs text-slate-900 font-medium">
                          {t.id}
                        </td>
                        <td>
                          <span
                            className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-medium ${
                              t.http_status === 200
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            HTTP {t.http_status}
                          </span>
                        </td>
                        <td className="font-mono text-slate-700 text-xs">
                          {t.total_latency_ms.toFixed(1)} ms
                        </td>
                        <td className="font-mono text-slate-700 text-xs">
                          {t.gateway_overhead_ms.toFixed(2)} ms
                        </td>
                        <td className="font-mono text-slate-600 text-xs">
                          ${t.total_cost_usd.toFixed(6)}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrace(t.id);
                            }}
                            className="text-indigo-600 hover:text-indigo-700 inline-flex items-center space-x-1 text-xs font-medium"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Provider Connection Health & Active Guardrails */}
        <div className="lg:col-span-4 space-y-5">
          {/* Provider Health Matrix */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                <Server className="h-3.5 w-3.5 text-slate-500" />
                <span>Provider Connection Health</span>
              </h2>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                Operational
              </span>
            </div>

            <div className="space-y-2">
              {[
                { name: 'Groq (LPU)', key: 'groq', models: 'qwen3.8-27b, gpt-oss-120b', state: 'CLOSED' },
                { name: 'Google Gemini', key: 'gemini', models: 'gemini-1.5-flash, gemini-2.5-flash', state: 'CLOSED' },
                { name: 'OpenAI', key: 'openai', models: 'gpt-4o, gpt-4o-mini', state: 'CLOSED' },
                { name: 'Flux (Diffusion)', key: 'flux', models: 'flux-schnell', state: 'CLOSED' }
              ].map((prov) => {
                const cState = metrics?.circuit_states?.[prov.key]?.state || prov.state;
                const isHealthy = cState === 'CLOSED';

                return (
                  <div
                    key={prov.name}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{prov.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{prov.models}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                        isHealthy
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {cState}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-500 leading-relaxed">
              Circuit breakers trip to <span className="font-mono text-red-700 font-medium">OPEN</span> after 3 consecutive upstream failures to safeguard caller latency.
            </div>
          </div>

          {/* Gateway Guardrails */}
          <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Active Gateway Guardrails</span>
            </h2>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="p-2 rounded-md border border-slate-100 bg-slate-50 flex items-center justify-between">
                <span>Hard Cost Ceiling</span>
                <span className="text-slate-900 font-mono text-[11px] font-medium">HTTP 422 Rejection</span>
              </div>
              <div className="p-2 rounded-md border border-slate-100 bg-slate-50 flex items-center justify-between">
                <span>Latency SLA Deadline Pruning</span>
                <span className="text-slate-900 font-mono text-[11px] font-medium">Conservative P90 Bound</span>
              </div>
              <div className="p-2 rounded-md border border-slate-100 bg-slate-50 flex items-center justify-between">
                <span>Async Trace Buffer</span>
                <span className="text-slate-900 font-mono text-[11px] font-medium">Non-blocking Batching</span>
              </div>
              <div className="p-2 rounded-md border border-slate-100 bg-slate-50 flex items-center justify-between">
                <span>Prompt Redaction (OWASP LLM06)</span>
                <span className="text-slate-900 font-mono text-[11px] font-medium">Secret Pattern Regex</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
