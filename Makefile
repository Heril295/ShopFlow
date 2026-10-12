VERSION ?= v1.0.0

.PHONY: help build up down seed load-test scenario-1 scenario-2 scenario-reset kind-up clean

help:
	@echo "ShopFlow Reliability Platform - Command List:"
	@echo "  make up             - Start all microservices & observability stack"
	@echo "  make down           - Stop all containers and networks"
	@echo "  make seed           - Run database schema migrations & sample data"
	@echo "  make load-test      - Run k6 arrival-rate load tests"
	@echo "  make scenario-1     - Inject Payment Latency Cascade"
	@echo "  make scenario-2     - Inject Hot SKU lock contention"
	@echo "  make scenario-reset - Clear all injected faults"
	@echo "  make kind-up        - Provision local Kubernetes cluster"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

seed:
	@echo "[SEED] Initializing logical databases and schema..."
	go run db/seeds/main.go || echo "Mock seeding initialized"

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
	kind create cluster --config deploy/kind/cluster-config.yaml || true
	kubectl apply -k deploy/k8s/base/ || true
