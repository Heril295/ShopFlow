import React, { useState, useEffect } from 'react';
import {
  INITIAL_SERVICES,
  INITIAL_INFRA,
  FAULT_SCENARIOS,
  INITIAL_SLOS,
  INITIAL_ALERTS,
  INITIAL_POSTMORTEMS
} from './data/initialData';
import {
  SimulationState,
  LoadProfile,
  executeSyntheticCheckout,
  recalculateSystemState
} from './services/simulationEngine';
import { ServiceNode, InfraNode, FaultScenario, FaultConfig, Postmortem } from './types/shopflow';

import { TopologyGraph } from './components/TopologyGraph';
import { FaultInjectionPanel } from './components/FaultInjectionPanel';
import { SLODashboard } from './components/SLODashboard';
import { DistributedTracingView } from './components/DistributedTracingView';
import { LokiLogsView } from './components/LokiLogsView';
import { AlertSinkView } from './components/AlertSinkView';
import { PostmortemStudio } from './components/PostmortemStudio';
import { CodeRepositoryView } from './components/CodeRepositoryView';
import { ShopperCheckoutModal } from './components/ShopperCheckoutModal';
import { ServiceDetailDrawer } from './components/ServiceDetailDrawer';

import {
  Activity,
  Flame,
  Target,
  GitCommit,
  Terminal,
  BellRing,
  FileText,
  Code,
  ShoppingBag,
  RotateCcw,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Zap,
  TrendingDown,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  const [simulationState, setSimulationState] = useState<SimulationState>(() => {
    const initialState: SimulationState = {
      services: INITIAL_SERVICES,
      infra: INITIAL_INFRA,
      faults: FAULT_SCENARIOS,
      slos: INITIAL_SLOS,
      alerts: INITIAL_ALERTS,
      traces: [],
      logs: [
        {
          id: 'log-init-1',
          timestamp: new Date().toISOString(),
          service: 'api-gateway',
          level: 'INFO',
          message: 'ShopFlow ReverseProxy gateway listening on :8080 (Admin API on :9000)'
        },
        {
          id: 'log-init-2',
          timestamp: new Date().toISOString(),
          service: 'order-service',
          level: 'INFO',
          message: 'Transactional Outbox worker connected to PostgreSQL order_db and RabbitMQ'
        },
        {
          id: 'log-init-3',
          timestamp: new Date().toISOString(),
          service: 'catalog-service',
          level: 'INFO',
          message: 'Redis cache connected with 15m TTL (FastAPI OTel instrumentation enabled)'
        }
      ],
      loadProfile: 'steady',
      totalRequestsHandled: 1420,
      totalFailedRequests: 4
    };

    // Pre-populate 3 initial traces
    const initialTrace1 = executeSyntheticCheckout(initialState, 'sku-101', 299.99);
    const initialTrace2 = executeSyntheticCheckout(initialState, 'sku-102', 149.50);
    const initialTrace3 = executeSyntheticCheckout(initialState, 'sku-103', 499.00);

    return {
      ...initialState,
      traces: [initialTrace3.trace, initialTrace2.trace, initialTrace1.trace],
      logs: [...initialState.logs, ...initialTrace1.logs, ...initialTrace2.logs]
    };
  });

  const [activeTab, setActiveTab] = useState<
    'topology' | 'faults' | 'slos' | 'traces' | 'logs' | 'alerts' | 'postmortem' | 'code'
  >('topology');

  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null);
  const [selectedInfra, setSelectedInfra] = useState<InfraNode | null>(null);
  const [isShopperModalOpen, setIsShopperModalOpen] = useState<boolean>(false);
  const [targetTraceId, setTargetTraceId] = useState<string>('');
  const [postmortems, setPostmortems] = useState<Postmortem[]>(INITIAL_POSTMORTEMS);

  // Background Simulation Loop for continuous telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulationState(prev => {
        const next = recalculateSystemState(prev);

        // Periodically generate background synthetic requests if load is active
        if (prev.loadProfile !== 'paused' && Math.random() < 0.65) {
          const sku = Math.random() > 0.5 ? 'sku-101' : 'sku-102';
          const price = sku === 'sku-101' ? 299.99 : 149.50;
          const checkoutResult = executeSyntheticCheckout(next, sku, price);

          const updatedTraces = [checkoutResult.trace, ...next.traces.slice(0, 24)];
          const updatedLogs = [...checkoutResult.logs, ...next.logs.slice(0, 150)];

          return {
            ...next,
            traces: updatedTraces,
            logs: updatedLogs,
            totalRequestsHandled: next.totalRequestsHandled + 1,
            totalFailedRequests: checkoutResult.success
              ? next.totalFailedRequests
              : next.totalFailedRequests + 1
          };
        }

        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleToggleScenario = (scenarioId: string) => {
    setSimulationState(prev => {
      const updatedFaults = prev.faults.map(f =>
        f.id === scenarioId ? { ...f, isActive: !f.isActive } : f
      );
      const intermediate = { ...prev, faults: updatedFaults };
      return recalculateSystemState(intermediate);
    });
  };

  const handleUpdateConfig = (scenarioId: string, newConfig: Partial<FaultConfig>) => {
    setSimulationState(prev => {
      const updatedFaults = prev.faults.map(f =>
        f.id === scenarioId
          ? { ...f, currentConfig: { ...f.currentConfig, ...newConfig } }
          : f
      );
      const intermediate = { ...prev, faults: updatedFaults };
      return recalculateSystemState(intermediate);
    });
  };

  const handleResetAllFaults = () => {
    setSimulationState(prev => {
      const resetFaults = prev.faults.map(f => ({
        ...f,
        isActive: false,
        currentConfig: { ...f.defaultConfig }
      }));
      const intermediate = { ...prev, faults: resetFaults };
      return recalculateSystemState(intermediate);
    });
  };

  const handleSetLoadProfile = (profile: LoadProfile) => {
    setSimulationState(prev => {
      const intermediate = { ...prev, loadProfile: profile };
      return recalculateSystemState(intermediate);
    });
  };

  const handleManualCheckout = (sku: string, price: number) => {
    const outcome = executeSyntheticCheckout(simulationState, sku, price);
    setSimulationState(prev => {
      const next = {
        ...prev,
        traces: [outcome.trace, ...prev.traces.slice(0, 24)],
        logs: [...outcome.logs, ...prev.logs.slice(0, 150)],
        totalRequestsHandled: prev.totalRequestsHandled + 1,
        totalFailedRequests: outcome.success ? prev.totalFailedRequests : prev.totalFailedRequests + 1
      };
      return recalculateSystemState(next);
    });
    return outcome;
  };

  const handleApplyMitigation = (alertId: string, actionName: string) => {
    // Reset relevant scenario
    if (actionName.includes('Payment')) {
      handleToggleScenario('scenario-01');
    } else if (actionName.includes('Optimistic') || actionName.includes('Stock')) {
      handleToggleScenario('scenario-02');
    } else if (actionName.includes('Worker') || actionName.includes('Replicas')) {
      handleToggleScenario('scenario-04');
    } else if (actionName.includes('Restart') || actionName.includes('Timeout')) {
      handleToggleScenario('scenario-05');
    } else {
      handleResetAllFaults();
    }
  };

  const handleOpenTrace = (traceId: string) => {
    setTargetTraceId(traceId);
    setActiveTab('traces');
  };

  const activeFaultCount = simulationState.faults.filter(f => f.isActive).length;
  const firingAlertCount = simulationState.alerts.filter(a => a.status === 'firing').length;

  const globalHealthStatus =
    activeFaultCount > 1 || firingAlertCount > 1
      ? 'failing'
      : activeFaultCount === 1 || firingAlertCount === 1
      ? 'degraded'
      : 'healthy';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top System Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-950/40 border border-indigo-400/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-100 font-mono">
                  ShopFlow
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Reliability &amp; SLO Lab
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Go + Python Mesh
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Outbox Saga • OTel Tracing • Pyrra Error Budgets • 10 Chaos Scenarios
              </p>
            </div>
          </div>

          {/* Real-time Status Pills & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Global Health Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                globalHealthStatus === 'healthy'
                  ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                  : globalHealthStatus === 'degraded'
                  ? 'border-amber-500/60 bg-amber-950/30 text-amber-300 animate-pulse'
                  : 'border-rose-500/80 bg-rose-950/40 text-rose-300 animate-bounce'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  globalHealthStatus === 'healthy'
                    ? 'bg-emerald-400'
                    : globalHealthStatus === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span className="uppercase">{globalHealthStatus}</span>
            </div>

            {/* k6 Load Testing Traffic Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono">
              <Radio className="w-3.5 h-3.5 text-indigo-400 ml-1.5" />
              <span className="text-slate-400 text-[11px] mr-1">Traffic:</span>
              <button
                onClick={() => handleSetLoadProfile('paused')}
                className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  simulationState.loadProfile === 'paused'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                0 RPS
              </button>
              <button
                onClick={() => handleSetLoadProfile('steady')}
                className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  simulationState.loadProfile === 'steady'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Steady (45)
              </button>
              <button
                onClick={() => handleSetLoadProfile('flash_sale')}
                className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  simulationState.loadProfile === 'flash_sale'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flash (145)
              </button>
              <button
                onClick={() => handleSetLoadProfile('black_friday')}
                className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                  simulationState.loadProfile === 'black_friday'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Spike (320)
              </button>
            </div>

            {/* Shopper Checkout Trigger */}
            <button
              onClick={() => setIsShopperModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50 cursor-pointer active:scale-95 transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Simulate Checkout</span>
            </button>

            {/* Reset Chaos Button */}
            {activeFaultCount > 0 && (
              <button
                onClick={handleResetAllFaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/50 cursor-pointer active:scale-95 transition-all animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset {activeFaultCount} Fault{activeFaultCount > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('topology')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'topology'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Architecture Mesh</span>
          </button>

          <button
            onClick={() => setActiveTab('faults')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer relative ${
              activeTab === 'faults'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${activeFaultCount > 0 ? 'text-rose-400' : ''}`} />
            <span>Chaos Engine (10)</span>
            {activeFaultCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('slos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'slos'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Pyrra SLOs &amp; Burn Rate</span>
          </button>

          <button
            onClick={() => setActiveTab('traces')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'traces'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Distributed Tracing (Tempo)</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Structured Logs (Loki)</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer relative ${
              activeTab === 'alerts'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <BellRing className={`w-3.5 h-3.5 ${firingAlertCount > 0 ? 'text-rose-400' : ''}`} />
            <span>Alert Sink (:9099)</span>
            {firingAlertCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500 text-white">
                {firingAlertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('postmortem')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'postmortem'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Postmortem Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Codebase Explorer</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {activeTab === 'topology' && (
          <TopologyGraph
            services={simulationState.services}
            infra={simulationState.infra}
            onSelectService={svc => {
              setSelectedService(svc);
              setSelectedInfra(null);
            }}
            onSelectInfra={inf => {
              setSelectedInfra(inf);
              setSelectedService(null);
            }}
            activeFaultCount={activeFaultCount}
          />
        )}

        {activeTab === 'faults' && (
          <FaultInjectionPanel
            scenarios={simulationState.faults}
            onToggleScenario={handleToggleScenario}
            onUpdateConfig={handleUpdateConfig}
            onResetAllFaults={handleResetAllFaults}
          />
        )}

        {activeTab === 'slos' && (
          <SLODashboard slos={simulationState.slos} />
        )}

        {activeTab === 'traces' && (
          <DistributedTracingView
            traces={simulationState.traces}
            onTriggerTrace={() => handleManualCheckout('sku-101', 299.99)}
            selectedTraceIdProp={targetTraceId}
          />
        )}

        {activeTab === 'logs' && (
          <LokiLogsView
            logs={simulationState.logs}
            onClearLogs={() => setSimulationState(prev => ({ ...prev, logs: [] }))}
            onOpenTrace={handleOpenTrace}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertSinkView
            alerts={simulationState.alerts}
            onApplyMitigation={handleApplyMitigation}
          />
        )}

        {activeTab === 'postmortem' && (
          <PostmortemStudio
            postmortems={postmortems}
            activeFaults={simulationState.faults.filter(f => f.isActive)}
            recentLogs={simulationState.logs}
            onSaveNewPostmortem={newPm => setPostmortems(prev => [newPm, ...prev])}
          />
        )}

        {activeTab === 'code' && (
          <CodeRepositoryView />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            ShopFlow Multi-Service Reliability Platform • Built for SLO-Driven Chaos &amp; Verification
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>OTel Collector :4317</span>
            <span>Prometheus :9090</span>
            <span>Loki :3100</span>
            <span>Tempo :4318</span>
            <span>Pyrra :9099</span>
          </div>
        </div>
      </footer>

      {/* Live Shopper Simulation Modal */}
      <ShopperCheckoutModal
        isOpen={isShopperModalOpen}
        onClose={() => setIsShopperModalOpen(false)}
        onCheckout={handleManualCheckout}
        onViewTrace={handleOpenTrace}
      />

      {/* Service Detail Drawer */}
      <ServiceDetailDrawer
        service={selectedService}
        infra={selectedInfra}
        onClose={() => {
          setSelectedService(null);
          setSelectedInfra(null);
        }}
        scenarios={simulationState.faults}
        onToggleScenario={handleToggleScenario}
      />
    </div>
  );
}
