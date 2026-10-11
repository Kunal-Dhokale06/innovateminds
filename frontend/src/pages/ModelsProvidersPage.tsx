import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import { fetchModels, toggleModel } from '../api';
import type { ModelProfileItem } from '../types';

export const ModelsProvidersPage: React.FC = () => {
  const [models, setModels] = useState<ModelProfileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [togglingModel, setTogglingModel] = useState<string | null>(null);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetchModels();
      setModels(res.models);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleToggle = async (modelName: string) => {
    setTogglingModel(modelName);
    try {
      await toggleModel(modelName);
      await loadModels();
    } catch (err: any) {
      alert(`Error toggling model: ${err.message}`);
    } finally {
      setTogglingModel(null);
    }
  };

  const filteredModels = models.filter((m) => {
    // Only display real production models, omitting internal test fixtures
    const isReal = m.provider_name !== 'mock' && !m.model_name.startsWith('mock');
    if (!isReal) return false;

    const matchesSearch =
      m.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'all' || m.provider_name.toLowerCase() === selectedProvider.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  return (
    <div className="space-y-5">
      {/* Top Header & Search Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Models & Providers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Empirical benchmark metrics, context window limits, token pricing, and live circuit breaker states.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="inline-flex p-0.5 rounded-lg border border-slate-200 bg-slate-100">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Provider Filter */}
          <div className="flex items-center space-x-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
            {['all', 'groq', 'gemini', 'openai'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={`px-3 py-1 rounded-md capitalize transition-all ${
                  selectedProvider === p
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={loadModels}
            disabled={isLoading}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh models"
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
          placeholder="Filter models by identifier or provider..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono shadow-2xs"
        />
      </div>

      {/* Table View (Default high-density view) */}
      {viewMode === 'table' ? (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse table-clean">
            <thead>
              <tr>
                <th>Model Identifier</th>
                <th>Provider</th>
                <th>Context Window</th>
                <th>P95 Latency</th>
                <th>Code Score</th>
                <th>Math Score</th>
                <th>Prompt / 1M</th>
                <th>Comp / 1M</th>
                <th>Circuit Breaker</th>
                <th className="text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((m) => {
                const isHealthy = m.circuit_state === 'CLOSED';
                const isHalfOpen = m.circuit_state === 'HALF_OPEN';

                return (
                  <tr key={m.id} className={!m.is_active ? 'opacity-50 bg-slate-50/50' : 'hover:bg-slate-50/70 transition-colors'}>
                    <td className="font-mono font-medium text-slate-900 text-xs">
                      {m.model_name}
                    </td>
                    <td>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                        {m.provider_name}
                      </span>
                    </td>
                    <td className="font-mono text-slate-600 text-xs">
                      {(m.max_context_window / 1000).toFixed(0)}k
                    </td>
                    <td className="font-mono text-slate-600 text-xs">
                      {m.baseline_p95_latency_ms} ms
                    </td>
                    <td className="font-mono text-slate-900 text-xs font-semibold">
                      {(m.code_score * 100).toFixed(0)}%
                    </td>
                    <td className="font-mono text-slate-900 text-xs font-semibold">
                      {(m.math_score * 100).toFixed(0)}%
                    </td>
                    <td className="font-mono text-slate-700 text-xs">
                      ${(m.cost_per_1k_prompt_usd * 1000).toFixed(3)}
                    </td>
                    <td className="font-mono text-slate-700 text-xs">
                      ${(m.cost_per_1k_completion_usd * 1000).toFixed(3)}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          isHealthy
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isHalfOpen
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {m.circuit_state}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleToggle(m.model_name)}
                        disabled={togglingModel === m.model_name}
                        className={`text-xs px-3 py-1 rounded-md transition-all font-medium border shadow-2xs ${
                          m.is_active
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {togglingModel === m.model_name ? 'Updating...' : m.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((m) => {
            const isHealthy = m.circuit_state === 'CLOSED';
            const isHalfOpen = m.circuit_state === 'HALF_OPEN';

            return (
              <div
                key={m.id}
                className={`p-5 rounded-lg border transition-all shadow-2xs ${
                  m.is_active
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-xs text-slate-900">{m.model_name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {m.provider_name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1 font-mono">
                      <span>{(m.max_context_window / 1000).toFixed(0)}k context</span>
                      <span>•</span>
                      <span>p95: {m.baseline_p95_latency_ms}ms</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                      isHealthy
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : isHalfOpen
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {m.circuit_state}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-medium">Prompt / 1M</span>
                    <span className="font-mono text-slate-900 text-xs font-semibold">
                      ${(m.cost_per_1k_prompt_usd * 1000).toFixed(3)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-medium">Comp / 1M</span>
                    <span className="font-mono text-slate-900 text-xs font-semibold">
                      ${(m.cost_per_1k_completion_usd * 1000).toFixed(3)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-500">
                    HumanEval: {(m.code_score * 100).toFixed(0)}% • GSM8K: {(m.math_score * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => handleToggle(m.model_name)}
                    disabled={togglingModel === m.model_name}
                    className="text-xs px-3 py-1 rounded-md transition-all font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    {m.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
