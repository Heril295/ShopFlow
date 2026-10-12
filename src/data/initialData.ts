import {
  ServiceNode,
  InfraNode,
  FaultScenario,
  SLODefinition,
  AlertItem,
  Postmortem
} from '../types/shopflow';

export const INITIAL_SERVICES: ServiceNode[] = [
  {
    id: 'api-gateway',
    name: 'api-gateway',
    language: 'Go',
    role: 'API Entrypoint & Circuit Breaker',
    port: 8080,
    adminPort: 9000,
    status: 'healthy',
    rps: 42,
    p95LatencyMs: 85,
    errorRatePercent: 0.05,
    circuitBreakerState: 'closed',
    cpuPercent: 18,
    memoryMb: 64,
    version: 'v1.4.2',
    description: 'Reverse proxy, JWT verification, rate limiting, and circuit breaker orchestrator built on chi and Sonygobreaker.',
    technologies: ['Go 1.22', 'chi', 'Sonygobreaker', 'promhttp', 'OTel SDK']
  },
  {
    id: 'order-service',
    name: 'order-service',
    language: 'Go',
    role: 'Saga Coordinator & Outbox Writer',
    port: 8081,
    adminPort: 9001,
    status: 'healthy',
    rps: 38,
    p95LatencyMs: 140,
    errorRatePercent: 0.08,
    circuitBreakerState: 'closed',
    activeConnections: 12,
    maxConnections: 50,
    cpuPercent: 24,
    memoryMb: 92,
    version: 'v2.1.0',
    description: 'Handles order creation, transactional outbox pattern with PostgreSQL, orchestrates inventory reservation and payment authorization.',
    technologies: ['Go 1.22', 'pgx/v5', 'amqp091-go', 'OTel Tracer', 'Prometheus']
  },
  {
    id: 'payment-service',
    name: 'payment-service',
    language: 'Go',
    role: 'Payment Gateway Integration',
    port: 8082,
    adminPort: 9002,
    status: 'healthy',
    rps: 32,
    p95LatencyMs: 190,
    errorRatePercent: 0.12,
    circuitBreakerState: 'closed',
    cpuPercent: 15,
    memoryMb: 58,
    version: 'v1.1.8',
    description: 'Mock gateway to 3rd-party banking APIs with built-in chaos injection, idempotency keys, and jitter support.',
    technologies: ['Go 1.22', 'chi', 'crypto/tls', 'OTel HTTP Client']
  },
  {
    id: 'catalog-service',
    name: 'catalog-service',
    language: 'Python',
    role: 'Product Catalog & Cache',
    port: 8083,
    adminPort: 9003,
    status: 'healthy',
    rps: 120,
    p95LatencyMs: 25,
    errorRatePercent: 0.02,
    circuitBreakerState: 'closed',
    cpuPercent: 22,
    memoryMb: 115,
    version: 'v1.8.0',
    description: 'Product catalog search and details powered by FastAPI, asynchronous Redis caching, and PostgreSQL backend.',
    technologies: ['Python 3.12', 'FastAPI', 'aioredis', 'SQLAlchemy 2.0 async']
  },
  {
    id: 'inventory-service',
    name: 'inventory-service',
    language: 'Python',
    role: 'Stock Reservation & Row Locking',
    port: 8084,
    adminPort: 9004,
    status: 'healthy',
    rps: 45,
    p95LatencyMs: 65,
    errorRatePercent: 0.04,
    circuitBreakerState: 'closed',
    activeConnections: 18,
    maxConnections: 40,
    cpuPercent: 28,
    memoryMb: 128,
    version: 'v2.0.3',
    description: 'Inventory reservations using strict PostgreSQL row-level locks (SELECT FOR UPDATE) to prevent race conditions during flash sales.',
    technologies: ['Python 3.12', 'FastAPI', 'asyncpg', 'SQLAlchemy']
  },
  {
    id: 'notification-worker',
    name: 'notification-worker',
    language: 'Python',
    role: 'Async RabbitMQ Consumer',
    port: 8085,
    adminPort: 9005,
    status: 'healthy',
    rps: 30,
    p95LatencyMs: 45,
    errorRatePercent: 0.0,
    circuitBreakerState: 'closed',
    cpuPercent: 12,
    memoryMb: 76,
    version: 'v1.3.1',
    description: 'Event worker pulling order.confirmed events from RabbitMQ and simulating transactional customer SMS/email dispatch.',
    technologies: ['Python 3.12', 'aio-pika', 'asyncio', 'OTel OTLP Exporter']
  },
  {
    id: 'alert-sink',
    name: 'alert-sink',
    language: 'Go',
    role: 'Alertmanager Webhook Receiver',
    port: 9099,
    adminPort: 9009,
    status: 'healthy',
    rps: 5,
    p95LatencyMs: 8,
    errorRatePercent: 0.0,
    circuitBreakerState: 'closed',
    cpuPercent: 4,
    memoryMb: 32,
    version: 'v1.0.0',
    description: 'Webhook listener receiving firing alerts from Prometheus Alertmanager, correlating them with live traces, and logging mitigation triggers.',
    technologies: ['Go 1.22', 'net/http', 'Structured JSON logger']
  }
];

