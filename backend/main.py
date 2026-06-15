from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import network as network_router
from routers import security as security_router
from routers import threats as threats_router
from routers import mock


settings = get_settings()

app = FastAPI(title="K8s Dashboard API")

# CORS configuration: restrict to frontend domain only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "K8s Dashboard API is running"}


# Include mock endpoints first (fallback)
app.include_router(mock.router)

# Include real endpoints
app.include_router(network_router.router, prefix="/api/network", tags=["network"])
app.include_router(security_router.router, prefix="/api/security", tags=["security"])
app.include_router(threats_router.router, prefix="/api/threats", tags=["threats"])