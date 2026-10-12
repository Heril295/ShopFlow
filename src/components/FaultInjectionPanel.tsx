import React, { useState } from 'react';
import { FaultScenario, FaultConfig } from '../types/shopflow';
import {
  Flame,
  RotateCcw,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Clock,
  Zap,
  Filter,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface FaultInjectionPanelProps {
  scenarios: FaultScenario[];
  onToggleScenario: (scenarioId: string) => void;
  onUpdateConfig: (scenarioId: string, newConfig: Partial<FaultConfig>) => void;
  onResetAllFaults: () => void;
}

export const FaultInjectionPanel: React.FC<FaultInjectionPanelProps> = ({
  scenarios,
  onToggleScenario,
  onUpdateConfig,
  onResetAllFaults
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>('scenario-01');

  const categories = ['all', 'Latency', 'Concurrency', 'Resource Exhaustion', 'Queue Lag', 'Error', 'Network', 'Outbox'];

  const filteredScenarios = scenarios.filter(s =>
    selectedCategory === 'all' ? true : s.category.toLowerCase() === selectedCategory.toLowerCase()
  );

  const activeCount = scenarios.filter(s => s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header & Global Control Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-100">ShopFlow Chaos & Fault Injection Engine</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
              10 Production Scenarios
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate real cloud outages, cascading failures, cache stampedes, and network partitions via service Admin APIs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-mono">Active Chaos</div>
            <div className={`text-sm font-bold font-mono ${activeCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {activeCount} Scenario{activeCount === 1 ? '' : 's'} Live
            </div>
          </div>

          <button
            onClick={onResetAllFaults}
            disabled={activeCount === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all ${
              activeCount > 0
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/50 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Reset All Faults
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5" /> Filter by Type:
        </span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-mono capitalize transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Scenarios Grid / List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredScenarios.map(sc => {
          const isExpanded = expandedId === sc.id;

          return (
            <div
              key={sc.id}
              className={`rounded-xl border transition-all ${
                sc.isActive
                  ? 'border-rose-500/70 bg-gradient-to-r from-rose-950/20 via-slate-900 to-rose-950/10 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/40'
                  : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              {/* Card Summary Header */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      sc.isActive
                        ? 'bg-rose-500 text-white animate-bounce'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    #{sc.scenarioNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-100">{sc.name}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                        Target: {sc.targetServiceId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                        {sc.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{sc.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleScenario(sc.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                      sc.isActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-900/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${sc.isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                    {sc.isActive ? 'Active (Click to Stop)' : 'Inject Fault'}
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sc.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Toggle parameter details"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Diagnostics & Sliders */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-800/80 bg-slate-950/70 space-y-4">
                  {/* Parameter Sliders */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="text-slate-400">Injected Latency</span>
                        <span className="text-indigo-400 font-bold">{sc.currentConfig.latencyMs}ms</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="4000"
                        step="100"
                        value={sc.currentConfig.latencyMs}
                        onChange={e => onUpdateConfig(sc.id, { latencyMs: Number(e.target.value) })}
                        className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="text-slate-400">Injected Error Rate</span>
                        <span className="text-rose-400 font-bold">{Math.round(sc.currentConfig.errorRate * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={sc.currentConfig.errorRate}
                        onChange={e => onUpdateConfig(sc.id, { errorRate: parseFloat(e.target.value) })}
                        className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sc.currentConfig.timeout}
                          onChange={e => onUpdateConfig(sc.id, { timeout: e.target.checked })}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                        />
                        <span>Force Gateway Timeout (&gt;5s)</span>
                      </label>
                    </div>
                  </div>

                  {/* Expected Symptoms & Blast Radius */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Expected Symptoms & Blast Radius</span>
                      </div>
                      <ul className="space-y-1 text-slate-400">
                        {sc.expectedSymptoms.map((symp, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{symp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Recommended SRE Mitigation Action</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{sc.recommendedMitigation}</p>

                      {/* Admin API curl snippet */}
                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-indigo-400" />
                          <span>Admin API endpoint:</span>
                        </span>
                        <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-300">
                          PUT :{sc.targetServiceId === 'api-gateway' ? '9000' : sc.targetServiceId === 'order-service' ? '9001' : sc.targetServiceId === 'payment-service' ? '9002' : sc.targetServiceId === 'catalog-service' ? '9003' : '9004'}/admin/faults
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