export const INITIAL_INFRA: InfraNode[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL 16',
    type: 'postgres',
    status: 'healthy',
    details: 'Logical DBs: order_db, catalog_db, inventory_db, outbox_db',
    metrics: {
      'Active Connections': '30 / 100',
      'Buffer Cache Hit': '99.4%',
      'Deadlocks / hr': '0',
      'Transaction Latency': '3.2ms'
    }
  },
  {
    id: 'redis',
    name: 'Redis 7.2 Cache',
    type: 'redis',
    status: 'healthy',
    details: 'Catalog & session cache with 15m TTL',
    metrics: {
      'Hit Ratio': '96.2%',
      'Memory Used': '142 MB',
      'Connected Clients': '48',
      'Ops / sec': '1,420'
    }
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ 3.13 Cluster',
    type: 'rabbitmq',
    status: 'healthy',
    details: 'Exchanges: order.events, Queues: order.notifications, order.dlq',
    metrics: {
      'Queue Depth': '14 msgs',
      'Consumer Count': '4',
      'Publish Rate': '38 msg/s',
      'Deliver Rate': '38 msg/s'
    }
  },
  {
    id: 'collector',
    name: 'OpenTelemetry Collector v0.98',
    type: 'collector',
    status: 'healthy',
    details: 'Routing traces -> Tempo, metrics -> Prometheus, logs -> Loki',
    metrics: {
      'Spans Ingested': '4,850 /s',
      'Batch Size': '256',
      'Tail Sample Drops': '12.4%',
      'Memory Limit': '512 MB'
    }
  }
];

