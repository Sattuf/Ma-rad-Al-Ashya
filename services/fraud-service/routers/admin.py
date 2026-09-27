from fastapi import APIRouter, Depends, Query
from typing import List
from schemas import FraudSignalResponse, AdminActionRequest
import database
from ml.train_anomaly_model import train_model
from security import verify_admin

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
        count = await conn.fetchval('SELECT COUNT(*) FROM fraud_signals')
        avg_risk = await conn.fetchval('SELECT AVG(risk_score) FROM fraud_signals')
    
    return {
        "total_signals": count or 0,
        "average_risk": round(avg_risk or 0, 2)
    }

@router.post("/action")
async def admin_action(request: AdminActionRequest, admin: dict = Depends(verify_admin)):
    # In a real system, this would call user-service to block or flag the user
    return {"message": f"Action {request.action} applied to user {request.user_id}"}

@router.post("/train-model")
async def trigger_train_model(admin: dict = Depends(verify_admin)):
    try:
        model_path = train_model()
        from services.anomaly_detection_service import load_model
        load_model() # Reload the model in memory
        return {"message": "Model trained successfully", "path": model_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
