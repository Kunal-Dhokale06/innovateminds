import React, { useState, useEffect } from 'react';
import {
  Zap,
  RotateCcw,
  CheckCircle,
  Sliders,
  Save
} from 'lucide-react';
import {
  fetchModels,
  fetchSimulationConfig,
  updateSimulationConfig,
  resetSimulationConfig
} from '../api';
import type { ModelProfileItem } from '../types';

export const SettingsPage: React.FC = () => {
  // General Gateway Settings State
  const [globalTimeoutMs, setGlobalTimeoutMs] = useState(10000);
  const [maxRetries, setMaxRetries] = useState(3);
  const [circuitThreshold, setCircuitThreshold] = useState(3);
  const [circuitCooldownSec, setCircuitCooldownSec] = useState(15);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Judge Simulation & Chaos Overrides State
  const [models, setModels] = useState<ModelProfileItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('qwen/qwen3.8-27b');
  const [simLatencyMs, setSimLatencyMs] = useState<number>(0);
  const [simErrorCode, setSimErrorCode] = useState<number | ''>('');
  const [simIsActive, setSimIsActive] = useState<boolean>(true);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, any>>({});
  const [isUpdatingSim, setIsUpdatingSim] = useState<boolean>(false);
  const [simNotice, setSimNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [mRes, simRes] = await Promise.all([fetchModels(), fetchSimulationConfig()]);
      setModels(mRes.models);
      setActiveOverrides(simRes.overrides || {});
      if (mRes.models.length > 0 && !selectedModel) {
        setSelectedModel(mRes.models[0].model_name);
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeOverrides[selectedModel]) {
      const ov = activeOverrides[selectedModel];
      setSimLatencyMs(ov.latency_ms ?? 0);
      setSimErrorCode(ov.error_code ?? '');
      setSimIsActive(ov.is_active ?? true);
    } else {
      setSimLatencyMs(0);
      setSimErrorCode('');
      setSimIsActive(true);
    }
  }, [selectedModel, activeOverrides]);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleApplyChaos = async () => {
    setIsUpdatingSim(true);
    setSimNotice(null);
    try {
      await updateSimulationConfig({
        target_model: selectedModel,
        simulated_latency_ms: simLatencyMs > 0 ? simLatencyMs : null,
        injected_error_code: simErrorCode !== '' ? Number(simErrorCode) : null,
        is_active: simIsActive
      });
      setSimNotice(`Chaos parameters applied to ${selectedModel}`);
      await loadData();
      setTimeout(() => setSimNotice(null), 3000);
    } catch (err: any) {
      alert(`Error applying chaos: ${err.message}`);
    } finally {
      setIsUpdatingSim(false);
    }
  };

  const handleResetChaos = async () => {
    setIsUpdatingSim(true);
    try {
      await resetSimulationConfig();
      setSimNotice('All chaos and simulation overrides cleared.');
      await loadData();
      setSimLatencyMs(0);
      setSimErrorCode('');
      setSimIsActive(true);
      setTimeout(() => setSimNotice(null), 3000);
    } catch (err: any) {
      alert(`Error resetting chaos: ${err.message}`);
    } finally {
      setIsUpdatingSim(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gateway Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure upstream timeouts, circuit breaker thresholds, and evaluator chaos simulation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Core Gateway Defaults */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-indigo-600" />
              <span>Operational Gateway Defaults</span>
            </h3>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              Active Config
            </span>
          </div>

          <form onSubmit={handleSaveGeneral} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold uppercase mb-1">
                Global Upstream Timeout (ms)
              </label>
              <input
                type="number"
                value={globalTimeoutMs}
                onChange={(e) => setGlobalTimeoutMs(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                Upper deadline bound before returning HTTP 504 Gateway Timeout.
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase mb-1">
                Maximum Fallback Attempts
              </label>
              <input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                Max candidate attempts executed under remaining deadline budget.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold uppercase mb-1">
                  Circuit Failure Threshold
                </label>
                <input
                  type="number"
                  value={circuitThreshold}
                  onChange={(e) => setCircuitThreshold(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold uppercase mb-1">
                  Cooldown Window (sec)
                </label>
                <input
                  type="number"
                  value={circuitCooldownSec}
                  onChange={(e) => setCircuitCooldownSec(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Gateway Defaults</span>
              </button>
              {saveSuccess && (
                <span className="text-emerald-700 text-xs inline-flex items-center space-x-1 font-medium">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>Configuration saved</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Judge Chaos Injection Console */}
        <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Chaos & Simulation Console</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inject upstream errors and artificial latency in memory
              </p>
            </div>

            <button
              onClick={handleResetChaos}
              disabled={isUpdatingSim}
              className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {simNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{simNotice}</span>
            </div>
          )}

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold uppercase mb-1">
                Target Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600"
              >
                {models.map((m) => (
                  <option key={m.model_name} value={m.model_name}>
                    {m.model_name} ({m.provider_name}) {activeOverrides[m.model_name] ? '• [CHAOS ACTIVE]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1 font-medium">
                <span>Injected Latency Delay</span>
                <span className="font-mono text-indigo-700 font-semibold">{simLatencyMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={simLatencyMs}
                onChange={(e) => setSimLatencyMs(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase mb-1">
                Injected HTTP Error Code
              </label>
              <select
                value={simErrorCode}
                onChange={(e) => setSimErrorCode(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="">None (Nominal Execution 200 OK)</option>
                <option value="429">429 Too Many Requests (Rate Limit)</option>
                <option value="500">500 Internal Server Error</option>
                <option value="503">503 Service Unavailable</option>
                <option value="504">504 Gateway Timeout</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="font-semibold text-slate-900 block">Candidate Active Status</span>
                <span className="text-xs text-slate-500">Simulate total regional provider outage</span>
              </div>
              <button
                type="button"
                onClick={() => setSimIsActive(!simIsActive)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  simIsActive ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <span className="bg-white w-4 h-4 rounded-full shadow-2xs" />
              </button>
            </div>

            <button
              onClick={handleApplyChaos}
              disabled={isUpdatingSim}
              className="w-full py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>Apply Simulation Override</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
