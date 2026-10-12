import React, { useState } from 'react';
import { Postmortem, FaultScenario, LokiLog } from '../types/shopflow';
import {
  FileText,
  AlertOctagon,
  Copy,
  Check,
  PlusCircle,
  Clock,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  Calendar,
  User,
  HelpCircle
} from 'lucide-react';

interface PostmortemStudioProps {
  postmortems: Postmortem[];
  activeFaults: FaultScenario[];
  recentLogs: LokiLog[];
  onSaveNewPostmortem?: (pm: Postmortem) => void;
}

export const PostmortemStudio: React.FC<PostmortemStudioProps> = ({
  postmortems,
  activeFaults,
  recentLogs,
  onSaveNewPostmortem
}) => {
  const [selectedId, setSelectedId] = useState<string>(postmortems[0]?.id || '');
  const [copied, setCopied] = useState<boolean>(false);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  const activePostmortem = postmortems.find(p => p.id === selectedId) || postmortems[0];

  const exportToMarkdown = (pm: Postmortem): string => {
    return `# Postmortem: ${pm.title}
**Incident ID:** ${pm.incidentNumber}
**Date:** ${pm.date}
**Severity:** ${pm.severity}
**Author:** ${pm.author}
**Status:** ${pm.status}

## Executive Summary
${pm.executiveSummary}

## Impact Assessment
- **Outage Duration:** ${pm.impactMetrics.durationMinutes} minutes
- **Failed Requests:** ${pm.impactMetrics.failedRequests.toLocaleString()}
- **Estimated Revenue Impact:** $${pm.impactMetrics.revenueImpactUsd.toLocaleString()}
- **SLO Error Budget Consumed:** ${pm.impactMetrics.sloBudgetConsumedPercent}%

## Incident Timeline
${pm.timeline.map(t => `- **${t.time}**: ${t.event} (${t.author})`).join('\n')}

## Root Cause Analysis
${pm.rootCause}

### 5 Whys Analysis
${pm.fiveWhys.map((why, idx) => `${idx + 1}. ${why}`).join('\n')}

## Preventative Action Items
| Action | Owner | Status |
| :--- | :--- | :--- |
${pm.preventativeActions.map(a => `| ${a.action} | ${a.owner} | ${a.status} |`).join('\n')}
`;
  };

  const handleCopyMarkdown = () => {
    if (!activePostmortem) return;
    const md = exportToMarkdown(activePostmortem);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDraftFromLiveOutage = () => {
    const faultNames = activeFaults.map(f => f.name).join(', ') || 'Downstream Microservice Degradation';
    const newPm: Postmortem = {
      id: 'postmortem-' + Date.now(),
      title: `SEV-1: Outage Triggered by ${faultNames}`,
      incidentNumber: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      severity: 'SEV-1',
      author: 'ShopFlow On-Call Commander',
      status: 'Draft',
      executiveSummary: `During chaos testing and reliability verification, the system experienced an alert condition triggered by ${faultNames}. The 14.4x multi-window burn rate alert was triggered, consuming critical error budget on the checkout flow.`,
      impactMetrics: {
        durationMinutes: 18,
        failedRequests: 6240,
        revenueImpactUsd: 38200,
        sloBudgetConsumedPercent: 32.5
      },
      timeline: [
        { time: 'T-00:00', event: `Fault injected: ${faultNames}`, author: 'Chaos Engine' },
        { time: 'T-00:02', event: 'Error rate spiked above 15% on API gateway', author: 'Prometheus' },
        { time: 'T-00:04', event: 'Pyrra fired 14.4x 1h burn rate page to on-call', author: 'Alertmanager' },
        { time: 'T-00:10', event: 'On-call diagnosed bottleneck using OTel distributed traces', author: 'On-Call' },
        { time: 'T-00:18', event: 'Mitigation applied, error budget burn stopped', author: 'On-Call' }
      ],
      rootCause: `Active chaos scenario (${faultNames}) exceeded service thresholds without sufficient automated circuit breaking.`,
      fiveWhys: [
        'Why did checkout fail? Downstream service timed out.',
        'Why did it time out? High injected latency / resource starvation.',
        'Why was it not isolated? Circuit breaker threshold was not fast enough.',
        'Why was error budget burned? Traffic continued hitting degraded nodes without failover.',
        'Why did client experience errors? Retries were exhausted.'
      ],
      preventativeActions: [
        { id: 'pa-new-1', action: 'Tune circuit breaker trip interval to 3s for this failure mode', owner: 'Platform Team', status: 'Todo' },
        { id: 'pa-new-2', action: 'Add automated fallback route to degraded dependency', owner: 'Core SRE', status: 'In Progress' }
      ]
    };

    if (onSaveNewPostmortem) {
      onSaveNewPostmortem(newPm);
    }
    setSelectedId(newPm.id);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">Blameless Postmortem Studio</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              SRE Incident Retrospective
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reconstruct incident timelines, calculate SLO budget impact, analyze 5 Whys, and export Markdown for Jira/Notion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDraftFromLiveOutage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-950/50"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Draft Postmortem from Active Outage</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied Markdown' : 'Export Markdown'}</span>
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {postmortems.map(pm => (
          <button
            key={pm.id}
            onClick={() => setSelectedId(pm.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              selectedId === pm.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <span className="font-bold">{pm.incidentNumber}</span>
            <span className="text-slate-400">({pm.severity})</span>
          </button>
        ))}
      </div>

      {/* Main Postmortem Content View */}
      {activePostmortem && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-extrabold bg-rose-500 text-white">
                  {activePostmortem.severity}
                </span>
                <span className="text-xs font-mono text-slate-400">{activePostmortem.incidentNumber}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-emerald-300 border border-slate-700">
                  {activePostmortem.status}
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-100 mt-2">{activePostmortem.title}</h4>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>{activePostmortem.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>{activePostmortem.author}</span>
              </div>
            </div>
          </div>

          {/* Key Impact Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duration
              </div>
              <div className="text-xl font-bold text-slate-100 mt-1">
                {activePostmortem.impactMetrics.durationMinutes} mins
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" /> Failed Orders
              </div>
              <div className="text-xl font-bold text-rose-400 mt-1">
                {activePostmortem.impactMetrics.failedRequests.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Estimated Revenue
              </div>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ${activePostmortem.impactMetrics.revenueImpactUsd.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Error Budget Burn
              </div>
              <div className="text-xl font-bold text-rose-400 mt-1">
                {activePostmortem.impactMetrics.sloBudgetConsumedPercent}%
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h5 className="text-xs font-mono font-bold uppercase text-slate-400">Executive Summary</h5>
            <p className="text-sm text-slate-300 leading-relaxed">{activePostmortem.executiveSummary}</p>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase text-slate-400">Incident Timeline</h5>
            <div className="space-y-2">
              {activePostmortem.timeline.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono"
                >
                  <span className="font-bold text-indigo-400 shrink-0">{item.time}</span>
                  <span className="text-slate-300 flex-1">{item.event}</span>
                  <span className="text-slate-500 shrink-0">[{item.author}]</span>
                </div>
              ))}
            </div>
          </div>

          {/* Root Cause & 5 Whys */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h5 className="text-xs font-mono font-bold uppercase text-rose-400">Root Cause</h5>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">{activePostmortem.rootCause}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h5 className="text-xs font-mono font-bold uppercase text-indigo-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> 5 Whys Analysis
              </h5>
              <ol className="space-y-1.5 text-xs text-slate-300 font-mono">
                {activePostmortem.fiveWhys.map((why, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{why}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Preventative Action Items */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Preventative Action Items
            </h5>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 text-left border-b border-slate-800">
                  <tr>
                    <th className="p-3">Action Item</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {activePostmortem.preventativeActions.map(action => (
                    <tr key={action.id} className="hover:bg-slate-900/50">
                      <td className="p-3 text-slate-200">{action.action}</td>
                      <td className="p-3 text-indigo-300 font-semibold">{action.owner}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            action.status === 'Done'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : action.status === 'In Progress'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {action.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
