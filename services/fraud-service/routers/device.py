from fastapi import APIRouter, Depends
from security import verify_internal
from schemas import DeviceCheckRequest, DeviceCheckResponse
from services.device_service import check_device

router = APIRouter(prefix="/fraud/device", dependencies=[Depends(verify_internal)], tags=["Device"])

@router.post("/check", response_model=DeviceCheckResponse)
async def device_check(request: DeviceCheckRequest):
    return await check_device(request)