export const FAULT_SCENARIOS: FaultScenario[] = [
  {
    id: 'scenario-01',
    scenarioNumber: 1,
    name: 'Payment Latency Cascade',
    targetServiceId: 'payment-service',
    category: 'Latency',
    description: 'Simulates a slow 3rd party payment processor. Causes cascading latency across order-service and gateway timeouts.',
    expectedSymptoms: [
      'Order service thread pool starvation',
      'API gateway circuit breaker for order-service trips open',
      'Rapid burn of 1h and 6h Checkout Availability SLO',
      'Spike in HTTP 504 Gateway Timeout'
    ],
    recommendedMitigation: 'Activate "Payment Fail-Open Mode" or switch gateway route to secondary payment provider fallback.',
    defaultConfig: { latencyMs: 2200, errorRate: 0.1, timeout: true },
    currentConfig: { latencyMs: 2200, errorRate: 0.1, timeout: true },
    isActive: false
  },
  {
    id: 'scenario-02',
    scenarioNumber: 2,
    name: 'Inventory Lock Contention (Hot SKU Deadlock)',
    targetServiceId: 'inventory-service',
    category: 'Concurrency',
    description: 'High concurrency checkout on hot SKU items causes PostgreSQL "SELECT ... FOR UPDATE" lock waits and transaction timeouts.',
    expectedSymptoms: [
      'Inventory service p95 latency jumps from 65ms to 1800ms',
      'Postgres transaction queue spikes to 40+ waiting queries',
      'Inventory mutation availability drops below 98%',
      'Order checkouts abort with 500 LockNotAvailable'
    ],
    recommendedMitigation: 'Enable Redis-based optimistic inventory leasing or throttle concurrent reservation queue.',
    defaultConfig: { latencyMs: 1600, errorRate: 0.35, timeout: false },
    currentConfig: { latencyMs: 1600, errorRate: 0.35, timeout: false },
    isActive: false
  },
  {
    id: 'scenario-03',
    scenarioNumber: 3,
    name: 'Redis Cache Stampede & Eviction Spike',
    targetServiceId: 'catalog-service',
    category: 'Resource Exhaustion',
    description: 'Flushes Redis cache keys simultaneously, forcing high-throughput catalog reads to hammer PostgreSQL directly.',
    expectedSymptoms: [
      'Redis hit ratio collapses from 96% to 4%',
      'Catalog Postgres query pool hits 100% capacity',
      'Catalog read latency spikes to 950ms',
      'Catalog SLA alert triggers on high latency'
    ],
    recommendedMitigation: 'Warm cache using background seed job and enable mutex locking for cache-aside refill.',
    defaultConfig: { latencyMs: 850, errorRate: 0.15, timeout: false },
    currentConfig: { latencyMs: 850, errorRate: 0.15, timeout: false },
    isActive: false
  },
  {
    id: 'scenario-04',
    scenarioNumber: 4,
    name: 'RabbitMQ Backpressure & Worker Stoppage',
    targetServiceId: 'notification-worker',
    category: 'Queue Lag',
    description: 'Pauses consumer acks in notification-worker, causing unacked message pileup and unbounded queue backlog.',
    expectedSymptoms: [
      'RabbitMQ queue depth balloons to >15,000 unacknowledged messages',
      'Memory watermark alarm triggers on RabbitMQ cluster',
      'Notification Delivery SLO breach (>2s delay)',
      'HighQueueLag alert fires in Alertmanager'
    ],
    recommendedMitigation: 'Scale notification-worker deployment from 1 to 8 replicas and reset prefetch count to 50.',
    defaultConfig: { latencyMs: 3500, errorRate: 0.0, timeout: false, queueLag: 18500 },
    currentConfig: { latencyMs: 3500, errorRate: 0.0, timeout: false, queueLag: 18500 },
    isActive: false
  },
  {
    id: 'scenario-05',
    scenarioNumber: 5,
    name: 'PostgreSQL Connection Pool Starvation',
    targetServiceId: 'order-service',
    category: 'Resource Exhaustion',
    description: 'Simulates unclosed pgx database connections in order-service. Max pool limit (50) is reached rapidly.',
    expectedSymptoms: [
      'pgx: connection pool exhausted (no idle connections)',
      'New checkout HTTP requests block until 30s timeout',
      'Order service error rate jumps to 85%',
      '14.4x multi-burn rate alert triggered on Pyrra'
    ],
    recommendedMitigation: 'Perform rolling restart of order-service pod and dynamically patch pgx connection timeout to 2s.',
    defaultConfig: { latencyMs: 3000, errorRate: 0.85, timeout: true, dbPoolLimit: 50 },
    currentConfig: { latencyMs: 3000, errorRate: 0.85, timeout: true, dbPoolLimit: 50 },
    isActive: false
  },
  {
    id: 'scenario-06',
    scenarioNumber: 6,
    name: 'Third-Party Payment Flaky 500 Surge',
    targetServiceId: 'payment-service',
    category: 'Error',
    description: 'Injects intermittent HTTP 500 errors into payment gateway authorization at a 55% error rate.',
    expectedSymptoms: [
      '55% of order authorization attempts fail',
      'Checkout Error Budget consumed rapidly',
      'Orders revert to CANCELLED_PAYMENT_FAILED in saga',
      'SEV-1 checkout failure notification triggered'
    ],
    recommendedMitigation: 'Switch to secondary backup processor Stripe/Adyen and enable exponential retry backoff.',
    defaultConfig: { latencyMs: 250, errorRate: 0.55, timeout: false },
    currentConfig: { latencyMs: 250, errorRate: 0.55, timeout: false },
    isActive: false
  },
  {
    id: 'scenario-07',
    scenarioNumber: 7,
    name: 'Network Packet Loss & Latency Jitter',
    targetServiceId: 'api-gateway',
    category: 'Network',
    description: 'Simulates 25% packet drop and 400ms random jitter on the internal mesh between api-gateway and order-service.',
    expectedSymptoms: [
      'Intermittent connection reset by peer errors',
      'Elevated p99 gateway latency with wide variance',
      'Client-side request retries causing duplicate spikes',
      'P95 latency SLO burn rate exceeds 6x threshold'
    ],
    recommendedMitigation: 'Enable TCP keep-alive with gRPC connection pooling and Envoy retry budget.',
    defaultConfig: { latencyMs: 450, errorRate: 0.25, timeout: false, dropRate: 0.25 },
    currentConfig: { latencyMs: 450, errorRate: 0.25, timeout: false, dropRate: 0.25 },
    isActive: false
  },
  {
    id: 'scenario-08',
    scenarioNumber: 8,
    name: 'Outbox Publisher Crash (Split Brain)',
    targetServiceId: 'order-service',
    category: 'Outbox',
    description: 'Order transactions commit to order_db and outbox table, but the background event publisher goroutine crashes.',
    expectedSymptoms: [
      'Orders show confirmed in DB but no RabbitMQ events published',
      'Notification worker receives 0 messages',
      'Outbox lag metric increases linearly',
      'Saga distributed reconciliation fails'
    ],
    recommendedMitigation: 'Restart Outbox publisher background worker and force replay of pending outbox table rows.',
    defaultConfig: { latencyMs: 120, errorRate: 0.05, timeout: false },
    currentConfig: { latencyMs: 120, errorRate: 0.05, timeout: false },
    isActive: false
  },
  {
    id: 'scenario-09',
    scenarioNumber: 9,
    name: 'Catalog Service Memory Leak (OOM Thrash)',
    targetServiceId: 'catalog-service',
    category: 'Resource Exhaustion',
    description: 'Unbounded in-memory search history cache causes catalog-service to hit cgroup memory limits (512MB) and enter crash-restart loops.',
    expectedSymptoms: [
      'Kubernetes OOMKilled events on catalog pods',
      'Intermittent 502 Bad Gateway during pod restart gap',
      'Pod restart count increments every 90 seconds',
      'PodCrashLooping alert in Alertmanager'
    ],
    recommendedMitigation: 'Increase cgroup memory limits to 1Gi and trigger LRU cache evictions.',
    defaultConfig: { latencyMs: 1200, errorRate: 0.4, timeout: false },
    currentConfig: { latencyMs: 1200, errorRate: 0.4, timeout: false },
    isActive: false
  },
  {
    id: 'scenario-10',
    scenarioNumber: 10,
    name: 'CoreDNS Resolution Flapping & Service Partition',
    targetServiceId: 'api-gateway',
    category: 'Network',
    description: 'Simulates intermittent CoreDNS resolution timeouts inside the Kubernetes cluster when resolving internal services.',
    expectedSymptoms: [
      'dial tcp: lookup order-service.default.svc: i/o timeout',
      'Bursts of 503 Service Unavailable',
      'Transient loss of downstream service discovery',
      'Gateway error rate hits 30% for 30-second windows'
    ],
    recommendedMitigation: 'Deploy NodeLocal DNSCache daemonset and configure gateway upstream IP caching.',
    defaultConfig: { latencyMs: 1500, errorRate: 0.3, timeout: true },
    currentConfig: { latencyMs: 1500, errorRate: 0.3, timeout: true },
    isActive: false
  }
];

