import React, { useState } from 'react';
import { SLODefinition } from '../types/shopflow';
import {
  Target,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCode,
  Copy,
  Check,
  TrendingDown,
  Activity,
  Layers
} from 'lucide-react';

interface SLODashboardProps {
  slos: SLODefinition[];
}

export const SLODashboard: React.FC<SLODashboardProps> = ({ slos }) => {
  const [selectedSLOId, setSelectedSLOId] = useState<string>(slos[0]?.id || 'slo-gateway-availability');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedSLO = slos.find(s => s.id === selectedSLOId) || slos[0];

  const handleCopyManifest = (manifest: string) => {
    navigator.clipboard.writeText(manifest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: SLODefinition['status']) => {
    switch (status) {
      case 'compliant':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Budget Healthy
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Budget Burning (Warning)
          </span>
        );
      case 'burning':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            <Flame className="w-3.5 h-3.5" /> Critical Multi-Burn Alert
          </span>
        );
      case 'breached':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-red-600 text-white">
            <Flame className="w-3.5 h-3.5" /> Error Budget Exhausted (0%)
          </span>
        );
    }
  };

  const calculateTimeToExhaustion = (slo: SLODefinition): string => {
    if (slo.burnRate1h <= 1.0) return '> 30 days (Normal)';
    if (slo.errorBudgetRemainingPercent <= 0) return 'Exhausted!';
    const hoursRemaining = Math.max(0.5, (slo.errorBudgetRemainingPercent / (slo.burnRate1h * (100 / 720))));
    if (hoursRemaining < 1) return `${Math.round(hoursRemaining * 60)} minutes`;
    if (hoursRemaining < 48) return `${Math.round(hoursRemaining)} hours`;
    return `${Math.round(hoursRemaining / 24)} days`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">Pyrra SLO & Multi-Window Burn Rate Engine</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Google SRE Workbook Standard
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracks 30-day rolling error budgets and fires tiered paging alerts (14.4x 1h / 6.0x 6h / 3.0x 24h) to avoid alert fatigue.
          </p>
        </div>

        {/* SLO Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          {slos.map(slo => (
            <button
              key={slo.id}
              onClick={() => setSelectedSLOId(slo.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                selectedSLOId === slo.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span>{slo.name}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  slo.status === 'compliant'
                    ? 'bg-emerald-400'
                    : slo.status === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-rose-400 animate-ping'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Main Selected SLO Card */}
      {selectedSLO && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-xl font-bold text-slate-100">{selectedSLO.name}</h4>
                {getStatusBadge(selectedSLO.status)}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Target: {selectedSLO.targetPercent}% over {selectedSLO.windowDays}d window | Service: {selectedSLO.serviceId}
              </p>
              <p className="text-xs text-slate-300 mt-2 max-w-2xl bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-indigo-400 font-semibold font-mono">SLI: </span>
                {selectedSLO.sliDescription}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400 font-mono">Time to Budget Exhaustion</div>
              <div className={`text-xl font-mono font-extrabold ${selectedSLO.burnRate1h > 6.0 ? 'text-rose-400 animate-pulse' : 'text-slate-100'}`}>
                {calculateTimeToExhaustion(selectedSLO)}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Current 1h Burn Rate: {selectedSLO.burnRate1h}x
              </div>
            </div>
          </div>

          {/* Error Budget Bar & Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Metric 1: Current Availability */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400">Current Availability</div>
              <div
                className={`text-2xl font-black mt-1 ${
                  selectedSLO.currentAvailability < selectedSLO.targetPercent
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedSLO.currentAvailability}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Target: {selectedSLO.targetPercent}% ({selectedSLO.targetPercent === 99.9 ? 'Three Nines' : 'P95 SLA'})
              </div>
            </div>

            {/* Metric 2: Error Budget Remaining */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400">Remaining Budget</div>
              <div
                className={`text-2xl font-black mt-1 ${
                  selectedSLO.errorBudgetRemainingPercent < 20
                    ? 'text-rose-400'
                    : selectedSLO.errorBudgetRemainingPercent < 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedSLO.errorBudgetRemainingPercent}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {selectedSLO.errorBudgetTotalMinutes} min total 30d allowance
              </div>
            </div>

            {/* Metric 3: 1h Burn Rate */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">1h Burn Rate</span>
                <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Alert @ 14.4x</span>
              </div>
              <div
                className={`text-2xl font-black mt-1 ${
                  selectedSLO.burnRate1h >= 14.4
                    ? 'text-rose-400 font-extrabold animate-bounce'
                    : selectedSLO.burnRate1h > 3.0
                    ? 'text-amber-400'
                    : 'text-slate-100'
                }`}
              >
                {selectedSLO.burnRate1h}x
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {selectedSLO.burnRate1h >= 14.4 ? '🔥 Page Alert Firing' : 'Within tolerance'}
              </div>
            </div>

            {/* Metric 4: 6h Burn Rate */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">6h Burn Rate</span>
                <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Alert @ 6.0x</span>
              </div>
              <div
                className={`text-2xl font-black mt-1 ${
                  selectedSLO.burnRate6h >= 6.0
                    ? 'text-rose-400 font-extrabold'
                    : selectedSLO.burnRate6h > 2.0
                    ? 'text-amber-400'
                    : 'text-slate-100'
                }`}
              >
                {selectedSLO.burnRate6h}x
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {selectedSLO.burnRate6h >= 6.0 ? '🔥 Page Alert Firing' : 'Within tolerance'}
              </div>
            </div>
          </div>

          {/* Visual Progress Bar for Error Budget */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-2">
              <span className="text-slate-400">30-Day Error Budget Consumption Bar:</span>
              <span className="text-slate-300 font-semibold">
                {selectedSLO.errorBudgetRemainingPercent}% Available ({(100 - selectedSLO.errorBudgetRemainingPercent).toFixed(1)}% Consumed)
              </span>
            </div>

            <div className="w-full h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${selectedSLO.errorBudgetRemainingPercent}%` }}
                className={`h-full transition-all duration-500 ${
                  selectedSLO.errorBudgetRemainingPercent < 20
                    ? 'bg-rose-500'
                    : selectedSLO.errorBudgetRemainingPercent < 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1.5">
              <span>0% (SLO Violated)</span>
              <span>50% Budget Buffer</span>
              <span>100% (Zero Errors)</span>
            </div>
          </div>

          {/* Pyrra Kubernetes Manifest Snippet */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-300">
                <FileCode className="w-4 h-4" />
                <span>Pyrra Custom Resource Definition (slo/{selectedSLO.serviceId}.yaml)</span>
              </div>
              <button
                onClick={() => handleCopyManifest(selectedSLO.pyrraManifestSnippet)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy YAML'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{selectedSLO.pyrraManifestSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      {/* SRE Multi-window Burn Rate Table Explanation */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
        <h5 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Google SRE Multi-Window Multi-Burn-Rate Alert Logic:
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-400 mt-3">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-rose-400 font-bold mb-1">14.4x Burn Rate (1-Hour Window)</div>
            <p className="text-[11px]">Consumes 2% of budget in 1 hour. Urgency: Immediate Page. High severity outage in progress.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-amber-400 font-bold mb-1">6.0x Burn Rate (6-Hour Window)</div>
            <p className="text-[11px]">Consumes 5% of budget in 6 hours. Urgency: Page. Detects medium-severity persistent degradations.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-indigo-400 font-bold mb-1">3.0x Burn Rate (24-Hour Window)</div>
            <p className="text-[11px]">Consumes 10% of budget in 24 hours. Urgency: Ticket. Slow burn to be resolved during business hours.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
