from fastapi import APIRouter, Depends
from security import verify_internal
from schemas import TransactionAnalyzeRequest, TransactionAnalyzeResponse
from services.anomaly_detection_service import analyze_transaction

router = APIRouter(prefix="/fraud/transaction", dependencies=[Depends(verify_internal)], tags=["Transaction"])

@router.post("/analyze", response_model=TransactionAnalyzeResponse)
async def transaction_analyze(request: TransactionAnalyzeRequest):
    return await analyze_transaction(request)
