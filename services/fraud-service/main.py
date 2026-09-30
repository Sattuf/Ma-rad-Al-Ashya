# Logging first: modules imported below log while loading (e.g. the anomaly model).
from logging_setup import setup_logging

setup_logging("fraud-service")

from fastapi import FastAPI  # noqa: E402
from contextlib import asynccontextmanager
import database

from routers import device, transaction, risk, admin
from security import require_secret

import os
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator
from logging_setup import RequestContextMiddleware, scrub_sentry_event

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.1,
    before_send=scrub_sentry_event,
    before_send_transaction=scrub_sentry_event,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    require_secret("JWT_ACCESS_SECRET")
    require_secret("INTERNAL_SECRET")
    await database.connect_to_postgres()
    yield
    await database.close_postgres_connection()

app = FastAPI(title="Fraud Service", version="1.0.0", lifespan=lifespan)

Instrumentator().instrument(app).expose(app)
# Added last so it runs first: everything after it sees the request ID.
app.add_middleware(RequestContextMiddleware)

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
