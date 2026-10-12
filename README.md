# ShopFlow: Multi-Service E-Commerce Reliability & SLO Testing Platform

> **A production-grade, polyglot microservice e-commerce application in Go and Python designed for SLO-driven reliability testing, chaos engineering, OpenTelemetry distributed tracing, and automated incident retrospectives.**

[![Runtime](https://img.shields.io/badge/Runtime-Go%201.22%20%7C%20Python%203.12%20%7C%20Node.js%2022-blue)](#architecture)
[![Telemetry](https://img.shields.io/badge/Observability-OpenTelemetry%20%7C%20Prometheus%20%7C%20Loki%20%7C%20Tempo-orange)](#observability--slo-stack)
[![SLO Standard](https://img.shields.io/badge/SLO%20Standard-Pyrra%20%7C%20Google%20SRE%20Workbook-emerald)](#slo-management-with-pyrra)

---

## 📖 Table of Contents
- [1. Overview](#1-overview)
- [2. Microservices Architecture & Languages](#2-microservices-architecture--languages)
- [3. Key Features](#3-key-features)
- [4. Chaos & Fault Injection Engine (10 Scenarios)](#4-chaos--fault-injection-engine-10-scenarios)
- [5. Observability & Pyrra SLOs](#5-observability--pyrra-slos)
- [6. How to Run the Application](#6-how-to-run-the-application)
  - [Prerequisites](#prerequisites)
  - [Option A: Quick Start Web Control Center (React/Vite)](#option-a-quick-start-web-control-center-reactvite)
  - [Option B: Running the Full Multi-Service Docker Compose Stack](#option-b-running-the-full-multi-service-docker-compose-stack)
  - [Option C: Running Load Tests (k6)](#option-c-running-load-tests-k6)
  - [Option D: Local Kubernetes Cluster (Kind)](#option-d-local-kubernetes-cluster-kind)
- [7. How to Push to Your GitHub Repository](#7-how-to-push-to-your-github-repository)
- [8. Makefile Reference](#8-makefile-reference)

---

## 1. Overview

**ShopFlow** is modeled after modern high-throughput e-commerce platforms (such as Shopify, Amazon, or Zalando) to test system resilience against cascading failures, third-party timeouts, lock contention, and queue backpressure.

It combines:
1. **Interactive SRE Control Center (Web UI):** A real-time web console displaying service topology, live RED metrics (Rate, Errors, Duration), OpenTelemetry trace waterfalls, Loki log streams, Pyrra error budget burn gauges, and one-click incident runbooks.
2. **7 Polyglot Microservices:** Written in **Go 1.22** and **Python 3.12 / FastAPI**, leveraging synchronous HTTP/gRPC, the Transactional Outbox pattern, PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), and asynchronous RabbitMQ event queues.
3. **Dedicated Admin Fault APIs:** Every service exposes an internal Admin API on port `900x` (`/admin/faults`) to inject latency, error spikes, database pool exhaustion, or circuit breaker trips on demand.

---

## 2. Microservices Architecture & Languages

```
                                      [ Clients / k6 Load Tests ]
                                                   │
                                                   ▼
                                         ┌──────────────────┐
                                         │   api-gateway    │ (Go 1.22 - Chi, Sonygobreaker)
                                         │    Port :8080    │ Admin :9000
                                         └─────────┬────────┘
                                                   │
                         ┌─────────────────────────┼─────────────────────────┐
                         ▼                         ▼                         ▼
               ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
               │ catalog-service  │      │  order-service   │      │inventory-service │
               │ (Python/FastAPI) │      │ (Go 1.22 - pgx)  │      │ (Python/FastAPI) │
               │   Port :8083     │      │   Port :8081     │      │   Port :8084     │
               └─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
                         │                         │                         │
                         ▼                         ▼                         ▼
                    ┌─────────┐              ┌───────────┐             ┌───────────┐
                    │  Redis  │              │PostgreSQL │             │PostgreSQL │
                    │ (Cache) │              │(order_db) │             │(inv_db)   │
                    └─────────┘              └─────┬─────┘             └───────────┘
                                                   │ (Sync RPC)
                                                   ▼
                                         ┌──────────────────┐
                                         │ payment-service  │ (Go 1.22 - 3rd-Party Mock)
                                         │   Port :8082     │ Admin :9002
                                         └──────────────────┘
                                                   │
                                                   │ (Transactional Outbox Event)
                                                   ▼
                                         ┌──────────────────┐
                                         │ RabbitMQ Broker  │ Exchange: order.events
                                         │   Port :5672     │ Queue: order.notifications
                                         └─────────┬────────┘
                                                   │
                                                   ▼
                                         ┌──────────────────┐
                                         │notification-work.│ (Python 3.12 - aio-pika)
                                         │   Port :8085     │
                                         └──────────────────┘
```

### Detailed Breakdown of Services:

| Service | Language & Framework | Primary Role | Key Technologies |
| :--- | :--- | :--- | :--- |
| **`api-gateway`** | **Go 1.22** (`chi/v5`) | Reverse proxy, JWT verification, rate limiter, Sonygobreaker circuit breakers | `net/http/httputil`, `sony/gobreaker`, `promhttp`, OTel HTTP |
| **`order-service`** | **Go 1.22** (`chi/v5`) | Saga checkout coordinator, Transactional Outbox pattern | `jackc/pgx/v5`, `rabbitmq/amqp091-go`, OTel SDK |
| **`payment-service`**| **Go 1.22** (`net/http`)| Flaky third-party banking gateway simulator with chaos hooks | `crypto/tls`, `promauto`, sync mutex state |
| **`catalog-service`**| **Python 3.12** (`FastAPI`)| High-read product catalog with cache-aside pattern | `redis.asyncio`, `SQLAlchemy` (async), OTel FastAPI |
| **`inventory-service`**| **Python 3.12** (`FastAPI`)| Concurrency-safe stock reservation using row-level locks | `asyncpg`, `SELECT ... FOR UPDATE`, Postgres locks |
| **`notification-worker`**| **Python 3.12** (`aio-pika`)| Asynchronous event consumer for transactional receipts | `aio_pika`, `asyncio`, Dead-Letter Queue (DLQ) |
| **`alert-sink`** | **Go 1.22** (`net/http`) | Webhook listener on `:9099` ingesting Alertmanager alerts | Structured JSON logging, trace correlation |
| **`web-control-center`**| **TypeScript / React 19** | Real-time observability dashboard & simulation UI | Vite, Tailwind CSS v4, Lucide icons, Motion |

---

## 3. Key Features

1. **Live Service Mesh Topology Graph:**
   - Real-time animated visualization of data flows, connection statuses, and per-service RED metrics.
   - Dynamic indicators for Circuit Breaker transitions (`CLOSED`, `HALF-OPEN`, `OPEN`).

2. **10 Predefined Chaos Scenarios:**
   - One-click chaos injection with fine-grained parameter sliders for latency (`0 - 4000ms`), error injection rate (`0 - 100%`), and forced timeouts.
   - Detailed blast radius analysis and recommended SRE runbook mitigation workflows.

3. **Pyrra-Compliant Multi-Window Multi-Burn-Rate SLO Engine:**
   - 30-day rolling error budgets for Gateway Availability, Checkout Latency, Catalog Reads, and Inventory Reservations.
   - Four distinct alerting burn-rate tiers (Google SRE Handbook standard):
     - **14.4x (1h window)** &rarr; SEV-1 Critical Page (2% budget consumed in 1 hour)
     - **6.0x (6h window)** &rarr; Critical Page (5% budget consumed in 6 hours)
     - **3.0x (24h window)** &rarr; Warning Ticket (10% budget consumed in 24 hours)
   - Real-time **Time-to-Budget-Exhaustion** calculation.

4. **OpenTelemetry Distributed Tracing (Tempo / Jaeger):**
   - End-to-end trace waterfall showing parent and child spans:
     `api-gateway` &rarr; `order-service` &rarr; `inventory-service` &rarr; `payment-service` &rarr; `notification-worker`.
   - Inspect span attributes (`http.status_code`, `db.statement`, `order.id`, `error=true`).

5. **Structured Log Stream (Loki):**
   - Live stream with LogQL-style query filtering (`{service="order-service"} |= "error"`).
   - Direct click-through links from error logs to their corresponding distributed trace.

6. **Alert Sink & 1-Click Runbook Mitigations:**
   - Prometheus Alertmanager webhook listener on port `:9099`.
   - Execute live mitigation actions (e.g., *Enable Payment Fail-Open Async Mode*, *Scale Worker Replicas*, *Reset Connection Pool*).

7. **Blameless Postmortem Studio:**
   - Reconstruct incident timelines, 5 Whys analysis, blast radius, and revenue/budget loss.
   - One-click Markdown export formatted for Jira, Notion, or GitHub issues.

8. **End-to-End Shopper Simulator:**
   - Live e-commerce shopping modal: select products, place an order, and watch the transaction pass through the saga pipeline in real time.

---

## 4. Chaos & Fault Injection Engine (10 Scenarios)

| # | Scenario Name | Target Service | Failure Mechanism | Expected Symptoms |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Payment Latency Cascade** | `payment-service` | 2200ms latency spike | Gateway timeout, circuit breaker trips OPEN, burns Checkout SLO |
| **2** | **Inventory Lock Contention** | `inventory-service` | Hot SKU row lock wait | PostgreSQL transaction queue backlog, 409 conflict aborts |
| **3** | **Redis Cache Stampede** | `catalog-service` | Bulk Redis key eviction | Redis hit ratio drops to <5%, Postgres query pool saturates |
| **4** | **RabbitMQ Backpressure** | `notification-worker` | Unacknowledged messages | Queue depth balloons to >15,000 msgs, memory alarm |
| **5** | **PostgreSQL Pool Starvation**| `order-service` | Unclosed `pgx` connections | 50/50 connection saturation, 30s connection acquisition timeout |
| **6** | **Third-Party Payment Flaky 500**| `payment-service` | 55% random 500 status | Card authorization failures, orders revert to CANCELLED |
| **7** | **Network Loss & Jitter** | `api-gateway` | 25% packet drop + 450ms jitter | Intermittent connection resets, P95 latency SLO breached |
| **8** | **Outbox Split Brain** | `order-service` | Goroutine publisher halted | DB transaction commits, but RabbitMQ publishes stop |
| **9** | **Catalog Memory Leak (OOM)** | `catalog-service` | Memory leak up to 512MB | Kubernetes OOMKilled events, pod crash-restart loop |
| **10**| **CoreDNS Flapping** | `api-gateway` | Intermittent DNS resolution timeout | Transient 503 Bad Gateway, upstream discovery drops |

---

## 5. Observability & Pyrra SLOs

### Pyrra CRD Definition (`slo/gateway.yaml`):
```yaml
apiVersion: pyrra.dev/v1alpha1
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
        metric: http_requests_total{service="api-gateway"}[1m]
```

---

## 6. How to Run the Application

### Prerequisites
- **Node.js** &ge; 18.x and **npm** (for the UI / Control Center)
- **Docker** and **Docker Compose** (for running the full polyglot stack)
- **Go** &ge; 1.22 and **Python** &ge; 3.12 (optional, if running services bare-metal)

---

### Option A: Quick Start Web Control Center (React/Vite)

To launch the full interactive web control center, simulation engine, and dashboard:

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

Open your browser to:
**`http://localhost:3000`**

From the web UI, you can:
- Switch load traffic between **0 RPS (Paused)**, **Steady (45 RPS)**, **Flash Sale (145 RPS)**, and **Black Friday Spike (320 RPS)**.
- Trigger any of the 10 chaos scenarios with customized sliders.
- Inspect real-time OpenTelemetry trace waterfalls and Loki structured logs.
- Test customer checkouts via the **Simulate Checkout** button.

---

### Option B: Running the Full Multi-Service Docker Compose Stack

To spin up all 7 microservices, PostgreSQL, Redis, RabbitMQ, and the observability stack:

```bash
# 1. Build and start all services in detached mode
make up
# or: docker compose up -d

# 2. Run initial database schema migrations & sample data seed
make seed

# 3. Check service health
docker compose ps
```

#### Service Port Mappings:
| Service / Tool | Public Port | Admin Fault Port | Description |
| :--- | :--- | :--- | :--- |
| **ShopFlow Web Control Center** | `http://localhost:3000` | - | Primary SRE & Testing Console |
| **API Gateway** | `http://localhost:8080` | `http://localhost:9000` | Ingress Entrypoint |
| **Order Service** | `http://localhost:8081` | `http://localhost:9001` | Saga & Outbox |
| **Payment Service** | `http://localhost:8082` | `http://localhost:9002` | 3rd-Party Mock |
| **Catalog Service** | `http://localhost:8083` | `http://localhost:9003` | Product Search & Cache |
| **Inventory Service** | `http://localhost:8084` | `http://localhost:9004` | Stock & Row Locking |
| **Notification Worker** | `http://localhost:8085` | - | RabbitMQ Consumer |
| **Alert Sink** | `http://localhost:9099` | - | Webhook Receiver |
| **Prometheus** | `http://localhost:9090` | - | Metrics & Alert Rules |
| **Grafana** | `http://localhost:3001` | - | RED & SLO Dashboards |
| **RabbitMQ Management** | `http://localhost:15672` | - | Queue UI (guest / guest) |
| **PostgreSQL** | `localhost:5432` | - | `shopflow` / `secret` |
| **Redis** | `localhost:6379` | - | In-memory cache |

---

### Option C: Running Load Tests (k6)

Generate realistic user journeys with open-model arrival rates:

```bash
# Run the k6 load testing script
make load-test
# or: docker run --rm -i grafana/k6 run - < load/k6/script.js
```

---

### Option D: Local Kubernetes Cluster (Kind)

Deploy ShopFlow onto a local Kubernetes cluster with Pyrra CRDs:

```bash
make kind-up
```

---

## 7. How to Push to Your GitHub Repository

Follow these steps to push this complete codebase to your own GitHub repository:

### Step 1: Create a New Repository on GitHub
1. Go to [GitHub](https://github.com/new).
2. Enter a repository name (e.g., `shopflow-reliability-platform`).
3. Choose **Public** or **Private**.
4. Leave *"Initialize this repository with a README"* **unchecked** (we already have one).
5. Click **Create repository**.

### Step 2: Initialize Git and Push from Terminal

In your project directory, run:

```bash
# 1. Initialize git (if not already done)
git init

# 2. Configure your git identity
git config user.name "Your Name"
git config user.email "your-email@example.com"

# 3. Add all files to staging
git add .

# 4. Commit the codebase
git commit -m "feat: initial release of ShopFlow reliability & SLO platform"

# 5. Rename the default branch to main
git branch -M main

# 6. Link your remote GitHub repository (replace with your actual GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git

# 7. Push the code to GitHub
git push -u origin main
```

*(If using SSH, use `git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPOSITORY_NAME.git`)*

---

## 8. Makefile Reference

| Command | Description |
| :--- | :--- |
| `make up` | Start all microservices, databases, and telemetry via Docker Compose |
| `make down` | Tear down all running containers and networks |
| `make seed` | Initialize PostgreSQL logical schemas and populate catalog items |
| `make load-test` | Execute k6 arrival-rate load tests |
| `make scenario-1` | Inject 2200ms latency into `payment-service` (Admin API) |
| `make scenario-2` | Inject Hot SKU lock contention into `inventory-service` |
| `make scenario-reset` | Reset all injected faults across all microservices |
| `make kind-up` | Create a local Kind cluster and deploy Kubernetes manifests |

---

## 📄 License
Apache-2.0 License. Built for production reliability engineering, chaos simulations, and SRE training.
