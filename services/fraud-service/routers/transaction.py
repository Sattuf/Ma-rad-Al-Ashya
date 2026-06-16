from fastapi import APIRouter
from schemas import TransactionAnalyzeRequest, TransactionAnalyzeResponse
from services.anomaly_detection_service import analyze_transaction

router = APIRouter(prefix="/fraud/transaction", tags=["Transaction"])

@router.post("/analyze", response_model=TransactionAnalyzeResponse)
async def transaction_analyze(request: TransactionAnalyzeRequest):
    return await analyze_transaction(request)
