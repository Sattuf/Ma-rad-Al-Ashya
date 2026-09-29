"""Postgres connection pool (asyncpg).

Bounded like the Node services (common/database.ts): a traffic spike queues requests in the
service instead of opening more connections than Postgres can take, and every statement has
a server-side timeout so one slow query cannot hold a connection indefinitely.
"""
import logging
from typing import Optional

import asyncpg

from app.core.config import settings

logger = logging.getLogger("db")


class Database:
    def __init__(self) -> None:
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        if self.pool is not None:
            return
        # Never log the URL itself: it contains the password.
        logger.info("Connecting to Postgres")
        self.pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=1,
            max_size=settings.DB_POOL_MAX,
            # Waiting for a free connection and running a statement are both bounded.
            timeout=5,
            command_timeout=settings.DB_STATEMENT_TIMEOUT_MS / 1000,
            max_inactive_connection_lifetime=300,
            server_settings={
                "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS),
                "application_name": "personalization-service",
            },
        )

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    def _require(self) -> asyncpg.Pool:
        if self.pool is None:
            raise RuntimeError("Database pool is not connected")
        return self.pool

    async def fetch(self, query: str, *args):
        return await self._require().fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        return await self._require().fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        return await self._require().fetchval(query, *args)


db = Database()
