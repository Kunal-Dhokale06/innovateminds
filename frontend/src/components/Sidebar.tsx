import React, { useState } from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  SlidersHorizontal,
  Cpu,
  FileCode2,
  LineChart,
  KeyRound,
  Cog,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  overheadMs?: number;
  circuitHealthy?: boolean;
}

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  overheadMs = 0.0,
  circuitHealthy = true
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'playground', label: 'Routing Playground', icon: PlayCircle },
        { id: 'policies', label: 'Routing Policies', icon: SlidersHorizontal },
        { id: 'models', label: 'Models & Providers', icon: Cpu }
      ]
    },
    {
      title: 'Observability',
      items: [
        { id: 'logs', label: 'Request Logs', icon: FileCode2 },
        { id: 'analytics', label: 'Gateway Analytics', icon: LineChart }
      ]
    },
    {
      title: 'Administration',
      items: [
        { id: 'api-keys', label: 'API Keys', icon: KeyRound },
        { id: 'settings', label: 'Gateway Settings', icon: Cog }
      ]
    }
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200 bg-white select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      } shrink-0 min-h-screen transition-all duration-200 z-20`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200">
        {!isCollapsed ? (
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900">ModelRouter</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                v2.1
              </span>
            </div>
          </div>
        ) : (
          <div className="h-7 w-7 mx-auto rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            <Zap className="h-4 w-4" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Environment Selector */}
      {!isCollapsed && (
        <div className="px-3 py-2.5 border-b border-slate-100">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs text-slate-700">
            <div className="flex items-center space-x-2 truncate font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate font-semibold text-slate-900">Production</span>
              <span className="text-slate-400 text-[11px]">/ us-east-1</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </div>
        </div>
      )}

      {/* Structured Navigation Sections */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center rounded-lg text-sm transition-all ${
                    isCollapsed ? 'justify-center px-0 py-2.5' : 'space-x-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* System Health & User Profile */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
          {/* Health Status Indicator */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5 text-xs shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-medium text-[11px]">Gateway Overhead</span>
              <span className="font-mono text-slate-900 font-semibold">{overheadMs.toFixed(2)} ms</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-medium text-[11px]">Circuit Health</span>
              <span className="flex items-center space-x-1.5 text-emerald-700 font-semibold font-mono text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{circuitHealthy ? '100% Operational' : 'Degraded'}</span>
              </span>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-2.5 px-1 py-0.5">
            <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shadow-2xs">
              KD
            </div>
            <div className="flex-1 truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">Kunal Dhokale</div>
              <div className="text-[11px] text-slate-500 font-mono truncate">kunal@modelrouter.io</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-200 flex flex-col items-center space-y-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Gateway Operational" />
        </div>
      )}
    </aside>
  );
};
