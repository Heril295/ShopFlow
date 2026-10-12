import React, { useState } from 'react';
import { DistributedTrace, TraceSpan } from '../types/shopflow';
import {
  GitCommit,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Play,
  Share2,
  Tag,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DistributedTracingViewProps {
  traces: DistributedTrace[];
  onTriggerTrace: () => void;
  onSelectTraceId?: (traceId: string) => void;
  selectedTraceIdProp?: string;
}

export const DistributedTracingView: React.FC<DistributedTracingViewProps> = ({
  traces,
  onTriggerTrace,
  onSelectTraceId,
  selectedTraceIdProp
}) => {
  const [selectedTraceId, setSelectedTraceId] = useState<string>(
    selectedTraceIdProp || traces[0]?.traceId || ''
  );
  const [filter, setFilter] = useState<'all' | 'errors' | 'slow'>('all');
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  const activeTrace = traces.find(t => t.traceId === selectedTraceId) || traces[0];

  const filteredTraces = traces.filter(t => {
    if (filter === 'errors') return t.status === 'error';
    if (filter === 'slow') return t.totalDurationMs > 500;
    return true;
  });

  const handleSelectTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    setSelectedSpan(null);
    if (onSelectTraceId) onSelectTraceId(traceId);
  };

  const getServiceColor = (serviceName: string) => {
    switch (serviceName) {
      case 'api-gateway':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'order-service':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'payment-service':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'inventory-service':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'catalog-service':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'notification-worker':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">Grafana Tempo & OpenTelemetry Trace Visualizer</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              OTLP / W3C TraceContext
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end distributed transaction tracing with parent-child span waterfalls and latency profiling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerTrace}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50 cursor-pointer active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Generate New Trace
          </button>
        </div>
      </div>

      {/* Main Layout: Left Trace List, Right Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Trace List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 px-2">Filter ({filteredTraces.length}):</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                  filter === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('errors')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                  filter === 'errors' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                5xx Errors
              </button>
              <button
                onClick={() => setFilter('slow')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                  filter === 'slow' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Slow &gt;500ms
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredTraces.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                No traces match selected filter.
              </div>
            ) : (
              filteredTraces.map(trace => {
                const isSelected = activeTrace?.traceId === trace.traceId;
                return (
                  <div
                    key={trace.traceId}
                    onClick={() => handleSelectTrace(trace.traceId)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-slate-900 shadow-md ring-1 ring-indigo-500/50'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {trace.status === 'ok' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span className="font-mono font-bold text-slate-200">{trace.endpoint}</span>
                      </div>
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          trace.status === 'ok'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {trace.httpStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 line-clamp-1 mb-2 font-mono">
                      {trace.userScenario}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5">
                      <span>{trace.traceId}</span>
                      <span className={`font-semibold ${trace.totalDurationMs > 500 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {trace.totalDurationMs}ms
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Waterfall Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {activeTrace ? (
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
              {/* Trace Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Trace ID:</span>
                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                      {activeTrace.traceId}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        activeTrace.status === 'ok'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      Status: {activeTrace.httpStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Total Duration: <strong className="text-slate-200">{activeTrace.totalDurationMs}ms</strong> | Spans:{' '}
                    <strong className="text-slate-200">{activeTrace.spans.length}</strong>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400">
                  {new Date(activeTrace.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Waterfall Timeline Spans */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-mono text-slate-400 px-2 border-b border-slate-800/60 pb-1">
                  <span>Service & Operation Span Hierarchy</span>
                  <span>Timeline (0ms - {activeTrace.totalDurationMs}ms)</span>
                </div>

                {activeTrace.spans.map((span, index) => {
                  const maxDuration = activeTrace.totalDurationMs || 100;
                  const leftPercent = Math.min(90, (span.startTimeOffsetMs / maxDuration) * 100);
                  const widthPercent = Math.max(8, (span.durationMs / maxDuration) * 100);
                  const isSpanSelected = selectedSpan?.spanId === span.spanId;

                  return (
                    <div
                      key={span.spanId}
                      onClick={() => setSelectedSpan(span)}
                      className={`p-2 rounded-lg cursor-pointer transition-all border ${
                        isSpanSelected
                          ? 'border-indigo-400 bg-slate-800/80'
                          : 'border-slate-800/70 bg-slate-950/60 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getServiceColor(span.serviceName)}`}>
                            {span.serviceName}
                          </span>
                          <span className="font-bold text-slate-200 text-[11px]">{span.operationName}</span>
                          {span.status === 'error' && (
                            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 rounded">
                              ERROR
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{span.durationMs}ms</span>
                      </div>

                      {/* Visual Gantt Bar */}
                      <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative">
                        <div
                          style={{
                            marginLeft: `${leftPercent}%`,
                            width: `${widthPercent}%`
                          }}
                          className={`h-full rounded-full transition-all ${
                            span.status === 'error'
                              ? 'bg-rose-500'
                              : span.durationMs > 1000
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Span Attribute Inspector Drawer */}
              {selectedSpan && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-3 mt-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-slate-200">
                        Span Attributes: {selectedSpan.operationName} ({selectedSpan.spanId})
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedSpan(null)}
                      className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Service:</span>{' '}
                      <span className="text-indigo-300 font-semibold">{selectedSpan.serviceName}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Duration:</span>{' '}
                      <span className="text-slate-200 font-semibold">{selectedSpan.durationMs}ms</span>
                    </div>
                    {Object.entries(selectedSpan.tags).map(([k, v]) => (
                      <div key={k} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-200 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/40">
              No trace selected. Click a trace on the left or click "Generate New Trace".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
