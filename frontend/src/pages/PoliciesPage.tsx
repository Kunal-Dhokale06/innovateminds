import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle,
  Star,
  ShieldCheck,
  X,
  AlertCircle
} from 'lucide-react';
import { fetchRules, createRule } from '../api';
import type { RoutingRuleItem } from '../types';

export const PoliciesPage: React.FC = () => {
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handlePreferencePreset = (pref: string) => {
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

  const handleCreate = async (e: React.FormEvent) => {
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
      setNotification({ type: 'success', message: `Routing policy "${name}" registered successfully.` });
      setShowCreateModal(false);
      setName('');
      setMaxBudget('');
      setMaxLatency('');
      await loadRules();
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Routing Policies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage multi-objective Pareto optimization weights, hard cost ceilings, and SLA bounds.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Policy</span>
        </button>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center space-x-2.5 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Formula Explanation Card */}
      <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            <span>Deterministic Scoring Formulation</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
            Strict Precedence
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Hard constraints are strictly checked before ranking. Candidates failing cost caps, SLA deadlines, context length, or circuit thresholds are rejected. Eligible models are scored via normalized Pareto weights:
        </p>
        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 font-mono text-xs text-indigo-700 text-center font-semibold">
          Score(m) = w_cost · (1 - C_norm) + w_lat · (1 - L_norm) + w_qual · Q_norm
        </div>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className={`p-5 rounded-lg border transition-all shadow-2xs ${
              r.is_default
                ? 'bg-indigo-50/25 border-indigo-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-base text-slate-900">{r.name}</span>
                  {r.is_default && (
                    <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                      <Star className="h-2.5 w-2.5 fill-indigo-700 text-indigo-700" />
                      <span>Default</span>
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 capitalize mt-0.5 block font-mono">
                  Mode: {r.preference.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Hard Constraints Box */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Max Budget</span>
                <span className="font-mono text-slate-900 font-semibold text-xs">
                  {r.max_budget_usd ? `$${r.max_budget_usd.toFixed(4)}` : 'Uncapped'}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Latency SLA</span>
                <span className="font-mono text-slate-900 font-semibold text-xs">
                  {r.max_latency_sla_ms ? `${r.max_latency_sla_ms}ms` : 'Uncapped'}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Min Capability</span>
                <span className="font-mono text-slate-900 font-semibold text-xs">
                  {(r.min_capability * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Weight Bars */}
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${r.weight_cost * 100}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Cost: ${(r.weight_cost * 100).toFixed(0)}%`}
                />
                <div
                  style={{ width: `${r.weight_latency * 100}%` }}
                  className="bg-blue-600 h-full"
                  title={`Latency: ${(r.weight_latency * 100).toFixed(0)}%`}
                />
                <div
                  style={{ width: `${r.weight_quality * 100}%` }}
                  className="bg-indigo-600 h-full"
                  title={`Quality: ${(r.weight_quality * 100).toFixed(0)}%`}
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-600 mt-2">
                <span className="text-emerald-700 font-medium">Cost: {(r.weight_cost * 100).toFixed(0)}%</span>
                <span className="text-blue-700 font-medium">Latency: {(r.weight_latency * 100).toFixed(0)}%</span>
                <span className="text-indigo-700 font-medium">Quality: {(r.weight_quality * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-xl bg-white border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Create Routing Policy</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Policy Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Low-Latency Tier-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-sans text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Optimization Mode</label>
                <div className="grid grid-cols-4 gap-2">
                  {['balanced', 'cost_first', 'latency_first', 'quality_first'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePreferencePreset(p)}
                      className={`py-1.5 px-1 text-center rounded-lg border capitalize text-[11px] font-medium transition-all ${
                        preference === p
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-700 mb-1">Max Budget (USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Optional (e.g. 0.005)"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-slate-700 mb-1">Latency SLA (ms)</label>
                  <input
                    type="number"
                    step="100"
                    placeholder="Optional (e.g. 1500)"
                    value={maxLatency}
                    onChange={(e) => setMaxLatency(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>Min Capability Threshold</span>
                  <span className="font-mono text-indigo-700 font-semibold">{(parseFloat(minCapability) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minCapability}
                  onChange={(e) => setMinCapability(e.target.value)}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="is_default" className="text-slate-700 select-none cursor-pointer text-xs">
                  Set as default fallback policy for unannotated requests
                </label>
              </div>

              <div className="flex space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
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