export const INITIAL_SLOS: SLODefinition[] = [
  {
    id: 'slo-gateway-availability',
    name: 'API Gateway Availability',
    serviceId: 'api-gateway',
    targetPercent: 99.9,
    windowDays: 30,
    currentAvailability: 99.94,
    errorBudgetRemainingPercent: 88.2,
    errorBudgetTotalMinutes: 43.2,
    errorBudgetConsumedMinutes: 5.1,
    burnRate1h: 0.4,
    burnRate6h: 0.5,
    burnRate24h: 0.6,
    status: 'compliant',
    sliDescription: 'Ratio of non-5xx responses over total HTTP requests to api-gateway',
    pyrraManifestSnippet: `apiVersion: pyrra.dev/v1alpha1
kind: ServiceLevelObjective
metadata:
  name: gateway-availability
  namespace: shopflow
  labels:
    service: api-gateway
spec:
  target: "99.9"
  window: 30d
  indicator:
    ratio:
      errors:
        metric: http_requests_total{service="api-gateway", status_code=~"5.."}[1m]
      total:
        metric: http_requests_total{service="api-gateway"}[1m]`,
    alertThresholds: {
      critical1h: 14.4,
      critical6h: 6.0,
      warning24h: 3.0
    }
  },
  {
    id: 'slo-checkout-latency',
    name: 'Checkout Flow P95 Latency',
    serviceId: 'order-service',
    targetPercent: 95.0,
    windowDays: 30,
    currentAvailability: 96.8,
    errorBudgetRemainingPercent: 74.0,
    errorBudgetTotalMinutes: 2160,
    errorBudgetConsumedMinutes: 561,
    burnRate1h: 0.7,
    burnRate6h: 0.9,
    burnRate24h: 0.8,
    status: 'compliant',
    sliDescription: 'Percentage of POST /orders requests completed within 400ms threshold',
    pyrraManifestSnippet: `apiVersion: pyrra.dev/v1alpha1
kind: ServiceLevelObjective
metadata:
  name: checkout-latency
  namespace: shopflow
  labels:
    service: order-service
spec:
  target: "95.0"
  window: 30d
  indicator:
    latency:
      success:
        metric: http_request_duration_seconds_bucket{service="order-service", handler="/orders", le="0.4"}[1m]
      total:
        metric: http_request_duration_seconds_count{service="order-service", handler="/orders"}[1m]`,
    alertThresholds: {
      critical1h: 14.4,
      critical6h: 6.0,
      warning24h: 3.0
    }
  },
  {
    id: 'slo-catalog-availability',
    name: 'Catalog Read Availability',
    serviceId: 'catalog-service',
    targetPercent: 99.95,
    windowDays: 30,
    currentAvailability: 99.98,
    errorBudgetRemainingPercent: 94.5,
    errorBudgetTotalMinutes: 21.6,
    errorBudgetConsumedMinutes: 1.2,
    burnRate1h: 0.2,
    burnRate6h: 0.3,
    burnRate24h: 0.4,
    status: 'compliant',
    sliDescription: 'Ratio of 200 OK responses for GET /products queries over total requests',
    pyrraManifestSnippet: `apiVersion: pyrra.dev/v1alpha1
kind: ServiceLevelObjective
metadata:
  name: catalog-availability
  namespace: shopflow
  labels:
    service: catalog-service
spec:
  target: "99.95"
  window: 30d
  indicator:
    ratio:
      errors:
        metric: http_requests_total{service="catalog-service", status_code=~"5.."}[1m]
      total:
        metric: http_requests_total{service="catalog-service"}[1m]`,
    alertThresholds: {
      critical1h: 14.4,
      critical6h: 6.0,
      warning24h: 3.0
    }
  },
  {
    id: 'slo-inventory-reservation',
    name: 'Inventory Mutation Success Rate',
    serviceId: 'inventory-service',
    targetPercent: 99.9,
    windowDays: 30,
    currentAvailability: 99.92,
    errorBudgetRemainingPercent: 82.0,
    errorBudgetTotalMinutes: 43.2,
    errorBudgetConsumedMinutes: 7.7,
    burnRate1h: 0.5,
    burnRate6h: 0.6,
    burnRate24h: 0.6,
    status: 'compliant',
    sliDescription: 'Ratio of successful atomic stock reservations vs deadlock/timeout aborts',
    pyrraManifestSnippet: `apiVersion: pyrra.dev/v1alpha1
kind: ServiceLevelObjective
metadata:
  name: inventory-reservation-sla
  namespace: shopflow
  labels:
    service: inventory-service
spec:
  target: "99.9"
  window: 30d
  indicator:
    ratio:
      errors:
        metric: inventory_reservations_total{status="failed"}[1m]
      total:
        metric: inventory_reservations_total[1m]`,
    alertThresholds: {
      critical1h: 14.4,
      critical6h: 6.0,
      warning24h: 3.0
    }
  }
];

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'alert-01',
    alertname: 'PaymentDownstreamJitterNormal',
    service: 'payment-service',
    severity: 'info',
    status: 'resolved',
    startsAt: '12 mins ago',
    summary: 'Payment service p95 latency returned to baseline (<200ms)',
    description: 'Third-party sandbox acknowledged heartbeat response within SLA parameters.',
    runbookUrl: 'https://wiki.shopflow.internal/runbooks/payment-latency',
    labels: { service: 'payment-service', severity: 'info', environment: 'production' },
    mitigationAvailable: false
  }
];

