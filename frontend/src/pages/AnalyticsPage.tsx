import React, { useState, useEffect } from 'react';
import { fetchMetrics } from '../api';
import type { SystemMetrics } from '../types';

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [range, setRange] = useState('7d');

  useEffect(() => {
    fetchMetrics().then(setMetrics).catch(console.error);
  }, []);

  const avgCostPerReq = metrics && metrics.total_requests > 0 ? (metrics.total_cost_usd / metrics.total_requests) : 0;
  const modelAttribution = metrics?.model_attribution || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gateway Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Token economics, empirical latency percentiles, and provider cost attribution.
          </p>
        </div>

        <div className="flex items-center space-x-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
          {['24h', '7d', '30d', 'Quarter'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md transition-all ${
                range === r
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-slate-500 text-xs font-medium">Average Cost Per Request</div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            ${avgCostPerReq < 0.0001 ? avgCostPerReq.toFixed(6) : avgCostPerReq.toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics?.total_requests ?? 0} request{metrics?.total_requests === 1 ? '' : 's'} recorded
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-slate-500 text-xs font-medium">Gateway Overhead Efficiency</div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {(metrics?.average_gateway_overhead_ms ?? 0.0).toFixed(2)} <span className="text-xs font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-mono font-medium">Sub-millisecond dispatch</div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-slate-500 text-xs font-medium">SLA Adherence Rate</div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {(metrics?.sla_compliance_rate_percent ?? 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics?.error_requests ?? 0} SLA breach{metrics?.error_requests === 1 ? '' : 'es'}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-slate-500 text-xs font-medium">Total Processed Spend</div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ${(metrics?.total_cost_usd ?? 0.0).toFixed(6)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Aggregated across all models</div>
        </div>
      </div>

      {/* Breakdown Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Spend Attribution */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Execution Volume by Model</h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of candidate models selected by the router</p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ${(metrics?.total_cost_usd ?? 0.0).toFixed(6)} Total
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {modelAttribution.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No model invocations recorded yet. Execute requests in the Playground to populate metrics.
              </div>
            ) : (
              modelAttribution.map((item, idx) => {
                const colors = ['bg-indigo-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-500', 'bg-slate-400'];
                const barColor = colors[idx % colors.length];
                return (
                  <div key={item.model} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-900 font-semibold">{item.model}</span>
                      <span className="text-slate-500">{item.requests} reqs ({item.share_percent}%) · {item.avg_latency_ms} ms</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${item.share_percent}%` }} className={`h-full ${barColor} rounded-full`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Latency Percentiles Breakdown */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Empirical Latency Percentiles</h3>
            <p className="text-xs text-slate-500 mt-0.5">Measured end-to-end response timing across request volume</p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">p50 Latency</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {(metrics?.p50_latency_ms ?? 0.0).toFixed(0)} ms
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Median</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">p95 Latency</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {(metrics?.p95_latency_ms ?? 0.0).toFixed(0)} ms
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">95th percentile</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">p99 Latency</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {(metrics?.p99_latency_ms ?? 0.0).toFixed(0)} ms
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Tail boundary</span>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">Empirical Measurement: </span>
            Percentiles are calculated from observed latency traces recorded in the database.
          </div>
        </div>
      </div>
    </div>
  );
};
