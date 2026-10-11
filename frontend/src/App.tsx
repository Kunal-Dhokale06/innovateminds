import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ExplainabilityDrawer } from './components/ExplainabilityDrawer';

import { OverviewPage } from './pages/OverviewPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { ModelsProvidersPage } from './pages/ModelsProvidersPage';
import { LogsPage } from './pages/LogsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { SettingsPage } from './pages/SettingsPage';

import { fetchMetrics, fetchTraceDetail } from './api';
import type { SystemMetrics, TraceDetailResponse } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global Trace Audit Drawer State
  const [traceDetail, setTraceDetail] = useState<TraceDetailResponse | null>(null);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);

  const loadGatewayMetrics = async () => {
    setIsRefreshing(true);
    try {
      const m = await fetchMetrics();
      setMetrics(m);
    } catch (err) {
      // Backend may be starting
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadGatewayMetrics();
    const interval = setInterval(loadGatewayMetrics, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTrace = async (traceId: string | null) => {
    if (!traceId) {
      setTraceDetail(null);
      return;
    }

    setIsDrawerLoading(true);
    try {
      const detail = await fetchTraceDetail(traceId);
      setTraceDetail(detail);
    } catch (err) {
      console.error('Failed to load trace detail:', err);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setTraceDetail(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        overheadMs={metrics?.average_gateway_overhead_ms ?? 0.0}
        circuitHealthy={true}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Contextual Header Bar */}
        <Header
          activeTab={activeTab}
          onRefresh={loadGatewayMetrics}
          isRefreshing={isRefreshing}
        />

        {/* Dynamic Page Canvas */}
        <main className="flex-1 overflow-y-auto px-6 py-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              onSelectTrace={handleSelectTrace}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'playground' && (
            <PlaygroundPage
              onSelectTrace={handleSelectTrace}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'policies' && <PoliciesPage />}

          {activeTab === 'models' && <ModelsProvidersPage />}

          {activeTab === 'logs' && (
            <LogsPage onSelectTrace={handleSelectTrace} />
          )}

          {activeTab === 'analytics' && <AnalyticsPage />}

          {activeTab === 'api-keys' && <ApiKeysPage />}

          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Decision Explainability Drawer */}
      <ExplainabilityDrawer
        detail={traceDetail}
        isLoading={isDrawerLoading}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default App;
