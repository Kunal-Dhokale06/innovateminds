import React, { useState, useEffect } from 'react';
import { Sliders, Plus, CheckCircle, Star, ShieldCheck } from 'lucide-react';
import { fetchRules, createRule } from '../api';
import type { RoutingRuleItem } from '../types';

export const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<RoutingRuleItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [maxLatency, setMaxLatency] = useState('');
  const [minCapability, setMinCapability] = useState('0.7');
  const [preference, setPreference] = useState('balanced');
  const [weightCost, setWeightCost] = useState(0.33);
  const [weightLatency, setWeightLatency] = useState(0.33);
  const [weightQuality, setWeightQuality] = useState(0.34);
  const [isDefault, setIsDefault] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const loadRules = async () => {
    try {
      const res = await fetchRules();
      setRules(res.rules);
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handlePreferenceChange = (pref: string) => {
    setPreference(pref);
    if (pref === 'cost_first') {
      setWeightCost(0.70);
      setWeightLatency(0.15);
      setWeightQuality(0.15);
    } else if (pref === 'latency_first') {
      setWeightCost(0.15);
      setWeightLatency(0.70);
      setWeightQuality(0.15);
    } else if (pref === 'quality_first') {
      setWeightCost(0.15);
      setWeightLatency(0.15);
      setWeightQuality(0.70);
    } else if (pref === 'balanced') {
      setWeightCost(0.33);
      setWeightLatency(0.33);
      setWeightQuality(0.34);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createRule({
        name,
        max_budget_usd: maxBudget ? parseFloat(maxBudget) : null,
        max_latency_sla_ms: maxLatency ? parseFloat(maxLatency) : null,
        min_capability: parseFloat(minCapability),
        preference,
        weight_cost: weightCost,
        weight_latency: weightLatency,
        weight_quality: weightQuality,
        is_default: isDefault
      });
      setCreateMsg(`Rule "${name}" successfully registered!`);
      setShowCreateModal(false);
      setName('');
      setMaxBudget('');
      setMaxLatency('');
      await loadRules();
      setTimeout(() => setCreateMsg(null), 3000);
    } catch (err: any) {
      alert(`Error creating rule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Routing Policy & Weights Studio</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Pareto Optimization
              </span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Configure multi-objective ranking weights and hard constraints. Guaranteed zero silent relaxation.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30"
        >
          <Plus className="h-4 w-4" />
          <span>New Routing Policy</span>
        </button>
      </div>

      {createMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{createMsg}</span>
        </div>
      )}

      {/* Mathematical Principle Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            <span>Deterministic Scoring Formulation</span>
          </h2>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            Section 4.2 Spec Equation
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Hard constraints are strictly evaluated before ranking. Candidates failing cost, SLA, capability, or circuit checks are discarded with code-based rejection reasons. Eligible candidates are then scored via normalized Pareto weights:
        </p>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-blue-300 overflow-x-auto text-center">
          Score(m) = w_cost × (1 - C_norm) + w_lat × (1 - L_norm) + w_qual × Q_norm
        </div>
      </div>

      {/* Rules List */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h2 className="text-base font-semibold text-white mb-4">Configured Routing Policies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`p-5 rounded-xl border transition-all ${
                r.is_default
                  ? 'bg-blue-950/20 border-blue-500/40 shadow-lg shadow-blue-950/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-white">{r.name}</span>
                    {r.is_default && (
                      <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        <Star className="h-2.5 w-2.5 fill-blue-300" />
                        <span>Default Gateway Policy</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 capitalize mt-0.5 block">
                    Mode: {r.preference.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Hard Constraints Box */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">Max Budget</span>
                  <span className="font-mono text-slate-200">
                    {r.max_budget_usd ? `$${r.max_budget_usd.toFixed(4)}` : 'Uncapped'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">Latency SLA</span>
                  <span className="font-mono text-slate-200">
                    {r.max_latency_sla_ms ? `${r.max_latency_sla_ms}ms` : 'Uncapped'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">Min Capability</span>
                  <span className="font-mono text-slate-200">
                    {(r.min_capability * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Weight Distribution Bars */}
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Weight Allocation</span>
                  <span className="text-slate-500 font-mono">Cost / Latency / Quality</span>
                </div>
                <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${r.weight_cost * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Cost: ${(r.weight_cost * 100).toFixed(0)}%`}
                  />
                  <div
                    style={{ width: `${r.weight_latency * 100}%` }}
                    className="bg-blue-500 h-full"
                    title={`Latency: ${(r.weight_latency * 100).toFixed(0)}%`}
                  />
                  <div
                    style={{ width: `${r.weight_quality * 100}%` }}
                    className="bg-purple-500 h-full"
                    title={`Quality: ${(r.weight_quality * 100).toFixed(0)}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1.5">
                  <span className="text-emerald-400">Cost: {(r.weight_cost * 100).toFixed(0)}%</span>
                  <span className="text-blue-400">Latency: {(r.weight_latency * 100).toFixed(0)}%</span>
                  <span className="text-purple-400">Quality: {(r.weight_quality * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Create New Routing Policy</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">Policy Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ultra-Low-Latency SLA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">Preset Profile</label>
                <div className="grid grid-cols-4 gap-2">
                  {['balanced', 'cost_first', 'latency_first', 'quality_first'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePreferenceChange(p)}
                      className={`py-2 px-1 text-center rounded-lg border capitalize text-[11px] font-medium transition-colors ${
                        preference === p
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-400 mb-1">Max Budget (USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Optional (e.g. 0.005)"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-slate-400 mb-1">Latency SLA (ms)</label>
                  <input
                    type="number"
                    step="100"
                    placeholder="Optional (e.g. 1500)"
                    value={maxLatency}
                    onChange={(e) => setMaxLatency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">
                  Min Capability Threshold: {(parseFloat(minCapability) * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minCapability}
                  onChange={(e) => setMinCapability(e.target.value)}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="font-semibold uppercase text-slate-400 block">Fine-Tune Pareto Weights</span>
                <div>
                  <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                    <span>Cost Weight (w_cost)</span>
                    <span className="font-mono text-emerald-400">{(weightCost * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weightCost}
                    onChange={(e) => setWeightCost(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                    <span>Latency Weight (w_lat)</span>
                    <span className="font-mono text-blue-400">{(weightLatency * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weightLatency}
                    onChange={(e) => setWeightLatency(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                    <span>Quality Weight (w_qual)</span>
                    <span className="font-mono text-purple-400">{(weightQuality * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weightQuality}
                    onChange={(e) => setWeightQuality(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-800 text-blue-600 focus:ring-0"
                />
                <label htmlFor="is_default" className="text-slate-300 select-none cursor-pointer">
                  Set as default fallback policy for unannotated requests
                </label>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-600/30"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
