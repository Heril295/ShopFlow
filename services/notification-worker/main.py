import asyncio
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
    asyncio.run(main())
