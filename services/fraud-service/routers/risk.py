from fastapi import APIRouter, Depends
from security import verify_admin
import database
from typing import Dict

router = APIRouter(prefix="/fraud/risk", dependencies=[Depends(verify_admin)], tags=["Risk"])

@router.get("/{user_id}", response_model=Dict)
async def get_risk_score(user_id: str):
    async with database.pg_pool.acquire() as conn:
        records = await conn.fetch('''
            SELECT risk_score FROM fraud_signals 
            WHERE user_id = $1
        ''', user_id)
        
    if not records:
        return {"user_id": user_id, "total_risk_score": 0.0, "risk_level": "LOW"}
        
    total_score = sum(record['risk_score'] for record in records)
    
    risk_level = "LOW"
    if total_score > 1.0:
        risk_level = "HIGH"
    elif total_score > 0.5:
        risk_level = "MEDIUM"
        
    return {
        "user_id": user_id,
        "total_risk_score": round(total_score, 2),
        "risk_level": risk_level,
        "signal_count": len(records)
    }
