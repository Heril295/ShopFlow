from fastapi import FastAPI, HTTPException, status
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
        if fault_config["latency_ms"] > 0:
            time.sleep(fault_config["latency_ms"] / 1000.0)
        if fault_config["error_rate"] > 0 and random.random() < fault_config["error_rate"]:
            CATALOG_REQUESTS.labels(status="error", cache_hit="false").inc()
            raise HTTPException(status_code=500, detail="Database connection pool saturated")

        cache_key = "catalog:products:all"
        try:
            cached = await redis_client.get(cache_key)
            if cached and not fault_config["cache_flush"]:
                CATALOG_REQUESTS.labels(status="success", cache_hit="true").inc()
                span.set_attribute("cache.hit", True)
                return json.loads(cached)
        except Exception:
            pass

        span.set_attribute("cache.hit", False)
        CATALOG_REQUESTS.labels(status="success", cache_hit="false").inc()
        try:
            await redis_client.setex(cache_key, 300, json.dumps(SAMPLE_PRODUCTS))
        except Exception:
            pass
        return SAMPLE_PRODUCTS

@app.put("/admin/faults")
async def update_faults(payload: dict):
    fault_config.update(payload)
    if payload.get("cache_flush"):
        try:
            await redis_client.flushdb()
        except Exception:
            pass
    return fault_config

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
FastAPIInstrumentor.instrument_app(app)
