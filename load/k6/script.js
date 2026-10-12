import http from 'k6/http';
import { check, sleep } from 'k6';

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
  const catRes = http.get(`${BASE_URL}/api/v1/catalog/products`);
  check(catRes, { 'catalog returned 200': (r) => r.status === 200 });

  sleep(Math.random() * 0.8 + 0.2);

  // 2. Checkout Order
  const payload = JSON.stringify({
    customer_id: `cust-${Math.floor(Math.random() * 10000)}`,
    items: ['sku-101'],
    total_usd: 299.99,
  });

  const orderRes = http.post(`${BASE_URL}/api/v1/orders`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(orderRes, {
    'order accepted': (r) => r.status === 201 || r.status === 200,
  });
}
