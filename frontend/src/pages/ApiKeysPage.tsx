import React, { useState } from 'react';
import { Plus, Copy, Check, Trash2, Terminal, X } from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: string;
  rate_limit_rpm: number;
  monthly_budget: number;
  created_at: string;
  last_used: string;
  status: 'active' | 'revoked';
}

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key_1',
      name: 'production-primary-gateway',
      prefix: 'mr_live_9a7c...4f18',
      environment: 'production',
      rate_limit_rpm: 600,
      monthly_budget: 500,
      created_at: '2026-10-10',
      last_used: '2 mins ago',
      status: 'active'
    },
    {
      id: 'key_2',
      name: 'staging-evaluator-token',
      prefix: 'mr_test_3b2e...91da',
      environment: 'staging',
      rate_limit_rpm: 120,
      monthly_budget: 100,
      created_at: '2026-10-11',
      last_used: '1 hour ago',
      status: 'active'
    }
  ]);

  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [env, setEnv] = useState('production');
  const [rateLimit, setRateLimit] = useState(300);
  const [budget, setBudget] = useState(250);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: keyName,
      prefix: `mr_${env === 'production' ? 'live' : 'test'}_${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
      environment: env,
      rate_limit_rpm: rateLimit,
      monthly_budget: budget,
      created_at: new Date().toISOString().split('T')[0],
      last_used: 'Never',
      status: 'active'
    };

    setKeys([newKey, ...keys]);
    setShowModal(false);
    setKeyName('');
  };

  const handleRevoke = (id: string) => {
    setKeys(keys.map((k) => (k.id === id ? { ...k, status: 'revoked' as const } : k)));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">API Key Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage client bearer credentials, rate-limiting quotas, and spend ceilings.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Generate API Key</span>
        </button>
      </div>

      {/* Keys Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse table-clean">
          <thead>
            <tr>
              <th>Key Identifier</th>
              <th>Token Mask</th>
              <th>Environment</th>
              <th>Rate Limit</th>
              <th>Budget Cap</th>
              <th>Last Used</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="font-mono font-medium text-slate-900">{k.name}</td>
                <td>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-slate-700 text-xs">{k.prefix}</span>
                    <button
                      onClick={() => handleCopy(k.id, k.prefix)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Copy token prefix"
                    >
                      {copiedId === k.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
                <td>
                  <span className="capitalize font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                    {k.environment}
                  </span>
                </td>
                <td className="font-mono text-slate-700">{k.rate_limit_rpm} req/min</td>
                <td className="font-mono text-slate-700">${k.monthly_budget} / mo</td>
                <td className="text-slate-500 font-mono text-xs">{k.last_used}</td>
                <td>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      k.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {k.status.toUpperCase()}
                  </span>
                </td>
                <td className="text-right">
                  {k.status === 'active' && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                      title="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Integration Code Snippet */}
      <div className="p-5 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-indigo-600" />
            <span>Drop-In SDK Authorization</span>
          </h3>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            OpenAI Python SDK
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Authenticate requests to the gateway by passing your ModelRouter API key in the standard Authorization bearer header.
        </p>
        <pre className="p-4 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 overflow-x-auto leading-relaxed">
{`from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="mr_live_9a7c..."
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello ModelRouter"}],
    extra_headers={"x-modelrouter-preference": "cost_first"}
)`}
        </pre>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-xl bg-white border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Generate Client API Key</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Key Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. staging-microservice"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-sans text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-700 mb-1">Environment</label>
                <select
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-700 mb-1">Rate Limit (req/min)</label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-slate-700 mb-1">Monthly Budget ($)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
