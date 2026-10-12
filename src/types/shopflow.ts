export type ServiceLanguage = 'Go' | 'Python' | 'Infra';
export type ServiceStatus = 'healthy' | 'degraded' | 'failing';

export interface ServiceNode {
  id: string;
  name: string;
  language: ServiceLanguage;
  role: string;
  port: number;
  adminPort: number;
  status: ServiceStatus;
  rps: number;
  p95LatencyMs: number;
  errorRatePercent: number;
  circuitBreakerState: 'closed' | 'half-open' | 'open';
  activeConnections?: number;
  maxConnections?: number;
  cpuPercent: number;
  memoryMb: number;
  version: string;
  description: string;
  technologies: string[];
}

export interface InfraNode {
  id: string;
  name: string;
  type: 'postgres' | 'redis' | 'rabbitmq' | 'collector';
  status: ServiceStatus;
  details: string;
  metrics: Record<string, string | number>;
}

export interface FaultConfig {
  latencyMs: number;
  errorRate: number; // 0.0 to 1.0
  timeout: boolean;
  dropRate?: number;
  queueLag?: number;
  dbPoolLimit?: number;
  circuitBreakerTripped?: boolean;
}

export interface FaultScenario {
  id: string;
  scenarioNumber: number;
  name: string;
  targetServiceId: string;
  category: 'Latency' | 'Error' | 'Resource Exhaustion' | 'Concurrency' | 'Queue Lag' | 'Network' | 'Outbox';
  description: string;
  expectedSymptoms: string[];
  recommendedMitigation: string;
  defaultConfig: FaultConfig;
  currentConfig: FaultConfig;
  isActive: boolean;
}

export interface SLODefinition {
  id: string;
  name: string;
  serviceId: string;
  targetPercent: number; // e.g. 99.9
  windowDays: number; // e.g. 30
  currentAvailability: number; // e.g. 99.72
  errorBudgetRemainingPercent: number; // e.g. 42.5
  errorBudgetTotalMinutes: number; // e.g. 43.2 min
  errorBudgetConsumedMinutes: number;
  burnRate1h: number; // e.g. 14.4x
  burnRate6h: number;
  burnRate24h: number;
  status: 'compliant' | 'warning' | 'burning' | 'breached';
  sliDescription: string;
  pyrraManifestSnippet: string;
  alertThresholds: {
    critical1h: number; // 14.4
    critical6h: number; // 6.0
    warning24h: number; // 3.0
  };
}

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTimeOffsetMs: number;
  durationMs: number;
  status: 'ok' | 'error';
  statusCode: number;
  tags: Record<string, string | number | boolean>;
  events?: Array<{
    name: string;
    timeOffsetMs: number;
    attributes?: Record<string, string | number>;
  }>;
}

export interface DistributedTrace {
  traceId: string;
  rootService: string;
  endpoint: string;
  timestamp: string;
  totalDurationMs: number;
  status: 'ok' | 'error';
  httpStatus: number;
  userScenario: string;
  spans: TraceSpan[];
}

export interface LokiLog {
  id: string;
  timestamp: string;
  service: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, string | number>;
}

export interface AlertItem {
  id: string;
  alertname: string;
  service: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'firing' | 'resolved';
  startsAt: string;
  summary: string;
  description: string;
  runbookUrl: string;
  labels: Record<string, string>;
  mitigationAvailable: boolean;
  mitigationActionName?: string;
  mitigated?: boolean;
}

export interface Postmortem {
  id: string;
  title: string;
  incidentNumber: string;
  date: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
  author: string;
  status: 'Draft' | 'In Review' | 'Published';
  executiveSummary: string;
  impactMetrics: {
    durationMinutes: number;
    failedRequests: number;
    revenueImpactUsd: number;
    sloBudgetConsumedPercent: number;
  };
  timeline: Array<{
    time: string;
    event: string;
    author: string;
  }>;
  rootCause: string;
  fiveWhys: string[];
  preventativeActions: Array<{
    id: string;
    action: string;
    owner: string;
    status: 'Todo' | 'In Progress' | 'Done';
  }>;
}

export interface CodeFile {
  path: string;
  filename: string;
  language: 'go' | 'python' | 'yaml' | 'json' | 'javascript' | 'makefile' | 'bash';
  category: 'Service (Go)' | 'Service (Python)' | 'Observability' | 'SLO (Pyrra)' | 'Load Testing' | 'Kubernetes / Compose';
  description: string;
  content: string;
}
