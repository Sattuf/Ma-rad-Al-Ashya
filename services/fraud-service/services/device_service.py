import ipaddress
from typing import Optional

import database
from schemas import DeviceCheckRequest, DeviceCheckResponse

# Shared IPs are noisy over long periods (mobile carriers, recycled addresses): only
# accounts seen on the IP recently count.
IP_WINDOW_DAYS = 30

# One statement: record the (device, user) and (ip, user) pairs, then count the OTHER
# accounts on the same device / IP (a data-modifying CTE's rows are not visible to the
# outer SELECT, so the caller is added back as + 1).
#
# The pairs are upserts on their primary keys, so the tables hold one row per distinct pair
# however many checks are made; both counts are short ranges of those keys. last_seen is
# only rewritten when it is over an hour old, so a user re-checking the same device does
# not rewrite the row every time.
CHECK_SQL = f"""
WITH device AS (
  INSERT INTO device_accounts (device_id, user_id, last_user_agent)
  VALUES ($1, $2, $4)
  ON CONFLICT (device_id, user_id) DO UPDATE
    SET last_seen = now(), last_user_agent = coalesce(EXCLUDED.last_user_agent, device_accounts.last_user_agent)
    WHERE device_accounts.last_seen < now() - interval '1 hour'
), ip AS (
  INSERT INTO ip_accounts (ip_address, user_id)
  SELECT $3::inet, $2 WHERE $3::inet IS NOT NULL
  ON CONFLICT (ip_address, user_id) DO UPDATE
    SET last_seen = now()
    WHERE ip_accounts.last_seen < now() - interval '1 hour'
)
SELECT
  1 + (SELECT count(*) FROM device_accounts WHERE device_id = $1 AND user_id <> $2) AS device_users,
  CASE WHEN $3::inet IS NULL THEN 1
       ELSE 1 + (SELECT count(*) FROM ip_accounts
                 WHERE ip_address = $3::inet AND user_id <> $2
                   AND last_seen > now() - interval '{IP_WINDOW_DAYS} days')
  END AS ip_users
"""


def _valid_ip(value: str) -> Optional[str]:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except (ValueError, AttributeError):
        return None


async def check_device(request: DeviceCheckRequest) -> DeviceCheckResponse:
    async with database.pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            CHECK_SQL, request.device_id, request.user_id, _valid_ip(request.ip_address), request.user_agent
        )

    unique_device_users = row["device_users"]
    unique_ip_users = row["ip_users"]
    
    risk_score = 0.0
    risk_level = "LOW"
    message = "Device looks safe."
    
    if unique_device_users > 2:
        risk_score += 0.8
        risk_level = "HIGH"
        message = "Multiple accounts detected on the same device."
    elif unique_device_users == 2:
        risk_score += 0.4
        risk_level = "MEDIUM"
        message = "Two accounts detected on the same device."
        
    if unique_ip_users > 5:
        risk_score += 0.5
        if risk_level != "HIGH":
            risk_level = "MEDIUM"
        message += " High number of accounts from the same IP."
        
    # Cap risk score
    risk_score = min(1.0, risk_score)
    
    # If high risk, save a fraud signal to Postgres
    if risk_score > 0.5:
        async with database.pg_pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO fraud_signals (user_id, signal_type, description, risk_score)
                VALUES ($1, $2, $3, $4)
            ''', request.user_id, "DEVICE_RISK", message, risk_score)
            
    return DeviceCheckResponse(
        risk_level=risk_level,
        risk_score=risk_score,
        message=message.strip()
    )
