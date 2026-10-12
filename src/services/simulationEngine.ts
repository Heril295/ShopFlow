import {
  ServiceNode,
  InfraNode,
  FaultScenario,
  SLODefinition,
  AlertItem,
  DistributedTrace,
  TraceSpan,
  LokiLog
} from '../types/shopflow';

export type LoadProfile = 'paused' | 'steady' | 'flash_sale' | 'black_friday';

export interface SimulationState {
  services: ServiceNode[];
  infra: InfraNode[];
  faults: FaultScenario[];
  slos: SLODefinition[];
  alerts: AlertItem[];
  traces: DistributedTrace[];
  logs: LokiLog[];
  loadProfile: LoadProfile;
  totalRequestsHandled: number;
  totalFailedRequests: number;
}

export function generateTraceId(): string {
  return 'tr-' + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
}

export function generateSpanId(): string {
  return 'sp-' + Math.random().toString(16).substring(2, 10);
}

export function executeSyntheticCheckout(
  state: SimulationState,
  sku: string = 'sku-101',
  itemPrice: number = 299.99
): { trace: DistributedTrace; success: boolean; errorReason?: string; logs: LokiLog[] } {
  const traceId = generateTraceId();
  const rootSpanId = generateSpanId();
  const orderId = 'ord-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();

  // Check active faults
  const paymentFault = state.faults.find(f => f.id === 'scenario-01' && f.isActive);
  const inventoryFault = state.faults.find(f => f.id === 'scenario-02' && f.isActive);
  const catalogFault = state.faults.find(f => f.id === 'scenario-03' && f.isActive);
  const pgPoolFault = state.faults.find(f => f.id === 'scenario-05' && f.isActive);
  const flakyPaymentFault = state.faults.find(f => f.id === 'scenario-06' && f.isActive);
  const netJitterFault = state.faults.find(f => f.id === 'scenario-07' && f.isActive);
  const splitBrainFault = state.faults.find(f => f.id === 'scenario-08' && f.isActive);
  const dnsFault = state.faults.find(f => f.id === 'scenario-10' && f.isActive);

  const spans: TraceSpan[] = [];
  const logs: LokiLog[] = [];

  let isSuccess = true;
  let errorReason = '';
  let currentOffset = 0;

  // Root Span: API Gateway HTTP POST /api/v1/orders
  let gatewayDuration = 110;
  if (netJitterFault) gatewayDuration += 380;
  if (dnsFault && Math.random() < 0.3) {
    isSuccess = false;
    errorReason = '503 Service Unavailable: DNS timeout resolving order-service';
  }

  // Inventory reservation span
  let invDuration = 45;
  let invStatus: 'ok' | 'error' = 'ok';
  if (inventoryFault) {
    invDuration = 1650;
    if (Math.random() < 0.4) {
      invStatus = 'error';
      isSuccess = false;
      errorReason = '409 Conflict: Row-level deadlock on SKU inventory lock';
    }
  }

  // Payment span
  let payDuration = 180;
  let payStatus: 'ok' | 'error' = 'ok';
  if (paymentFault) {
    payDuration = 2200;
    if (Math.random() < 0.7) {
      payStatus = 'error';
      isSuccess = false;
      errorReason = '504 Gateway Timeout: 3rd party payment gateway response > 2000ms';
    }
  } else if (flakyPaymentFault && Math.random() < 0.55) {
    payStatus = 'error';
    payDuration = 210;
    isSuccess = false;
    errorReason = '500 Internal Server Error: Banking upstream declined card authorization';
  }

  // DB pool span
  let dbDuration = 18;
  if (pgPoolFault) {
    dbDuration = 1400;
    if (Math.random() < 0.8) {
      isSuccess = false;
      errorReason = '500 DB Pool Exhausted: No available connections in pgx pool';
    }
  }

  const totalDuration = isSuccess
    ? gatewayDuration + invDuration + payDuration + dbDuration
    : Math.max(gatewayDuration + payDuration, 800);

  // 1. Root Gateway Span
  spans.push({
    spanId: rootSpanId,
    traceId,
    serviceName: 'api-gateway',
    operationName: 'POST /api/v1/orders',
    startTimeOffsetMs: 0,
    durationMs: totalDuration,
    status: isSuccess ? 'ok' : 'error',
    statusCode: isSuccess ? 201 : errorReason.startsWith('504') ? 504 : errorReason.startsWith('503') ? 503 : 500,
    tags: {
      'http.method': 'POST',
      'http.route': '/api/v1/orders',
      'http.status_code': isSuccess ? 201 : 500,
      'order.id': orderId,
      'user.id': 'usr_9410'
    }
  });

  logs.push({
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    timestamp: now,
    service: 'api-gateway',
    level: isSuccess ? 'INFO' : 'ERROR',
    message: isSuccess
      ? `Routing POST /api/v1/orders -> order-service [trace_id=${traceId}]`
      : `Failed dispatching to upstream: ${errorReason} [trace_id=${traceId}]`,
    traceId,
    spanId: rootSpanId
  });

  // 2. Order Service Saga Span
  const orderSpanId = generateSpanId();
  currentOffset += 20;
  spans.push({
    spanId: orderSpanId,
    traceId,
    parentSpanId: rootSpanId,
    serviceName: 'order-service',
    operationName: 'SagaCoordinator.CreateOrder',
    startTimeOffsetMs: currentOffset,
    durationMs: Math.max(totalDuration - 30, 60),
    status: isSuccess ? 'ok' : 'error',
    statusCode: isSuccess ? 200 : 500,
    tags: {
      'order.id': orderId,
      'order.total_usd': itemPrice,
      'saga.step': isSuccess ? 'completed' : 'aborted'
    }
  });

  // 3. Inventory Reservation Span
  const invSpanId = generateSpanId();
  currentOffset += 15;
  spans.push({
    spanId: invSpanId,
    traceId,
    parentSpanId: orderSpanId,
    serviceName: 'inventory-service',
    operationName: 'POST /reserve (SELECT FOR UPDATE)',
    startTimeOffsetMs: currentOffset,
    durationMs: invDuration,
    status: invStatus,
    statusCode: invStatus === 'ok' ? 200 : 409,
    tags: {
      'db.type': 'postgresql',
      'inventory.sku': sku,
      'lock.mode': 'ROW_EXCLUSIVE'
    }
  });

  if (invStatus === 'error') {
    logs.push({
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: now,
      service: 'inventory-service',
      level: 'ERROR',
      message: `Row lock contention on SKU ${sku}: transaction rollback aborted [trace_id=${traceId}]`,
      traceId,
      spanId: invSpanId
    });
  }

  // 4. Payment Charge Span
  if (invStatus === 'ok') {
    const paySpanId = generateSpanId();
    currentOffset += invDuration;
    spans.push({
      spanId: paySpanId,
      traceId,
      parentSpanId: orderSpanId,
      serviceName: 'payment-service',
      operationName: 'POST /charge (Acquirer Partner)',
      startTimeOffsetMs: currentOffset,
      durationMs: payDuration,
      status: payStatus,
      statusCode: payStatus === 'ok' ? 200 : payDuration > 2000 ? 504 : 500,
      tags: {
        'payment.gateway': 'StripeMock',
        'payment.amount': itemPrice,
        'payment.timeout_applied': paymentFault ? 'true' : 'false'
      }
    });

    if (payStatus === 'error') {
      logs.push({
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        service: 'payment-service',
        level: 'ERROR',
        message: `Payment gateway authorization failure: ${errorReason} [trace_id=${traceId}]`,
        traceId,
        spanId: paySpanId
      });
    }
  }

  // 5. DB Insert Outbox Span
  if (isSuccess) {
    const outboxSpanId = generateSpanId();
    currentOffset += payDuration;
    spans.push({
      spanId: outboxSpanId,
      traceId,
      parentSpanId: orderSpanId,
      serviceName: 'order-service',
      operationName: 'db.Exec(INSERT INTO outbox)',
      startTimeOffsetMs: currentOffset,
      durationMs: dbDuration,
      status: 'ok',
      statusCode: 200,
      tags: {
        'db.system': 'postgresql',
        'outbox.event': 'order.confirmed'
      }
    });

    // 6. RabbitMQ Async Notification Span
    if (!splitBrainFault) {
      const mqSpanId = generateSpanId();
      spans.push({
        spanId: mqSpanId,
        traceId,
        parentSpanId: outboxSpanId,
        serviceName: 'notification-worker',
        operationName: 'amqp:Consume(order.confirmed)',
        startTimeOffsetMs: currentOffset + 120,
        durationMs: 38,
        status: 'ok',
        statusCode: 200,
        tags: {
          'messaging.system': 'rabbitmq',
          'messaging.destination': 'order.notifications'
        }
      });
      logs.push({
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        service: 'notification-worker',
        level: 'INFO',
        message: `Dispatched order confirmation email for ${orderId} [trace_id=${traceId}]`,
        traceId,
        spanId: mqSpanId
      });
    }
  }

  const traceObj: DistributedTrace = {
    traceId,
    rootService: 'api-gateway',
    endpoint: 'POST /api/v1/orders',
    timestamp: now,
    totalDurationMs: Math.round(totalDuration),
    status: isSuccess ? 'ok' : 'error',
    httpStatus: isSuccess ? 201 : errorReason.startsWith('504') ? 504 : 500,
    userScenario: isSuccess ? 'Checkout - Standard Flow' : `Checkout - Failed (${errorReason})`,
    spans
  };

  return { trace: traceObj, success: isSuccess, errorReason, logs };
}

