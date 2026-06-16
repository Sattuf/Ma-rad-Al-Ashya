from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class DeviceCheckRequest(BaseModel):
    user_id: str
    device_id: str
    ip_address: str
    user_agent: Optional[str] = None

class DeviceCheckResponse(BaseModel):
    risk_level: str
    risk_score: float
    message: str

class TransactionAnalyzeRequest(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    currency: str
    merchant_category_code: str
    location_country: str
    timestamp: Optional[str] = None

class TransactionAnalyzeResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    message: str

class FraudSignalResponse(BaseModel):
    id: int
    user_id: str
    signal_type: str
    description: str
    risk_score: float
    created_at: datetime

class AdminActionRequest(BaseModel):
    user_id: str
    action: str # e.g., "BLOCK", "FLAG", "DISMISS"
    reason: Optional[str] = None
