import React from 'react';
import { ServiceNode, InfraNode } from '../types/shopflow';
import {
  Server,
  Database,
  Layers,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Radio,
  Zap,
  Cpu,
  Activity
} from 'lucide-react';

interface TopologyGraphProps {
  services: ServiceNode[];
  infra: InfraNode[];
  onSelectService: (service: ServiceNode) => void;
  onSelectInfra: (infra: InfraNode) => void;
  activeFaultCount: number;
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  services,
  infra,
  onSelectService,
  onSelectInfra,
  activeFaultCount
}) => {
  const gateway = services.find(s => s.id === 'api-gateway');
  const orderService = services.find(s => s.id === 'order-service');
  const paymentService = services.find(s => s.id === 'payment-service');
  const catalogService = services.find(s => s.id === 'catalog-service');
  const inventoryService = services.find(s => s.id === 'inventory-service');
  const workerService = services.find(s => s.id === 'notification-worker');
  const alertSink = services.find(s => s.id === 'alert-sink');

  const postgres = infra.find(i => i.id === 'postgres');
  const redis = infra.find(i => i.id === 'redis');
  const rabbitmq = infra.find(i => i.id === 'rabbitmq');
  const collector = infra.find(i => i.id === 'collector');

  const getStatusColor = (status: ServiceNode['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-500/50 bg-slate-900/90 text-emerald-400 shadow-emerald-950/20';
      case 'degraded':
        return 'border-amber-500/60 bg-amber-950/20 text-amber-400 shadow-amber-950/40 animate-pulse';
      case 'failing':
        return 'border-rose-500/80 bg-rose-950/30 text-rose-400 shadow-rose-950/60 ring-2 ring-rose-500/50';
    }
  };

  const getStatusBadge = (status: ServiceNode['status']) => {
    switch (status) {
      case 'healthy':
        return <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Healthy</span>;
      case 'degraded':
        return <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400"><AlertTriangle className="w-3 h-3" /> Degraded</span>;
      case 'failing':
        return <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 animate-bounce"><Flame className="w-3 h-3" /> Failing</span>;
    }
  };

  const renderServiceCard = (service?: ServiceNode, widthClass: string = 'w-72') => {
    if (!service) return null;
    return (
      <div
        onClick={() => onSelectService(service)}
        className={`relative ${widthClass} p-4 rounded-xl border backdrop-blur-md cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:border-indigo-400 ${getStatusColor(
          service.status
        )}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                service.language === 'Go'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {service.language}
            </span>
            <h4 className="font-bold text-slate-100 text-sm tracking-tight">{service.name}</h4>
          </div>
          {getStatusBadge(service.status)}
        </div>

        <p className="text-xs text-slate-400 line-clamp-1 mb-3">{service.role}</p>

        {/* Real-time RED Metrics bar */}
        <div className="grid grid-cols-3 gap-1.5 py-2 px-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">RPS</div>
            <div className="font-semibold text-slate-200">{service.rps}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">P95 Lat</div>
            <div className={`font-semibold ${service.p95LatencyMs > 500 ? 'text-rose-400 font-bold' : service.p95LatencyMs > 200 ? 'text-amber-400' : 'text-slate-200'}`}>
              {service.p95LatencyMs}ms
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">Errors</div>
            <div className={`font-semibold ${service.errorRatePercent > 10 ? 'text-rose-400 font-bold' : service.errorRatePercent > 2 ? 'text-amber-400' : 'text-slate-200'}`}>
              {service.errorRatePercent}%
            </div>
          </div>
        </div>

        {/* Port & Circuit Breaker info */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Port: :{service.port} | Admin: :{service.adminPort}</span>
          {service.circuitBreakerState !== 'closed' && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              service.circuitBreakerState === 'open' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300'
            }`}>
              CB: {service.circuitBreakerState.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderInfraCard = (node?: InfraNode) => {
    if (!node) return null;
    return (
      <div
        onClick={() => onSelectInfra(node)}
        className="w-64 p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 cursor-pointer transition-all hover:bg-slate-900/90 text-xs"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>{node.name}</span>
          </div>
          <span className={`w-2 h-2 rounded-full ${node.status === 'healthy' ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
        </div>
        <p className="text-[11px] text-slate-400 mb-2">{node.details}</p>
        <div className="space-y-1 text-[10px] font-mono text-slate-300">
          {Object.entries(node.metrics).slice(0, 2).map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span className="text-slate-400">{key}:</span>
              <span className="text-indigo-300 font-semibold">{val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900/90 to-slate-950 border border-slate-800/80 p-6 overflow-hidden">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Banner / Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800/80 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              ShopFlow Multi-Service Mesh Architecture
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Go & Python Polyglot
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronous HTTP/gRPC ingress, Outbox Saga orchestration, transactional row locks, and async RabbitMQ worker
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Go (3 Services)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Python (3 Services)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span>Infra (Postgres, Redis, MQ)</span>
          </div>
          {activeFaultCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs animate-pulse">
              <Flame className="w-3.5 h-3.5" />
              <span>{activeFaultCount} Fault{activeFaultCount > 1 ? 's' : ''} Injected</span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-tier Topology Layout */}
      <div className="flex flex-col gap-8 relative z-10">
        {/* Tier 1: Client & Ingress Gateway */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Tier 1: Edge Ingress & Circuit Breaking</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-center font-mono text-xs text-slate-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div>
                <div className="font-bold text-slate-100">Clients / k6 Traffic</div>
                <div className="text-[10px] text-slate-400">Public HTTP Port :3000</div>
              </div>
            </div>

            <ArrowRight className="w-5 h-5 text-indigo-400 animate-pulse" />

            {renderServiceCard(gateway, 'w-80')}
          </div>
        </div>

        {/* Dynamic connection lines */}
        <div className="flex justify-center items-center gap-2 text-indigo-400/40 font-mono text-[11px]">
          <span>↓↓ Reverse Proxy / JWT Verification / Circuit Breaker Protected Ingress ↓↓</span>
        </div>

        {/* Tier 2: Domain Microservices (Catalog, Order, Inventory) */}
        <div>
          <div className="text-center mb-3 text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Tier 2: Core Domain Services (Saga Orchestration & Fast Reads)</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 items-start">
            {/* Catalog Service */}
            <div className="flex flex-col items-center gap-3">
              {renderServiceCard(catalogService, 'w-72')}
              <div className="text-slate-400 text-[10px] font-mono">↓ Cache-aside pattern</div>
              {renderInfraCard(redis)}
            </div>

            {/* Order Service */}
            <div className="flex flex-col items-center gap-3">
              {renderServiceCard(orderService, 'w-80')}
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono">
                <span>↓ Transactional Outbox</span>
              </div>
              {renderInfraCard(postgres)}
            </div>

            {/* Inventory Service */}
            <div className="flex flex-col items-center gap-3">
              {renderServiceCard(inventoryService, 'w-72')}
              <div className="text-slate-400 text-[10px] font-mono">↓ SELECT FOR UPDATE</div>
              <div className="w-64 p-3 rounded-lg border border-slate-800 bg-slate-900/40 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Row-Level Concurrency</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Guarantees 0 overselling on flash sale SKUs with explicit isolation locks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 3: Downstream & Asynchronous Workers */}
        <div>
          <div className="text-center mb-3 text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Tier 3: Downstream Dependencies & Asynchronous Event Processing</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 items-start">
            {/* Payment Service */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">Sync RPC (Saga Step)</span>
              {renderServiceCard(paymentService, 'w-72')}
              <div className="text-[10px] text-slate-400 font-mono text-center max-w-[260px] mt-1">
                Simulates 3rd-party banking acquirer with configurable timeout chaos
              </div>
            </div>

            {/* RabbitMQ & Notification Worker */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">Async Event Bus</span>
              {renderInfraCard(rabbitmq)}
              <ArrowRight className="w-4 h-4 text-indigo-400 rotate-90 my-1" />
              {renderServiceCard(workerService, 'w-72')}
            </div>

            {/* OTel Collector & Alert Sink */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">Observability Pipelines</span>
              {renderInfraCard(collector)}
              <ArrowRight className="w-4 h-4 text-indigo-400 rotate-90 my-1" />
              {renderServiceCard(alertSink, 'w-72')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
