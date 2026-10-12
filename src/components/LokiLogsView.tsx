import React, { useState } from 'react';
import { LokiLog } from '../types/shopflow';
import {
  Terminal,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Pause,
  Play
} from 'lucide-react';

interface LokiLogsViewProps {
  logs: LokiLog[];
  onClearLogs?: () => void;
  onOpenTrace?: (traceId: string) => void;
}

export const LokiLogsView: React.FC<LokiLogsViewProps> = ({
  logs,
  onClearLogs,
  onOpenTrace
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const levels = ['all', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  const services = ['all', 'api-gateway', 'order-service', 'payment-service', 'inventory-service', 'catalog-service', 'notification-worker'];

  const filteredLogs = logs.filter(log => {
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;
    if (selectedService !== 'all' && log.service !== selectedService) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchService = log.service.toLowerCase().includes(q);
      const matchTrace = log.traceId?.toLowerCase().includes(q);
      return matchMsg || matchService || matchTrace;
    }
    return true;
  });

  const getLevelColor = (level: LokiLog['level']) => {
    switch (level) {
      case 'DEBUG':
        return 'text-slate-400 bg-slate-800/80 border-slate-700';
      case 'INFO':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      case 'ERROR':
        return 'text-rose-400 bg-rose-950/50 border-rose-800/70';
      case 'FATAL':
        return 'text-red-300 bg-red-900 border-red-700 font-bold';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">Grafana Loki Live Structured Log Stream</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              LogQL Query Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated stdout/stderr logs from Go and Python microservices with distributed trace correlation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
              isPaused ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Stream Paused' : 'Live Streaming'}
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 cursor-pointer"
              title="Clear terminal buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Query Bar & Filters */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-3 text-xs font-mono">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder='LogQL filter: {service="order-service"} |= "error" or keyword...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-[11px]">Level:</span>
          {levels.map(lvl => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2 py-1 rounded text-[11px] uppercase cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Service Filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-[11px]">Service:</span>
          <select
            value={selectedService}
            onChange={e => setSelectedService(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none"
          >
            {services.map(svc => (
              <option key={svc} value={svc}>{svc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Terminal Window */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs max-h-[580px] overflow-y-auto space-y-1.5 shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-10">
            No logs found matching current LogQL query.
          </div>
        ) : (
          filteredLogs.map(log => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div
                key={log.id}
                className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-slate-900/80 transition-colors border-b border-slate-900/60"
              >
                <span className="text-slate-500 text-[11px] shrink-0">{timeStr}</span>

                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 border ${getLevelColor(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>

                <span className="text-indigo-400 text-[11px] shrink-0 font-semibold">
                  [{log.service}]
                </span>

                <span className="text-slate-300 text-xs flex-1 break-all leading-relaxed">
                  {log.message}
                </span>

                {log.traceId && (
                  <button
                    onClick={() => onOpenTrace && onOpenTrace(log.traceId!)}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded cursor-pointer shrink-0 ml-1"
                    title="Inspect trace in Tempo"
                  >
                    <span>{log.traceId}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
