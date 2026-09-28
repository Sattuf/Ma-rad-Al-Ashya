import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from schemas import FraudSignalResponse, AdminActionRequest
import database
from ml.train_anomaly_model import train_model
from security import require_secret, verify_admin

router = APIRouter(prefix="/fraud/admin", tags=["Admin"])


@router.get("/signals", response_model=List[FraudSignalResponse])
async def get_signals(admin: dict = Depends(verify_admin), limit: int = Query(50, ge=1, le=200)):
    async with database.pg_pool.acquire() as conn:
        records = await conn.fetch('''
            SELECT id, user_id, signal_type, description, risk_score, created_at
            FROM fraud_signals
            ORDER BY created_at DESC
            LIMIT $1
        ''', limit)
    return [dict(record) for record in records]

@router.get("/dashboard")
async def get_dashboard(admin: dict = Depends(verify_admin)):
    async with database.pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS total,
                   AVG(risk_score) AS avg_risk,
                   COUNT(*) FILTER (WHERE risk_score >= 0.7 AND created_at >= now() - interval '7 days') AS high_risk_7d,
                   COUNT(DISTINCT user_id) FILTER (WHERE risk_score >= 0.7 AND created_at >= now() - interval '7 days') AS high_risk_users_7d
            FROM fraud_signals
            """
        )
    row = dict(row or {})
    return {
        "total_signals": row.get("total") or 0,
        "average_risk": round(row.get("avg_risk") or 0, 2),
        "high_risk_signals_7d": row.get("high_risk_7d") or 0,
        "high_risk_users_7d": row.get("high_risk_users_7d") or 0,
    }

USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://users-service:3007")


@router.post("/action")
async def admin_action(request: AdminActionRequest, admin: dict = Depends(verify_admin)):
    """Applies a real action; never reports success for something that did not happen.

    - lock: suspends the account through users-service (owner of the users.status column).
    - flag: records a manual high-risk signal so the account stays on the watch list.
    """
    if request.action == "lock":
        try:
            async with httpx.AsyncClient(timeout=5) as http:
                res = await http.put(
                    f"{USERS_SERVICE_URL}/users/{request.user_id}/status",
                    json={"status": "suspended"},
                    headers={"x-internal-secret": require_secret("INTERNAL_SECRET")},
                )
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="users-service unavailable; the account was not suspended")
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"users-service refused the suspension ({res.status_code})")
    elif request.action == "flag":
        async with database.pg_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO fraud_signals (user_id, signal_type, description, risk_score) VALUES ($1, 'manual_flag', $2, 0.8)",
                request.user_id,
                (request.reason or "")[:500] or f"Flagged by admin {admin.get('sub', '')}",
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported action (use 'lock' or 'flag')")
    return {"action": request.action, "user_id": request.user_id, "applied": True}

@router.post("/train-model")
async def trigger_train_model(admin: dict = Depends(verify_admin)):
    try:
        model_path = train_model()
        from services.anomaly_detection_service import load_model
        load_model() # Reload the model in memory
        return {"message": "Model trained successfully", "path": model_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
