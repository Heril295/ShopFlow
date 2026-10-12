import React, { useState } from 'react';
import { AlertItem } from '../types/shopflow';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Code,
  Check
} from 'lucide-react';

interface AlertSinkViewProps {
  alerts: AlertItem[];
  onApplyMitigation?: (alertId: string, actionName: string) => void;
}

export const AlertSinkView: React.FC<AlertSinkViewProps> = ({
  alerts,
  onApplyMitigation
}) => {
  const [showWebhookPayload, setShowWebhookPayload] = useState<boolean>(false);
  const [mitigatedAlerts, setMitigatedAlerts] = useState<Set<string>>(new Set());

  const firingAlerts = alerts.filter(a => a.status === 'firing');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

  const handleMitigate = (alert: AlertItem) => {
    if (alert.mitigationActionName && onApplyMitigation) {
      onApplyMitigation(alert.id, alert.mitigationActionName);
      setMitigatedAlerts(prev => new Set(prev).add(alert.id));
    }
  };

  const sampleWebhookPayload = {
    receiver: 'shopflow-alert-sink',
    status: firingAlerts.length > 0 ? 'firing' : 'resolved',
    alerts: firingAlerts.map(a => ({
      status: a.status,
      labels: a.labels,
      annotations: {
        summary: a.summary,
        description: a.description,
        runbook_url: a.runbookUrl
      },
      startsAt: new Date().toISOString()
    })),
    groupLabels: { app: 'shopflow' },
    commonLabels: { cluster: 'shopflow-k8s-prod', env: 'production' }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className={`w-5 h-5 ${firingAlerts.length > 0 ? 'text-rose-500 animate-bounce' : 'text-emerald-400'}`} />
            <h3 className="text-lg font-bold text-slate-100">Alertmanager Webhook Sink (:9099)</h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                firingAlerts.length > 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {firingAlerts.length} Firing Alert{firingAlerts.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Receives real-time alerts from Prometheus Alertmanager, maps them to on-call runbooks, and executes mitigation tasks.
          </p>
        </div>

        <button
          onClick={() => setShowWebhookPayload(!showWebhookPayload)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
        >
          <Code className="w-3.5 h-3.5 text-indigo-400" />
          <span>{showWebhookPayload ? 'Hide Webhook JSON' : 'Inspect Webhook Payload'}</span>
        </button>
      </div>

      {/* Raw Webhook Inspector if toggled */}
      {showWebhookPayload && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-mono text-slate-400 mb-2 font-bold">
            POST http://alert-sink:9099/webhook (Incoming Alertmanager HTTP Body)
          </div>
          <pre className="p-3 rounded-lg bg-slate-900 text-[11px] font-mono text-indigo-300 overflow-x-auto leading-relaxed border border-slate-800">
            <code>{JSON.stringify(sampleWebhookPayload, null, 2)}</code>
          </pre>
        </div>
      )}

      {/* Firing Alerts List */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          Active Firing Incidents &amp; Runbooks
        </h4>

        {firingAlerts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h5 className="font-bold text-slate-200 text-sm">All Quiet on On-Call Channels</h5>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No alerts are currently firing. All SLO burn rates are below critical thresholds and circuit breakers are closed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {firingAlerts.map(alert => {
              const isMitigated = mitigatedAlerts.has(alert.id);

              return (
                <div
                  key={alert.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    alert.severity === 'critical'
                      ? 'border-rose-500/70 bg-gradient-to-r from-rose-950/30 via-slate-900 to-slate-950 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/40'
                      : 'border-amber-500/60 bg-amber-950/20'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                          alert.severity === 'critical'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-amber-500 text-slate-950 font-extrabold'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <h5 className="text-base font-bold text-slate-100 font-mono">{alert.alertname}</h5>
                      <span className="text-xs font-mono text-indigo-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {alert.service}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-400">Firing since: {alert.startsAt}</span>
                  </div>

                  <p className="text-sm font-semibold text-slate-200 mb-1">{alert.summary}</p>
                  <p className="text-xs text-slate-400 mb-4">{alert.description}</p>

                  {/* Runbook & 1-Click Mitigation Section */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">Runbook:</span>
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                        {alert.runbookUrl}
                      </span>
                    </div>

                    {alert.mitigationAvailable && (
                      <button
                        onClick={() => handleMitigate(alert)}
                        disabled={isMitigated}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          isMitigated
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50 active:scale-95'
                        }`}
                      >
                        {isMitigated ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span>Mitigation Applied (Recovering...)</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Runbook Action: {alert.mitigationActionName}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolved Alerts Archive */}
      {resolvedAlerts.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
            Recently Resolved Alerts
          </h4>
          <div className="space-y-2">
            {resolvedAlerts.map(alert => (
              <div
                key={alert.id}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-bold">{alert.alertname}</span>
                  <span className="text-slate-500">[{alert.service}]</span>
                  <span className="text-slate-400">- {alert.summary}</span>
                </div>
                <span className="text-emerald-400 text-[11px] font-semibold">RESOLVED</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
