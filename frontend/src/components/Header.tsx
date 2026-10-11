import React from 'react';
import { RefreshCw, ChevronRight, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'System metrics and operational status' },
  playground: { title: 'Routing Playground', subtitle: 'Test intelligent model routing, multimodal inference, and cost optimization' },
  policies: { title: 'Routing Policies', subtitle: 'Configure weights and hard constraints' },
  models: { title: 'Models & Providers', subtitle: 'Model benchmarks, context limits, and status' },
  logs: { title: 'Request Logs', subtitle: 'Audit trail of routing decisions and execution attempts' },
  analytics: { title: 'Gateway Analytics', subtitle: 'Cost attribution and latency percentiles' },
  'api-keys': { title: 'API Keys', subtitle: 'Manage client credentials and rate limits' },
  settings: { title: 'Gateway Settings', subtitle: 'Gateway configuration and chaos simulation' }
};

export const Header: React.FC<HeaderProps> = ({ activeTab, onRefresh, isRefreshing = false }) => {
  const current = tabTitles[activeTab] || { title: 'ModelRouter', subtitle: 'AI Gateway' };

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumb & Title */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-500 font-medium">ModelRouter</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-500 font-medium">Production</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-900 font-semibold">{current.title}</span>
        <span className="hidden lg:inline-block text-slate-400 ml-2 border-l border-slate-200 pl-2">
          {current.subtitle}
        </span>
      </div>

      {/* Actions & Connection Status */}
      <div className="flex items-center space-x-3">
        {/* Connection status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono">
          <Activity className="h-3 w-3 text-emerald-500" />
          <span className="font-medium text-slate-900">Gateway Live</span>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh gateway telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
