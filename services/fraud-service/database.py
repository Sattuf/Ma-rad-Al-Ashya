"""Postgres pool for fraud-service. The schema comes from db/migrations (0001, 0004); the
service never creates tables at runtime."""
import os
import logging

import asyncpg
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("fraud.database")

# docker-compose passes DATABASE_URL (the name every service uses); POSTGRES_URL is kept for
# older deployments.
POSTGRES_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/marad_db")
POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))
STATEMENT_TIMEOUT_MS = int(os.getenv("DB_STATEMENT_TIMEOUT_MS", "5000"))

pg_pool = None


async def connect_to_postgres():
    """Bounded pool with statement timeouts, like the other services: a spike queues here
    instead of exhausting Postgres connections."""
    global pg_pool
    pg_pool = await asyncpg.create_pool(
        POSTGRES_URL,
        min_size=1,
        max_size=POOL_MAX,
        timeout=5,
        command_timeout=STATEMENT_TIMEOUT_MS / 1000,
        server_settings={"statement_timeout": str(STATEMENT_TIMEOUT_MS), "application_name": "fraud-service"},
    )
    logger.info("Connected to Postgres")


async def close_postgres_connection():
    if pg_pool:
        await pg_pool.close()