export const INITIAL_POSTMORTEMS: Postmortem[] = [
  {
    id: 'postmortem-001',
    title: 'SEV-1: Cascading Checkout Outage Due to Third-Party Payment Latency',
    incidentNumber: 'INC-2026-1042',
    date: '2026-10-10',
    severity: 'SEV-1',
    author: 'Principal SRE - Reliability Team',
    status: 'Published',
    executiveSummary: 'Between 14:02 UTC and 14:28 UTC, ShopFlow suffered a 26-minute degradation of the checkout flow. A downstream payment acquirer experienced a 2.5-second latency spike. Because the API Gateway lacked an aggressive timeout and the circuit breaker was improperly tuned, connection pools in order-service backed up, leading to 504 Gateway Timeouts and burning 48% of the 30-day Checkout Availability error budget.',
    impactMetrics: {
      durationMinutes: 26,
      failedRequests: 14320,
      revenueImpactUsd: 87500,
      sloBudgetConsumedPercent: 48.2
    },
    timeline: [
      { time: '14:02 UTC', event: 'Payment partner AcquirerX starts experiencing 2200ms response times.', author: 'Automated Monitor' },
      { time: '14:05 UTC', event: 'Order service pgx pool reaches 50/50 saturation. Queued threads hit 30s timeout.', author: 'Prometheus Alert' },
      { time: '14:07 UTC', event: 'Pyrra fires CheckoutAvailabilityBurnRate14.4x page to Primary On-Call.', author: 'Alertmanager' },
      { time: '14:12 UTC', event: 'On-call engineer joins incident bridge, diagnoses payment-service thread lock.', author: 'On-Call Engineer' },
      { time: '14:18 UTC', event: 'On-call triggers "Fail-Open Async Payment" feature flag via Admin API.', author: 'On-Call Engineer' },
      { time: '14:24 UTC', event: 'Orders resume flowing asynchronously into PENDING state via Outbox pattern.', author: 'Order Service' },
      { time: '14:28 UTC', event: 'SLO burn rate drops to 0.4x. Incident resolved.', author: 'Incident Commander' }
    ],
    rootCause: 'Lack of hard timeout on synchronous payment HTTP call inside order-service checkout handler held database transaction locks open, starving the connection pool.',
    fiveWhys: [
      'Why did checkout fail? Order service timed out on new incoming connections.',
      'Why did it time out? All 50 pgx database pool connections were held open waiting for payment responses.',
      'Why were they waiting? The HTTP client call to payment-service had an unconfigured 60-second default timeout.',
      'Why was payment slow? Downstream 3rd-party banking provider had degraded upstream database replication.',
      'Why did the circuit breaker not trip earlier? The error threshold was configured to 50% errors, but latency alone did not count as an immediate circuit breaker failure.'
    ],
    preventativeActions: [
      { id: 'pa-1', action: 'Set strict 800ms context timeout on all payment RPC calls in order-service', owner: 'Checkout Team', status: 'Done' },
      { id: 'pa-2', action: 'Tune Sonygobreaker circuit breaker to trip on consecutive latency spikes > 1500ms', owner: 'Gateway Team', status: 'Done' },
      { id: 'pa-3', action: 'Deploy secondary payment failover fallback provider (Stripe + Adyen)', owner: 'FinTech Team', status: 'In Progress' },
      { id: 'pa-4', action: 'Add automated k6 chaos pipeline test in CI for 3000ms payment delays', owner: 'SRE Team', status: 'Done' }
    ]
  }
];
