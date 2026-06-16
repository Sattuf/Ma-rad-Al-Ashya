from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import connect_to_mongo, close_mongo_connection, connect_to_postgres, close_postgres_connection

from routers import device, transaction, risk, admin

import os
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator

sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await connect_to_postgres()
    yield
    await close_mongo_connection()
    await close_postgres_connection()

app = FastAPI(title="Fraud Service", version="1.0.0", lifespan=lifespan)

Instrumentator().instrument(app).expose(app)

app.include_router(device.router)
app.include_router(transaction.router)
app.include_router(risk.router)
app.include_router(admin.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
