import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { fetchTraces } from '../api';
import type { RequestTraceItem } from '../types';

interface LogsPageProps {
  onSelectTrace: (traceId: string) => void;
}

export const LogsPage: React.FC<LogsPageProps> = ({ onSelectTrace }) => {
  const [traces, setTraces] = useState<RequestTraceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const limit = 50;
  const [offset, setOffset] = useState(0);

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTraces(limit, offset, statusFilter);
      setTraces(res.traces);
    } catch (err) {
      console.error('Error fetching traces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraces();
  }, [statusFilter, limit, offset]);

  const filteredTraces = traces.filter((t) => {
    return t.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Request Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail of gateway decisions, latency breakdown, token consumption, and constraint checks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
            {[
              { label: 'All', val: undefined },
              { label: '200 OK', val: 200 },
              { label: '422 Unsat', val: 422 },
              { label: 'Errors', val: 500 }
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => {
                  setStatusFilter(f.val);
                  setOffset(0);
                }}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === f.val
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadTraces}
            disabled={isLoading}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by Trace ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono shadow-2xs"
        />
      </div>

      {/* Logs Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-clean">
            <thead>
              <tr>
                <th>Trace Identifier</th>
                <th>Status</th>
                <th>Total Latency</th>
                <th>Overhead</th>
                <th>Upstream</th>
                <th>Tokens (In / Out)</th>
                <th>Cost</th>
                <th>Recorded At</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTraces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                    No matching traces found. Run a prompt in the Playground to generate telemetry.
                  </td>
                </tr>
              ) : (
                filteredTraces.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    onClick={() => onSelectTrace(t.id)}
                  >
                    <td className="font-mono text-indigo-600 hover:text-indigo-800 font-semibold">{t.id}</td>
                    <td>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded-md font-semibold ${
                          t.http_status === 200
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {t.http_status}
                      </span>
                    </td>
                    <td className="font-mono text-slate-800 font-medium">{t.total_latency_ms.toFixed(1)} ms</td>
                    <td className="font-mono text-emerald-700 font-semibold">
                      {t.gateway_overhead_ms.toFixed(2)} ms
                    </td>
                    <td className="font-mono text-slate-500">
                      {t.upstream_latency_ms ? `${t.upstream_latency_ms.toFixed(0)} ms` : '—'}
                    </td>
                    <td className="font-mono text-slate-700">
                      {t.prompt_tokens} / {t.completion_tokens}
                    </td>
                    <td className="font-mono text-slate-700">
                      ${t.total_cost_usd.toFixed(6)}
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {t.created_at ? new Date(t.created_at).toLocaleTimeString() : 'Recent'}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrace(t.id);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1 text-xs font-semibold"
                      >
                        <span>Audit</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 font-mono bg-slate-50">
          <span>
            Showing {filteredTraces.length} requests
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 text-slate-700 flex items-center space-x-1 font-sans text-xs transition-colors shadow-2xs"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={traces.length < limit}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 text-slate-700 flex items-center space-x-1 font-sans text-xs transition-colors shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
