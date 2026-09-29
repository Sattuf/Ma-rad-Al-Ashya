"""fraud-service tables on a real Postgres (db/migrations 0001 + 0004). Skipped unless
DATABASE_URL is set; CI runs it in the integration job.

    DATABASE_URL=postgresql://... python -m pytest tests/test_db_integration.py
"""
import asyncio
import os
from pathlib import Path

import asyncpg
import pytest

import database
from schemas import DeviceCheckRequest
from services.device_service import check_device

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")
MIGRATIONS = Path(__file__).resolve().parents[3] / "db" / "migrations"


@pytest.fixture
def pool(monkeypatch):
    schema = f"it_fraud_{os.getpid()}"

    async def setup():
        admin = await asyncpg.connect(DATABASE_URL)
        await admin.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE; CREATE SCHEMA {schema}")
        await admin.close()
        p = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=8,
                                      server_settings={"search_path": f"{schema},public"})
        async with p.acquire() as conn:
            for f in sorted(MIGRATIONS.glob("*.sql")):
                await conn.execute(f.read_text())
        return p

    loop = asyncio.new_event_loop()
    p = loop.run_until_complete(setup())
    monkeypatch.setattr(database, "pg_pool", p)
    yield loop, p

    async def teardown():
        async with p.acquire() as conn:
            await conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        await p.close()

    loop.run_until_complete(teardown())
    loop.close()


def check(loop, user, device="dev-1", ip="10.0.0.1"):
    return loop.run_until_complete(check_device(DeviceCheckRequest(user_id=user, device_id=device, ip_address=ip)))


def test_repeated_checks_store_one_row_per_pair(pool):
    loop, p = pool
    for _ in range(25):
        check(loop, "alice")
    assert loop.run_until_complete(p.fetchval("SELECT count(*) FROM device_accounts")) == 1
    assert loop.run_until_complete(p.fetchval("SELECT count(*) FROM ip_accounts")) == 1


def test_counts_distinct_accounts_per_device_and_raises_risk(pool):
    loop, p = pool
    assert check(loop, "u1").risk_level == "LOW"
    assert check(loop, "u2").risk_level == "MEDIUM"  # two accounts on the device
    result = check(loop, "u3")                        # three
    assert result.risk_level == "HIGH"
    signals = loop.run_until_complete(p.fetchval("SELECT count(*) FROM fraud_signals WHERE user_id = 'u3'"))
    assert signals == 1


def test_ip_sharing_counts_only_recent_accounts(pool):
    loop, p = pool
    for i in range(6):
        check(loop, f"old{i}", device=f"d{i}", ip="192.0.2.7")
    loop.run_until_complete(p.execute("UPDATE ip_accounts SET last_seen = now() - interval '60 days'"))
    assert "same IP" not in check(loop, "fresh", device="dx", ip="192.0.2.7").message


def test_invalid_ip_is_ignored_not_an_error(pool):
    loop, p = pool
    assert check(loop, "u9", ip="not-an-ip").risk_level == "LOW"
    assert loop.run_until_complete(p.fetchval("SELECT count(*) FROM ip_accounts")) == 0


def test_user_risk_is_an_index_only_scan(pool):
    loop, p = pool

    async def run():
        await p.execute(
            """INSERT INTO fraud_signals (user_id, signal_type, risk_score)
               SELECT 'user' || (g % 5000), 'X', random() FROM generate_series(1, 100000) g"""
        )
        # VACUUM sets the visibility map that index-only scans rely on (autovacuum does it
        # in production); it cannot run inside the multi-statement block above.
        await p.execute("VACUUM ANALYZE fraud_signals")
        rows = await p.fetch(
            "EXPLAIN SELECT coalesce(sum(risk_score), 0), count(*) FROM fraud_signals WHERE user_id = 'user42'"
        )
        return "\n".join(r[0] for r in rows)

    plan = loop.run_until_complete(run())
    assert "Index Only Scan using idx_fraud_signals_user" in plan


def test_transaction_features_and_anomaly_signal_in_one_statement(pool, monkeypatch):
    loop, p = pool
    import services.anomaly_detection_service as anomaly
    from schemas import TransactionAnalyzeRequest

    class AlwaysAnomalous:
        def predict(self, features):
            return [-1]

        def score_samples(self, features):
            return [-0.9]

    monkeypatch.setattr(anomaly, "model", AlwaysAnomalous())
    request = TransactionAnalyzeRequest(
        transaction_id="t-1", user_id="buyer", amount=1234.56, currency="USD",
        merchant_category_code="5732", location_country="SY",
    )
    result = loop.run_until_complete(anomaly.analyze_transaction(request))
    assert result.is_anomaly

    row = loop.run_until_complete(p.fetchrow("SELECT amount, is_anomaly FROM transaction_features"))
    assert str(row["amount"]) == "1234.56" and row["is_anomaly"] is True
    assert loop.run_until_complete(
        p.fetchval("SELECT count(*) FROM fraud_signals WHERE signal_type = 'TRANSACTION_ANOMALY'")
    ) == 1
