import React from 'react';
import { ServiceNode, InfraNode, FaultScenario } from '../types/shopflow';
import {
  Server,
  Database,
  Cpu,
  Activity,
  Shield,
  Layers,
  Terminal,
  Clock,
  Zap,
  Flame
} from 'lucide-react';

interface ServiceDetailDrawerProps {
  service: ServiceNode | null;
  infra: InfraNode | null;
  onClose: () => void;
  scenarios: FaultScenario[];
  onToggleScenario: (scenarioId: string) => void;
}

export const ServiceDetailDrawer: React.FC<ServiceDetailDrawerProps> = ({
  service,
  infra,
  onClose,
  scenarios,
  onToggleScenario
}) => {
  if (!service && !infra) return null;

  const relevantScenarios = service
    ? scenarios.filter(s => s.targetServiceId === service.id)
    : [];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {service ? (
            <>
              <Server className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-slate-100 text-lg">{service.name}</h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  service.language === 'Go'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {service.language}
              </span>
            </>
          ) : infra ? (
            <>
              <Database className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-slate-100 text-lg">{infra.name}</h3>
            </>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 cursor-pointer text-sm"
        >
          ✕
        </button>
      </div>

      {/* Service Details */}
      {service && (
        <div className="space-y-6">
          <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            {service.description}
          </p>

          {/* RED Metrics Grid */}
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Live RED Metrics (Rate, Errors, Duration)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Throughput</div>
                <div className="text-base font-bold text-slate-100 mt-0.5">{service.rps} req/s</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">P95 Latency</div>
                <div className={`text-base font-bold mt-0.5 ${service.p95LatencyMs > 500 ? 'text-rose-400' : 'text-slate-100'}`}>
                  {service.p95LatencyMs}ms
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Error Rate</div>
                <div className={`text-base font-bold mt-0.5 ${service.errorRatePercent > 5 ? 'text-rose-400' : 'text-slate-100'}`}>
                  {service.errorRatePercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Runtime & Ports */}
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Runtime &amp; Networking
            </h4>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Public Service Port:</span>
                <span className="text-indigo-400 font-bold">:{service.port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Admin Fault Injection Port:</span>
                <span className="text-rose-400 font-bold">:{service.adminPort}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Circuit Breaker State:</span>
                <span className={`font-bold uppercase ${service.circuitBreakerState === 'open' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {service.circuitBreakerState}
                </span>
              </div>
              {service.activeConnections !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Database Connection Pool:</span>
                  <span className="text-slate-200">
                    {service.activeConnections} / {service.maxConnections || 50}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">CPU Usage / Memory:</span>
                <span className="text-slate-200">{service.cpuPercent}% / {service.memoryMb}MB</span>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Technology Stack
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {service.technologies.map(t => (
                <span key={t} className="px-2 py-1 rounded-lg bg-slate-950 text-indigo-300 border border-slate-800 text-[11px] font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Faults targeting this service */}
          {relevantScenarios.length > 0 && (
            <div>
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Chaos Scenarios Targeting This Service
              </h4>
              <div className="space-y-2">
                {relevantScenarios.map(sc => (
                  <div
                    key={sc.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{sc.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Category: {sc.category}</div>
                    </div>
                    <button
                      onClick={() => onToggleScenario(sc.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                        sc.isActive
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {sc.isActive ? 'Active' : 'Trigger'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Infra Details */}
      {infra && (
        <div className="space-y-4 font-mono text-xs">
          <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">{infra.details}</p>
          <div className="space-y-2">
            <h4 className="text-slate-400 uppercase tracking-wider font-bold">Metrics</h4>
            {Object.entries(infra.metrics).map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">{k}:</span>
                <span className="text-indigo-400 font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
