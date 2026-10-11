import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Layers, Clock } from 'lucide-react';
import { fetchModels, toggleModel } from '../api';
import type { ModelProfileItem } from '../types';

export const ModelsPage: React.FC = () => {
  const [models, setModels] = useState<ModelProfileItem[]>([]);
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-purple-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Model Registry & Capability Benchmarks</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Live Catalog
              </span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Auditable capability benchmark scores, context window limits, pricing, and live circuit breaker states.
            </p>
          </div>
        </div>
        <button
          onClick={loadModels}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-sm font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Registry</span>
        </button>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {models.map((m) => {
          const isHealthy = m.circuit_state === 'CLOSED';
          const isHalfOpen = m.circuit_state === 'HALF_OPEN';

          return (
            <div
              key={m.id}
              className={`glass-panel p-6 rounded-2xl border transition-all ${
                m.is_active
                  ? 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                  : 'border-red-900/40 bg-red-950/10 opacity-75'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold uppercase text-xs">
                    {m.provider_name.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-white font-mono">{m.model_name}</h3>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {m.provider_name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1 text-xs">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Layers className="h-3 w-3" />
                        <span>{(m.max_context_window / 1000).toFixed(0)}k Context</span>
                      </span>
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>p95: {m.baseline_p95_latency_ms}ms</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badges & Active Toggle */}
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-2">
                    {/* Circuit State Pill */}
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        isHealthy
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isHalfOpen
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-400' : isHalfOpen ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                      ></span>
                      <span>Circuit: {m.circuit_state}</span>
                    </span>
                  </div>

                  {/* Active Toggle Button */}
                  <button
                    onClick={() => handleToggle(m.model_name)}
                    disabled={togglingModel === m.model_name}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      m.is_active
                        ? 'bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700'
                        : 'bg-red-900/30 text-red-300 hover:bg-emerald-950/40 hover:text-emerald-400 border border-red-700'
                    }`}
                  >
                    {togglingModel === m.model_name
                      ? 'Updating...'
                      : m.is_active
                      ? 'Disable Model'
                      : 'Enable Model'}
                  </button>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Prompt Pricing</span>
                  <span className="font-mono text-emerald-400 text-xs font-semibold">
                    ${(m.cost_per_1k_prompt_usd * 1000).toFixed(4)} / 1M tokens
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    (${m.cost_per_1k_prompt_usd.toFixed(6)} / 1k)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Completion Pricing</span>
                  <span className="font-mono text-blue-400 text-xs font-semibold">
                    ${(m.cost_per_1k_completion_usd * 1000).toFixed(4)} / 1M tokens
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    (${m.cost_per_1k_completion_usd.toFixed(6)} / 1k)
                  </span>
                </div>
              </div>

              {/* Empirical Capability Scores */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Empirical Benchmark Scores (Zero-Bias)
                </span>
                <div className="space-y-2">
                  {/* Code HumanEval */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Code Synthesis (HumanEval / SWE-bench)</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {(m.code_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${m.code_score * 100}%` }}
                        className="bg-blue-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Math GSM8K */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Mathematical Reasoning (GSM8K)</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {(m.math_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${m.math_score * 100}%` }}
                        className="bg-purple-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Structured Extraction */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Structured JSON & Schema Adherence</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {(m.extraction_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${m.extraction_score * 100}%` }}
                        className="bg-emerald-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* General MMLU */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>General Knowledge (MMLU)</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {(m.general_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${m.general_score * 100}%` }}
                        className="bg-amber-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Supported Features Pills */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      m.supports_tools
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    Tools / Function Calling: {m.supports_tools ? 'Yes' : 'No'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      m.supports_json
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    JSON Mode: {m.supports_json ? 'Yes' : 'No'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Samples: {m.sample_count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
