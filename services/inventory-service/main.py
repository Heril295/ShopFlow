from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
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

        if fault_config["latency_ms"] > 0:
            time.sleep(fault_config["latency_ms"] / 1000.0)

        if fault_config["lock_contention"]:
            ACTIVE_LOCKS.inc()
            time.sleep(1.8)
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
FastAPIInstrumentor.instrument_app(app)