export function recalculateSystemState(prev: SimulationState): SimulationState {
  const activeFaults = prev.faults.filter(f => f.isActive);
  const faultCount = activeFaults.length;

  // Multipliers based on load profile
  let loadRpsBase = 42;
  if (prev.loadProfile === 'paused') loadRpsBase = 0;
  if (prev.loadProfile === 'steady') loadRpsBase = 45;
  if (prev.loadProfile === 'flash_sale') loadRpsBase = 145;
  if (prev.loadProfile === 'black_friday') loadRpsBase = 320;

  // Assess specific fault impacts
  const paymentFault = activeFaults.find(f => f.id === 'scenario-01');
  const inventoryFault = activeFaults.find(f => f.id === 'scenario-02');
  const catalogFault = activeFaults.find(f => f.id === 'scenario-03');
  const rabbitFault = activeFaults.find(f => f.id === 'scenario-04');
  const dbPoolFault = activeFaults.find(f => f.id === 'scenario-05');
  const flakyPayFault = activeFaults.find(f => f.id === 'scenario-06');
  const jitterFault = activeFaults.find(f => f.id === 'scenario-07');
  const outboxFault = activeFaults.find(f => f.id === 'scenario-08');
  const oomFault = activeFaults.find(f => f.id === 'scenario-09');
  const dnsFault = activeFaults.find(f => f.id === 'scenario-10');

  // Update Services
  const updatedServices = prev.services.map(svc => {
    let rps = loadRpsBase;
    let p95 = 90;
    let errorRate = 0.05;
    let status: ServiceNode['status'] = 'healthy';
    let cbState: ServiceNode['circuitBreakerState'] = 'closed';
    let cpu = 20;
    let mem = svc.memoryMb;
    let activeConn = svc.activeConnections || 10;

    if (svc.id === 'api-gateway') {
      rps = loadRpsBase;
      p95 = paymentFault ? 1850 : jitterFault ? 460 : dnsFault ? 1200 : 85;
      errorRate = paymentFault ? 42.0 : dnsFault ? 28.5 : jitterFault ? 14.2 : 0.05;
      cbState = paymentFault || dbPoolFault ? 'open' : jitterFault ? 'half-open' : 'closed';
      cpu = Math.min(88, 18 + loadRpsBase * 0.15 + (faultCount > 0 ? 30 : 0));
    } else if (svc.id === 'order-service') {
      rps = Math.max(0, Math.round(loadRpsBase * 0.9));
      p95 = paymentFault ? 2200 : dbPoolFault ? 3100 : 140;
      errorRate = dbPoolFault ? 82.0 : paymentFault ? 38.0 : flakyPayFault ? 45.0 : 0.08;
      activeConn = dbPoolFault ? 50 : paymentFault ? 46 : 14;
      cpu = dbPoolFault ? 92 : 24;
    } else if (svc.id === 'payment-service') {
      rps = Math.max(0, Math.round(loadRpsBase * 0.75));
      p95 = paymentFault ? 2400 : 190;
      errorRate = paymentFault ? 40.0 : flakyPayFault ? 55.0 : 0.12;
      cpu = paymentFault ? 78 : 15;
    } else if (svc.id === 'catalog-service') {
      rps = Math.round(loadRpsBase * 2.8);
      p95 = catalogFault ? 890 : oomFault ? 1150 : 25;
      errorRate = catalogFault ? 14.5 : oomFault ? 35.0 : 0.02;
      mem = oomFault ? 495 : 115;
      cpu = catalogFault ? 84 : 22;
    } else if (svc.id === 'inventory-service') {
      rps = loadRpsBase;
      p95 = inventoryFault ? 1750 : 65;
      errorRate = inventoryFault ? 32.0 : 0.04;
      activeConn = inventoryFault ? 39 : 18;
      cpu = inventoryFault ? 86 : 28;
    } else if (svc.id === 'notification-worker') {
      rps = rabbitFault ? 2 : Math.round(loadRpsBase * 0.8);
      p95 = rabbitFault ? 3800 : 45;
      errorRate = rabbitFault ? 25.0 : 0.0;
    }

    if (errorRate > 25 || p95 > 1500) status = 'failing';
    else if (errorRate > 5 || p95 > 400 || cbState === 'half-open') status = 'degraded';

    return {
      ...svc,
      rps: prev.loadProfile === 'paused' ? 0 : rps,
      p95LatencyMs: p95,
      errorRatePercent: parseFloat(errorRate.toFixed(2)),
      circuitBreakerState: cbState,
      cpuPercent: Math.round(cpu),
      memoryMb: mem,
      activeConnections: activeConn,
      status
    };
  });

  // Update Infra
  const updatedInfra = prev.infra.map(node => {
    let status: InfraNode['status'] = 'healthy';
    const metrics = { ...node.metrics };

    if (node.id === 'postgres') {
      const active = dbPoolFault ? '50 / 50 (SATURATED)' : inventoryFault ? '42 / 50' : '28 / 50';
      metrics['Active Connections'] = active;
      metrics['Deadlocks / hr'] = inventoryFault ? '14' : '0';
      metrics['Transaction Latency'] = inventoryFault ? '1,840ms' : dbPoolFault ? '2,900ms' : '3.2ms';
      if (dbPoolFault || inventoryFault) status = 'failing';
    } else if (node.id === 'redis') {
      metrics['Hit Ratio'] = catalogFault ? '4.8%' : '96.2%';
      metrics['Memory Used'] = catalogFault ? '18 MB' : '142 MB';
      if (catalogFault) status = 'degraded';
    } else if (node.id === 'rabbitmq') {
      metrics['Queue Depth'] = rabbitFault ? '18,420 msgs' : '14 msgs';
      metrics['Publish Rate'] = outboxFault ? '0 msg/s' : `${loadRpsBase} msg/s`;
      if (rabbitFault) status = 'failing';
    }

    return { ...node, status, metrics };
  });

  // Update Pyrra SLOs
  const updatedSLOs = prev.slos.map(slo => {
    let currentAvail = slo.currentAvailability;
    let budgetRemaining = slo.errorBudgetRemainingPercent;
    let burn1h = 0.4;
    let burn6h = 0.5;
    let burn24h = 0.6;
    let status: SLODefinition['status'] = 'compliant';

    if (slo.id === 'slo-gateway-availability') {
      if (paymentFault || dbPoolFault || dnsFault) {
        burn1h = 16.8; // > 14.4x Critical Burn!
        burn6h = 8.4;  // > 6.0x Critical Burn!
        burn24h = 4.2;
        budgetRemaining = Math.max(0, budgetRemaining - 0.28);
        currentAvail = Math.max(97.2, currentAvail - 0.05);
        status = 'burning';
      } else if (flakyPayFault || jitterFault) {
        burn1h = 4.2;
        burn6h = 3.8;
        budgetRemaining = Math.max(0, budgetRemaining - 0.08);
        status = 'warning';
      }
    } else if (slo.id === 'slo-checkout-latency') {
      if (paymentFault || inventoryFault || dbPoolFault) {
        burn1h = 18.2;
        burn6h = 9.1;
        budgetRemaining = Math.max(0, budgetRemaining - 0.35);
        currentAvail = Math.max(78.5, currentAvail - 0.2);
        status = 'burning';
      }
    } else if (slo.id === 'slo-catalog-availability') {
      if (catalogFault || oomFault) {
        burn1h = 15.1;
        burn6h = 7.0;
        budgetRemaining = Math.max(0, budgetRemaining - 0.22);
        status = 'burning';
      }
    } else if (slo.id === 'slo-inventory-reservation') {
      if (inventoryFault) {
        burn1h = 21.0;
        burn6h = 10.5;
        budgetRemaining = Math.max(0, budgetRemaining - 0.4);
        status = 'burning';
      }
    }

    if (budgetRemaining <= 0) status = 'breached';

    return {
      ...slo,
      currentAvailability: parseFloat(currentAvail.toFixed(2)),
      errorBudgetRemainingPercent: parseFloat(budgetRemaining.toFixed(1)),
      burnRate1h: parseFloat(burn1h.toFixed(1)),
      burnRate6h: parseFloat(burn6h.toFixed(1)),
      burnRate24h: parseFloat(burn24h.toFixed(1)),
      status
    };
  });

  // Calculate Alerts
  const currentAlerts: AlertItem[] = [...prev.alerts.filter(a => a.status === 'resolved')];

  if (paymentFault) {
    currentAlerts.unshift({
      id: 'alert-burn-14x',
      alertname: 'CheckoutAvailabilityBurnRate14.4x',
      service: 'api-gateway',
      severity: 'critical',
      status: 'firing',
      startsAt: 'Just now',
      summary: 'High error budget burn rate (14.4x) on API Gateway in 1h window',
      description: 'Error budget consumed at >14.4x rate. At this rate, 30-day budget will exhaust in under 50 hours.',
      runbookUrl: 'https://wiki.shopflow.internal/runbooks/checkout-availability-burn',
      labels: { service: 'api-gateway', severity: 'critical', tier: 'SEV-1', slo: 'gateway-availability' },
      mitigationAvailable: true,
      mitigationActionName: 'Enable Payment Fail-Open Async Fallback'
    });
    currentAlerts.unshift({
      id: 'alert-circuit-breaker',
      alertname: 'CircuitBreakerOpen',
      service: 'api-gateway',
      severity: 'warning',
      status: 'firing',
      startsAt: 'Just now',
      summary: 'Sonygobreaker for order-service tripped OPEN',
      description: 'More than 50% of requests failed or timed out in 10s sliding window.',
      runbookUrl: 'https://wiki.shopflow.internal/runbooks/circuit-breaker',
      labels: { service: 'api-gateway', severity: 'warning' },
      mitigationAvailable: false
    });
  }

  if (inventoryFault) {
    currentAlerts.unshift({
      id: 'alert-inv-deadlock',
      alertname: 'InventoryRowLockContention',
      service: 'inventory-service',
      severity: 'critical',
      status: 'firing',
      startsAt: 'Just now',
      summary: 'Postgres row-level lock wait latency exceeds 1500ms',
      description: 'Concurrent checkout threads colliding on hot item SKUs during stock reservation.',
      runbookUrl: 'https://wiki.shopflow.internal/runbooks/inventory-deadlocks',
      labels: { service: 'inventory-service', severity: 'critical' },
      mitigationAvailable: true,
      mitigationActionName: 'Enable Redis Optimistic Stock Leasing'
    });
  }

  if (rabbitFault) {
    currentAlerts.unshift({
      id: 'alert-queue-lag',
      alertname: 'RabbitMQHighQueueLag',
      service: 'notification-worker',
      severity: 'warning',
      status: 'firing',
      startsAt: 'Just now',
      summary: 'Unacknowledged queue depth in order.notifications > 15,000 messages',
      description: 'Notification worker consumer stopped processing acks. Event backlog accumulating rapidly.',
      runbookUrl: 'https://wiki.shopflow.internal/runbooks/rabbitmq-lag',
      labels: { service: 'notification-worker', severity: 'warning' },
      mitigationAvailable: true,
      mitigationActionName: 'Scale Worker Deployment to 8 Replicas'
    });
  }

  if (dbPoolFault) {
    currentAlerts.unshift({
      id: 'alert-db-pool',
      alertname: 'PostgresConnectionPoolExhausted',
      service: 'order-service',
      severity: 'critical',
      status: 'firing',
      startsAt: 'Just now',
      summary: 'Order service pgx pool reached 50/50 max capacity',
      description: 'Zero idle connections available. New checkout requests timing out after 30 seconds.',
      runbookUrl: 'https://wiki.shopflow.internal/runbooks/db-pool-exhaustion',
      labels: { service: 'order-service', severity: 'critical' },
      mitigationAvailable: true,
      mitigationActionName: 'Trigger Rolling Pod Restart & Set 2s Timeout'
    });
  }

  return {
    ...prev,
    services: updatedServices,
    infra: updatedInfra,
    slos: updatedSLOs,
    alerts: currentAlerts
  };
}
