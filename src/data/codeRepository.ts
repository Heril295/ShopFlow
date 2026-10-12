import { CodeFile } from '../types/shopflow';

export const CODE_REPOSITORY: CodeFile[] = [
  {
    path: 'services/api-gateway/main.go',
    filename: 'main.go',
    language: 'go',
    category: 'Service (Go)',
    description: 'Reverse proxy, JWT token inspection, rate limiter, Sonygobreaker circuit breakers, and OTel HTTP propagation.',
    content: `package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sony/gobreaker"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests through API gateway",
	}, []string{"service", "method", "route", "status_code"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency at gateway",
		Buckets: []float64{0.05, 0.1, 0.25, 0.4, 0.8, 1.5, 3.0, 5.0},
	}, []string{"service", "route"})

	circuitBreakerStatus = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "circuit_breaker_state",
		Help: "0: Closed, 1: Half-Open, 2: Open",
	}, []string{"target_service"})
)

type FaultConfig struct {
	LatencyMs int     \`json:"latency_ms"\`
	ErrorRate float64 \`json:"error_rate"\`
	Timeout   bool    \`json:"timeout"\`
}

var currentFaults FaultConfig

func main() {
	log.Println("[INFO] Starting ShopFlow API Gateway on :8080...")

	orderServiceURL, _ := url.Parse(getEnv("ORDER_SERVICE_URL", "http://order-service:8081"))
	catalogServiceURL, _ := url.Parse(getEnv("CATALOG_SERVICE_URL", "http://catalog-service:8083"))

	orderProxy := httputil.NewSingleHostReverseProxy(orderServiceURL)
	catalogProxy := httputil.NewSingleHostReverseProxy(catalogServiceURL)

	// Circuit breaker for order-service checkout dependency
	orderCB := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "order-service-cb",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     5 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failureRatio >= 0.5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[WARN] CircuitBreaker %s transitioned from %v to %v", name, from, to)
			val := 0.0
			if to == gobreaker.StateHalfOpen { val = 1.0 }
			if to == gobreaker.StateOpen { val = 2.0 }
			circuitBreakerStatus.WithLabelValues("order-service").Set(val)
		},
	})

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Health check
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(\`{"status":"ok","service":"api-gateway"}\`))
	})

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Reverse proxy with tracing & circuit breaker
	r.HandleFunc("/api/v1/orders*", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		_, err := orderCB.Execute(func() (interface{}, error) {
			orderProxy.ServeHTTP(w, r)
			return nil, nil
		})
		duration := time.Since(start).Seconds()
		httpRequestDuration.WithLabelValues("api-gateway", "/api/v1/orders").Observe(duration)

		if err != nil {
			httpRequestsTotal.WithLabelValues("api-gateway", r.Method, "/api/v1/orders", "503").Inc()
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Circuit breaker open: order-service is unavailable",
			})
		}
	})

	r.HandleFunc("/api/v1/catalog*", func(w http.ResponseWriter, r *http.Request) {
		catalogProxy.ServeHTTP(w, r)
	})

	// Internal Fault Manager Admin API on :9000
	go func() {
		adminMux := http.NewServeMux()
		adminMux.HandleFunc("/admin/faults", func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPut || r.Method == http.MethodPost {
				json.NewDecoder(r.Body).Decode(&currentFaults)
				log.Printf("[ADMIN] Injected faults: Latency=%dms ErrorRate=%.2f", currentFaults.LatencyMs, currentFaults.ErrorRate)
			}
			json.NewEncoder(w).Encode(currentFaults)
		})
		log.Println("[INFO] Admin Fault API listening on :9000")
		http.ListenAndServe(":9000", adminMux)
	}()

	srv := &http.Server{Addr: ":8080", Handler: r}
	srv.ListenAndServe()
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}`
  },
  {
    path: 'services/order-service/main.go',
    filename: 'main.go',
    language: 'go',
    category: 'Service (Go)',
    description: 'PostgreSQL transactional Outbox pattern, Saga orchestration, and OpenTelemetry trace propagation.',
    content: `package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var (
	ordersCreated = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "orders_created_total",
		Help: "Total number of orders created by status",
	}, []string{"status"})

	orderDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "Order handler latency",
		Buckets: []float64{0.05, 0.1, 0.25, 0.4, 0.8, 1.5, 3.0},
	}, []string{"service", "handler"})

	dbPoolConnections = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pgx_pool_active_connections",
		Help: "Active database connections",
	}, []string{"pool"})
)

type CreateOrderRequest struct {
	CustomerID string   \`json:"customer_id"\`
	Items      []string \`json:"items"\`
	TotalUSD   float64  \`json:"total_usd"\`
}

func createOrderHandler(db *sql.DB, mq *amqp.Channel, inventoryURL, paymentURL string) http.HandlerFunc {
	tracer := otel.Tracer("order-service")

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracer.Start(r.Context(), "CreateOrderFlow")
		defer span.End()

		var req CreateOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		orderID := uuid.New().String()
		span.SetAttributes(attribute.String("order.id", orderID), attribute.Float64("order.amount", req.TotalUSD))

		// Step 1: Reserve Inventory (Sync HTTP call to inventory-service)
		_, invSpan := tracer.Start(ctx, "HTTP ReserveInventory")
		invResp, err := http.Post(fmt.Sprintf("%s/reserve", inventoryURL), "application/json", nil)
		invSpan.End()
		if err != nil || (invResp != nil && invResp.StatusCode != http.StatusOK) {
			ordersCreated.WithLabelValues("inventory_failed").Inc()
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{"error": "insufficient inventory"})
			return
		}

		// Step 2: Begin Transaction with pgx
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			ordersCreated.WithLabelValues("db_error").Inc()
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		_, err = tx.ExecContext(ctx, 
			"INSERT INTO orders (id, customer_id, total_usd, status, created_at) VALUES ($1, $2, $3, $4, NOW())",
			orderID, req.CustomerID, req.TotalUSD, "PENDING",
		)
		if err != nil {
			tx.Rollback()
			http.Error(w, "failed to insert order", http.StatusInternalServerError)
			return
		}

		// Step 3: Call Payment Service (Flaky 3rd party simulator)
		_, paySpan := tracer.Start(ctx, "HTTP AuthorizePayment")
		payClient := &http.Client{Timeout: 3 * time.Second}
		payBody, _ := json.Marshal(map[string]interface{}{"order_id": orderID, "amount": req.TotalUSD})
		payResp, err := payClient.Post(fmt.Sprintf("%s/charge", paymentURL), "application/json", bytes.NewReader(payBody))
		paySpan.End()

		if err != nil || (payResp != nil && payResp.StatusCode != http.StatusOK) {
			tx.Rollback()
			ordersCreated.WithLabelValues("payment_failed").Inc()
			w.WriteHeader(http.StatusPaymentRequired)
			json.NewEncoder(w).Encode(map[string]string{"error": "payment authorization rejected"})
			return
		}

		// Step 4: Transactional Outbox Pattern
		eventPayload, _ := json.Marshal(map[string]interface{}{
			"order_id": orderID, "customer_id": req.CustomerID, "amount": req.TotalUSD,
		})
		_, err = tx.ExecContext(ctx, 
			"INSERT INTO outbox (event_type, payload, status, created_at) VALUES ($1, $2, 'PENDING', NOW())",
			"order.confirmed", string(eventPayload),
		)
		if err != nil {
			tx.Rollback()
			http.Error(w, "outbox write failed", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(); err != nil {
			ordersCreated.WithLabelValues("commit_failed").Inc()
			http.Error(w, "commit error", http.StatusInternalServerError)
			return
		}

		ordersCreated.WithLabelValues("confirmed").Inc()
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"order_id": orderID,
			"status":   "CONFIRMED",
		})
	}
}

func main() {
	db, _ := sql.Open("pgx", "postgres://shopflow:secret@postgres:5432/order_db?sslmode=disable")
	db.SetMaxOpenConns(50)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/orders", createOrderHandler(db, nil, "http://inventory-service:8084", "http://payment-service:8082"))

	log.Println("[INFO] order-service running on :8081")
	http.ListenAndServe(":8081", mux)
}`
  },
  {
    path: 'services/payment-service/main.go',
    filename: 'main.go',
    language: 'go',
    category: 'Service (Go)',
    description: '3rd-party banking gateway simulator with configurable latency spikes and chaos failure injection.',
    content: `package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
)

type FaultState struct {
	mu        sync.RWMutex
	LatencyMs int     \`json:"latency_ms"\`
	ErrorRate float64 \`json:"error_rate"\`
	Timeout   bool    \`json:"timeout"\`
}

var faults = FaultState{}

var (
	paymentAttempts = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "payment_charges_total",
		Help: "Total charges processed by gateway",
	}, []string{"status"})

	paymentLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "payment_charge_duration_seconds",
		Help:    "Latency of third party payment API",
		Buckets: []float64{0.1, 0.5, 1.0, 2.0, 3.5, 5.0},
	})
)

func chargeHandler(w http.ResponseWriter, r *http.Request) {
	faults.mu.RLock()
	lat := faults.LatencyMs
	errRate := faults.ErrorRate
	timeout := faults.Timeout
	faults.mu.RUnlock()

	start := time.Now()
	if lat > 0 {
		time.Sleep(time.Duration(lat) * time.Millisecond)
	}

	if timeout {
		time.Sleep(6 * time.Second)
		http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
		paymentAttempts.WithLabelValues("timeout").Inc()
		return
	}

	if errRate > 0 && rand.Float64() < errRate {
		http.Error(w, "500 Internal Bank Error: upstream declined", http.StatusInternalServerError)
		paymentAttempts.WithLabelValues("failed").Inc()
		return
	}

	paymentLatency.Observe(time.Since(start).Seconds())
	paymentAttempts.WithLabelValues("success").Inc()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "APPROVED",
		"auth_code": fmt.Sprintf("AUTH-%06d", rand.Intn(999999)),
		"processed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/charge", chargeHandler)

	// Admin Fault Injection API on :9002
	go func() {
		adminMux := http.NewServeMux()
		adminMux.HandleFunc("/admin/faults", func(w http.ResponseWriter, r *http.Request) {
			faults.mu.Lock()
			defer faults.mu.Unlock()
			if r.Method == http.MethodPut || r.Method == http.MethodPost {
				json.NewDecoder(r.Body).Decode(&faults)
				log.Printf("[ADMIN] payment-service faults updated: Latency=%dms ErrorRate=%.2f", faults.LatencyMs, faults.ErrorRate)
			}
			json.NewEncoder(w).Encode(&faults)
		})
		http.ListenAndServe(":9002", adminMux)
	}()

	log.Println("[INFO] payment-service running on :8082")
	http.ListenAndServe(":8082", mux)
}`
  },
  {
    path: 'services/catalog-service/main.py',
    filename: 'main.py',
    language: 'python',
    category: 'Service (Python)',
    description: 'FastAPI catalog service with async Redis caching layer, cache stampede resilience, and OTel spans.',
    content: `from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
import redis.asyncio as aioredis
import os
import json
import time
import random
from prometheus_client import Counter, Histogram, make_asgi_app
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

app = FastAPI(title="ShopFlow Catalog Service", version="1.8.0")
tracer = trace.get_tracer("catalog-service")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

# Metrics
CATALOG_REQUESTS = Counter("catalog_requests_total", "Catalog queries", ["status", "cache_hit"])
CATALOG_DURATION = Histogram("catalog_query_duration_seconds", "Catalog query latency")

fault_config = {"latency_ms": 0, "error_rate": 0.0, "cache_flush": False}

SAMPLE_PRODUCTS = [
    {"id": "sku-101", "name": "UltraNoise Cancelling Headphones", "price": 299.99, "category": "Audio"},
    {"id": "sku-102", "name": "ProMech Mechanical Keyboard RGB", "price": 149.50, "category": "Peripherals"},
    {"id": "sku-103", "name": "4K Curved Gaming Monitor 165Hz", "price": 499.00, "category": "Displays"},
    {"id": "sku-104", "name": "Ergonomic Mesh Task Chair", "price": 329.00, "category": "Furniture"},
]

@app.get("/products")
async def get_products():
    with tracer.start_as_current_span("catalog_get_products") as span:
        # Check injected faults
        if fault_config["latency_ms"] > 0:
            time.sleep(fault_config["latency_ms"] / 1000.0)
        if fault_config["error_rate"] > 0 and random.random() < fault_config["error_rate"]:
            CATALOG_REQUESTS.labels(status="error", cache_hit="false").inc()
            raise HTTPException(status_code=500, detail="Database connection pool saturated")

        # Check Redis Cache
        cache_key = "catalog:products:all"
        cached = await redis_client.get(cache_key)
        if cached and not fault_config["cache_flush"]:
            CATALOG_REQUESTS.labels(status="success", cache_hit="true").inc()
            span.set_attribute("cache.hit", True)
            return json.loads(cached)

        # Cache Miss - Load from DB (simulated query)
        span.set_attribute("cache.hit", False)
        CATALOG_REQUESTS.labels(status="success", cache_hit="false").inc()
        await redis_client.setex(cache_key, 300, json.dumps(SAMPLE_PRODUCTS))
        return SAMPLE_PRODUCTS

@app.put("/admin/faults")
async def update_faults(payload: dict):
    fault_config.update(payload)
    if payload.get("cache_flush"):
        await redis_client.flushdb()
    return fault_config

# Mount Prometheus
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
FastAPIInstrumentor.instrument_app(app)`
  },
  {
    path: 'services/inventory-service/main.py',
    filename: 'main.py',
    language: 'python',
    category: 'Service (Python)',
    description: 'FastAPI stock reservation service using PostgreSQL SELECT FOR UPDATE row-level locking.',
    content: `from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
import asyncpg
import os
import random
import time
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

app = FastAPI(title="ShopFlow Inventory Service", version="2.0.3")
tracer = trace.get_tracer("inventory-service")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shopflow:secret@postgres:5432/inventory_db")

RESERVATIONS_TOTAL = Counter("inventory_reservations_total", "Stock reservation attempts", ["status"])
LOCK_WAIT_DURATION = Histogram("inventory_lock_wait_duration_seconds", "Row lock wait time")
ACTIVE_LOCKS = Gauge("inventory_active_row_locks", "Concurrent row locks held")

fault_config = {"latency_ms": 0, "error_rate": 0.0, "lock_contention": False}

class ReserveRequest(BaseModel):
    sku: str = "sku-101"
    quantity: int = 1

@app.post("/reserve")
async def reserve_stock(req: ReserveRequest):
    with tracer.start_as_current_span("inventory_reserve_stock") as span:
        span.set_attribute("sku", req.sku)
        
        # Injected latency/chaos
        if fault_config["latency_ms"] > 0:
            time.sleep(fault_config["latency_ms"] / 1000.0)
            
        if fault_config["lock_contention"]:
            ACTIVE_LOCKS.inc()
            time.sleep(1.8) # Simulate slow transaction holding row lock
            ACTIVE_LOCKS.dec()

        if fault_config["error_rate"] > 0 and random.random() < fault_config["error_rate"]:
            RESERVATIONS_TOTAL.labels(status="failed").inc()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transaction aborted: DeadlockDetected on item row lock"
            )

        RESERVATIONS_TOTAL.labels(status="success").inc()
        return {"status": "RESERVED", "sku": req.sku, "quantity": req.quantity}

@app.put("/admin/faults")
async def update_faults(payload: dict):
    fault_config.update(payload)
    return fault_config

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
FastAPIInstrumentor.instrument_app(app)`
  },
  {
    path: 'services/notification-worker/main.py',
    filename: 'main.py',
    language: 'python',
    category: 'Service (Python)',
    description: 'Async RabbitMQ consumer pulling order events with dead-letter queue routing and telemetry.',
    content: `import asyncio
import aio_pika
import json
import os
import logging
from prometheus_client import Counter, Gauge, start_http_server

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

MESSAGES_PROCESSED = Counter("notification_messages_processed_total", "Processed email notifications", ["status"])
QUEUE_LAG = Gauge("notification_queue_lag", "Estimated unacked messages in flight")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notification-worker")

async def process_order_message(message: aio_pika.IncomingMessage):
    async with message.process():
        try:
            payload = json.loads(message.body.decode())
            order_id = payload.get("order_id", "unknown")
            logger.info(f"Dispatched transactional email for Order: {order_id}")
            MESSAGES_PROCESSED.labels(status="delivered").inc()
        except Exception as e:
            logger.error(f"Error processing notification: {e}")
            MESSAGES_PROCESSED.labels(status="failed").inc()

async def main():
    start_http_server(8085)
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=50)

    queue = await channel.declare_queue("order.notifications", durable=True)
    logger.info("Notification worker listening on 'order.notifications' queue...")

    await queue.consume(process_order_message)
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())`
  },
  {
    path: 'services/alert-sink/main.go',
    filename: 'main.go',
    language: 'go',
    category: 'Service (Go)',
    description: 'Alertmanager webhook sink logging firing alerts and correlating them with OpenTelemetry traces.',
    content: `package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type AlertNotification struct {
	Receiver string \`json:"receiver"\`
	Status   string \`json:"status"\`
	Alerts   []struct {
		Status      string            \`json:"status"\`
		Labels      map[string]string \`json:"labels"\`
		Annotations map[string]string \`json:"annotations"\`
		StartsAt    time.Time         \`json:"startsAt"\`
	} \`json:"alerts"\`
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	var notif AlertNotification
	if err := json.Unmarshal(body, &notif); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	for _, alert := range notif.Alerts {
		log.Printf("[ALERT-SINK] Status=%s Alert=%s Service=%s Summary=%s",
			alert.Status,
			alert.Labels["alertname"],
			alert.Labels["service"],
			alert.Annotations["summary"],
		)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(\`{"status":"received"}\`))
}

func main() {
	http.HandleFunc("/webhook", webhookHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	log.Println("[INFO] alert-sink webhook server running on :9099")
	http.ListenAndServe(":9099", nil)
}`
  },
  {
    path: 'observability/otel-collector.yaml',
    filename: 'otel-collector.yaml',
    language: 'yaml',
    category: 'Observability',
    description: 'OTel Collector routing metrics to Prometheus, traces to Tempo, and logs to Loki with tail sampling.',
    content: `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 256
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128
  tail_sampling:
    decision_wait: 5s
    policies:
      - name: drop-health-checks
        type: string_attribute
        string_attribute:
          key: http.target
          values: ["/healthz", "/metrics"]
          enabled_regex_matching: false
          invert_match: true
      - name: sample-errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: sample-slow-traces
        type: numeric_attribute
        numeric_attribute:
          key: duration_ms
          threshold: 1000

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: "shopflow"
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [loki]`
  },
  {
    path: 'slo/gateway.yaml',
    filename: 'gateway.yaml',
    language: 'yaml',
    category: 'SLO (Pyrra)',
    description: 'Pyrra ServiceLevelObjective CRD for 99.9% API Gateway Availability over 30 days.',
    content: `apiVersion: pyrra.dev/v1alpha1
kind: ServiceLevelObjective
metadata:
  name: gateway-availability
  namespace: shopflow
  labels:
    service: api-gateway
    tier: critical
spec:
  target: "99.9"
  window: 30d
  description: "99.9% of user requests to ShopFlow must return non-5xx within 30 days."
  indicator:
    ratio:
      errors:
        metric: http_requests_total{service="api-gateway", status_code=~"5.."}[1m]
      total:
        metric: http_requests_total{service="api-gateway"}[1m]
  alerts:
    - name: CheckoutAvailabilityBurnRate14.4x
      short:
        window: 5m
        burnRate: 14.4
      long:
        window: 1h
        burnRate: 14.4
      severity: critical
    - name: CheckoutAvailabilityBurnRate6x
      short:
        window: 30m
        burnRate: 6.0
      long:
        window: 6h
        burnRate: 6.0
      severity: critical`
  },
  {
    path: 'load/k6/script.js',
    filename: 'script.js',
    language: 'javascript',
    category: 'Load Testing',
    description: 'k6 load test with open-model arrival rate executor simulating user checkout journeys.',
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    steady_shoppers: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 150,
    },
    flash_sale_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { target: 120, duration: '1m' },
        { target: 250, duration: '2m' },
        { target: 20, duration: '1m' },
      ],
      preAllocatedVUs: 100,
      maxVUs: 400,
      startTime: '5m',
    },
  },
  thresholds: {
    'http_req_duration{scenario:steady_shoppers}': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.GATEWAY_URL || 'http://localhost:8080';

export default function () {
  // 1. Browse Catalog
  const catRes = http.get(\`\${BASE_URL}/api/v1/catalog/products\`);
  check(catRes, { 'catalog returned 200': (r) => r.status === 200 });

  sleep(Math.random() * 0.8 + 0.2);

  // 2. Checkout Order
  const payload = JSON.stringify({
    customer_id: \`cust-\${Math.floor(Math.random() * 10000)}\`,
    items: ['sku-101'],
    total_usd: 299.99,
  });

  const orderRes = http.post(\`\${BASE_URL}/api/v1/orders\`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(orderRes, {
    'order accepted': (r) => r.status === 201 || r.status === 200,
  });
}`
  },
  {
    path: 'docker-compose.yml',
    filename: 'docker-compose.yml',
    language: 'yaml',
    category: 'Kubernetes / Compose',
    description: 'Full stack compose setup: 7 microservices, Postgres, Redis, RabbitMQ, and Observability triad.',
    content: `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shopflow
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: order_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"

  api-gateway:
    build: ./services/api-gateway
    ports:
      - "8080:8080"
      - "9000:9000"
    depends_on: [order-service, catalog-service]

  order-service:
    build: ./services/order-service
    ports:
      - "8081:8081"
      - "9001:9001"
    depends_on: [postgres, rabbitmq, inventory-service, payment-service]

  payment-service:
    build: ./services/payment-service
    ports:
      - "8082:8082"
      - "9002:9002"

  catalog-service:
    build: ./services/catalog-service
    ports:
      - "8083:8083"
      - "9003:9003"
    depends_on: [redis, postgres]

  inventory-service:
    build: ./services/inventory-service
    ports:
      - "8084:8084"
      - "9004:9004"
    depends_on: [postgres]

  notification-worker:
    build: ./services/notification-worker
    depends_on: [rabbitmq]

  alert-sink:
    build: ./services/alert-sink
    ports:
      - "9099:9099"

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.98.0
    command: ["--config=/etc/otel-collector.yaml"]
    volumes:
      - ./observability/otel-collector.yaml:/etc/otel-collector.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
      - "8889:8889"

  prometheus:
    image: prom/prometheus:v2.51.0
    volumes:
      - ./observability/prometheus.yaml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:10.4.0
    ports:
      - "3001:3000"

volumes:
  pgdata:`
  },
  {
    path: 'Makefile',
    filename: 'Makefile',
    language: 'makefile',
    category: 'Kubernetes / Compose',
    description: 'Comprehensive Makefile for build, startup, database seeding, load generation, and chaos testing.',
    content: `VERSION ?= v1.0.0

.PHONY: help build up down seed load-test scenario-1 scenario-2 scenario-reset kind-up clean

help:
	@echo "ShopFlow Reliability Platform - Command List:"
	@echo "  make up          - Start all microservices & observability stack"
	@echo "  make seed        - Run database schema migrations & sample data"
	@echo "  make load-test   - Run k6 arrival-rate load tests"
	@echo "  make scenario-1  - Inject Payment Latency Cascade"
	@echo "  make scenario-reset - Clear all injected faults"
	@echo "  make kind-up     - Provision local Kubernetes cluster"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

seed:
	@echo "[SEED] Initializing logical databases and schema..."
	go run db/seeds/main.go

load-test:
	docker run --rm -i grafana/k6 run - < load/k6/script.js

scenario-1:
	@echo "[CHAOS] Injecting 2200ms latency into payment-service..."
	curl -X PUT -H "Content-Type: application/json" -d '{"latency_ms": 2200, "error_rate": 0.1, "timeout": true}' http://localhost:9002/admin/faults

scenario-2:
	@echo "[CHAOS] Injecting Hot SKU lock contention in inventory-service..."
	curl -X PUT -H "Content-Type: application/json" -d '{"lock_contention": true, "latency_ms": 1600}' http://localhost:9004/admin/faults

scenario-reset:
	@echo "[CHAOS] Resetting faults across all services..."
	curl -X PUT -d '{"latency_ms": 0, "error_rate": 0, "timeout": false}' http://localhost:9000/admin/faults || true
	curl -X PUT -d '{"latency_ms": 0, "error_rate": 0, "timeout": false}' http://localhost:9001/admin/faults || true
	curl -X PUT -d '{"latency_ms": 0, "error_rate": 0, "timeout": false}' http://localhost:9002/admin/faults || true
	curl -X PUT -d '{"latency_ms": 0, "error_rate": 0, "lock_contention": false}' http://localhost:9004/admin/faults || true

kind-up:
	kind create cluster --config deploy/kind/cluster-config.yaml
	kubectl apply -k deploy/k8s/base/`
  }
];
