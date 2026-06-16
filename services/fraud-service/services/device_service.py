from datetime import datetime
import database
from schemas import DeviceCheckRequest, DeviceCheckResponse

async def check_device(request: DeviceCheckRequest) -> DeviceCheckResponse:
    # 1. Save device fingerprint to MongoDB
    await database.mongo_db.device_fingerprints.insert_one({
        "user_id": request.user_id,
        "device_id": request.device_id,
        "ip_address": request.ip_address,
        "user_agent": request.user_agent,
        "timestamp": datetime.utcnow()
    })

    # 2. Check for multiple accounts on the same device
    pipeline_device = [
        {"$match": {"device_id": request.device_id}},
        {"$group": {"_id": "$user_id"}}
    ]
    device_users = await database.mongo_db.device_fingerprints.aggregate(pipeline_device).to_list(length=100)
    
    # 3. Check for multiple accounts on the same IP
    pipeline_ip = [
        {"$match": {"ip_address": request.ip_address}},
        {"$group": {"_id": "$user_id"}}
    ]
    ip_users = await database.mongo_db.device_fingerprints.aggregate(pipeline_ip).to_list(length=100)

    unique_device_users = len(device_users)
    unique_ip_users = len(ip_users)
    
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
