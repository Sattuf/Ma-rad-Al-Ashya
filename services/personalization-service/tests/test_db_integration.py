"""user_events on a real Postgres (migrated with db/migrations): the signals query, partition
pruning, and partition maintenance. Skipped unless DATABASE_URL is set; CI runs it in the
integration job.

    DATABASE_URL=postgresql://... python -m pytest tests/test_db_integration.py
"""
import os
import uuid
from pathlib import Path

import asyncpg
import pytest

import app.services.event_service as event_module
from app.core.db import Database
from app.services.event_service import SIGNALS_SQL, event_service

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

MIGRATIONS = Path(__file__).resolve().parents[3] / "db" / "migrations"
USER = "5f0c3e1a-0000-4000-8000-00000000a001"
CARS, PHONES, SOFAS = (str(uuid.UUID(int=i)) for i in (101, 102, 103))


@pytest.fixture
async def real_db(monkeypatch):
    schema = f"it_pers_{os.getpid()}"
    admin = await asyncpg.connect(DATABASE_URL)
    await admin.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE; CREATE SCHEMA {schema}")
    await admin.close()

    database = Database()
    database.pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=1, max_size=4, server_settings={"search_path": f"{schema},public"}
    )
    async with database.pool.acquire() as conn:
        for sql_file in sorted(MIGRATIONS.glob("*.sql")):
            await conn.execute(sql_file.read_text())
        await conn.execute("INSERT INTO users (id, full_name) VALUES ($1, 'Events user')", uuid.UUID(USER))
    monkeypatch.setattr(event_module, "db", database)
    try:
        yield database
    finally:
        async with database.pool.acquire() as conn:
            await conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        await database.close()


async def add_event(database, event_type, category=None, listing=None, days_ago=0):
    await database.pool.execute(
        """INSERT INTO user_events (user_id, event_type, category_id, listing_id, created_at)
           VALUES ($1, $2, $3, $4, now() - make_interval(days => $5))""",
        uuid.UUID(USER), event_type, category and uuid.UUID(category), listing and uuid.UUID(listing), days_ago,
    )


@pytest.mark.anyio
async def test_save_event_writes_to_the_current_partition(real_db):
    saved = await event_service.save_event(USER, "view", listing_id=uuid.UUID(int=7), category_id=uuid.UUID(CARS))
    assert saved["id"]
    partition = await real_db.fetchval("SELECT tableoid::regclass::text FROM user_events")
    assert partition.startswith("user_events_y")  # a monthly partition, not the default


@pytest.mark.anyio
async def test_categories_rank_by_strength_and_recency(real_db):
    # Many old views of cars; one recent purchase of a phone; one recent favorite sofa.
    for _ in range(6):
        await add_event(real_db, "view", CARS, days_ago=40)
    await add_event(real_db, "purchase", PHONES, days_ago=1)
    await add_event(real_db, "favorite", SOFAS, days_ago=2)
    # Outside the 90-day window: ignored however strong.
    for _ in range(20):
        await add_event(real_db, "purchase", str(uuid.UUID(int=999)), days_ago=120)

    signals = await event_service.user_signals(USER)
    # purchase 5 × ~0.95 > favorite 3 × ~0.9 > six views × 0.5^(40/14) ≈ 6 × 0.14
    assert signals["categories"] == [PHONES, SOFAS, CARS]


@pytest.mark.anyio
async def test_seen_listings_are_distinct(real_db):
    listing = str(uuid.UUID(int=55))
    for _ in range(3):
        await add_event(real_db, "view", CARS, listing=listing)
    signals = await event_service.user_signals(USER)
    assert signals["seen_listings"] == [listing]


@pytest.mark.anyio
async def test_signals_read_only_recent_partitions_through_the_index(real_db):
    await real_db.pool.execute(
        """CREATE TABLE user_events_y2020m01 PARTITION OF user_events
           FOR VALUES FROM ('2020-01-01') TO ('2020-02-01')"""
    )
    # A realistic volume: 2,000 users with 30 events each in recent months.
    await real_db.pool.execute(
        """INSERT INTO users (id, full_name)
           SELECT md5('ev' || g)::uuid, 'user ' || g FROM generate_series(1, 2000) g;
           INSERT INTO user_events (user_id, event_type, category_id, created_at)
           SELECT md5('ev' || (1 + g % 2000))::uuid, 'view', md5('cat' || (g % 40))::uuid,
                  now() - (g % 60) * interval '1 day'
           FROM generate_series(1, 60000) g;"""
    )
    # Past months have no partition yet: their rows sit in the default partition until
    # maintenance adopts them into monthly partitions.
    await real_db.pool.execute("SELECT ensure_user_event_partitions(2); ANALYZE user_events;")
    assert await real_db.fetchval("SELECT count(*) FROM user_events_default") == 0
    plan = "\n".join(
        r[0] for r in await real_db.pool.fetch("EXPLAIN (ANALYZE, COSTS OFF) " + SIGNALS_SQL, uuid.UUID(USER))
    )
    assert "user_events_y2020m01" not in plan or "never executed" in plan
    # Partitions that hold rows are read through (user_id, created_at); a sequential scan
    # is only acceptable on an empty (future) partition, where it reads nothing.
    for line in plan.splitlines():
        if "Seq Scan on user_events" in line:
            assert "rows=0 " in line, line
    assert "user_id_created_at_idx" in plan


@pytest.mark.anyio
async def test_maintenance_creates_future_and_drops_expired_partitions(real_db):
    await real_db.pool.execute(
        """CREATE TABLE user_events_y2020m01 PARTITION OF user_events
           FOR VALUES FROM ('2020-01-01') TO ('2020-02-01')"""
    )
    dropped = await event_service.maintain_partitions(keep_months=6)
    assert dropped == 1
    names = {
        r[0]
        for r in await real_db.pool.fetch(
            "SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid "
            "WHERE i.inhparent = 'user_events'::regclass"
        )
    }
    assert "user_events_y2020m01" not in names
    assert len([n for n in names if n.startswith("user_events_y")]) >= 3  # this month + 2 ahead


@pytest.mark.anyio
async def test_maintenance_adopts_rows_left_in_the_default_partition(real_db):
    """A month whose partition was late must not break partition creation forever."""
    await add_event(real_db, "view", CARS, days_ago=75)  # a past month: no partition yet
    assert await real_db.fetchval("SELECT count(*) FROM user_events_default") == 1

    await event_service.maintain_partitions(keep_months=6)

    assert await real_db.fetchval("SELECT count(*) FROM user_events_default") == 0
    assert await real_db.fetchval("SELECT count(*) FROM user_events") == 1
    moved_to = await real_db.fetchval("SELECT tableoid::regclass::text FROM user_events")
    assert moved_to.startswith("user_events_y")
    # New events for that month now go to its partition.
    await add_event(real_db, "view", CARS, days_ago=75)
    assert await real_db.fetchval("SELECT count(*) FROM user_events_default") == 0
