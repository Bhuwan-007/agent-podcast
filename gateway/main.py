"""FastAPI Gateway for AI Roundtable."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gateway.tracing import trace_logger

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure logs directory exists and record initial gateway startup trace
    await trace_logger.log_event(
        trace_id="system_init",
        turn_id=None,
        from_entity="gateway",
        to_entity="all",
        msg_type="gateway.startup",
        payload={"service": "ai-roundtable-gateway", "status": "running"},
    )
    yield
    # Shutdown
    await trace_logger.log_event(
        trace_id="system_shutdown",
        turn_id=None,
        from_entity="gateway",
        to_entity="all",
        msg_type="gateway.shutdown",
        payload={"service": "ai-roundtable-gateway", "status": "stopped"},
    )


app = FastAPI(
    title="AI Roundtable Gateway",
    description="Live voice multi-agent podcast gateway (FOSS Forge 2.0)",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration per contracts section 8 (allow frontend dev server)
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins: List[str] = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint for container orchestrators and readiness probes."""
    return {
        "status": "ok",
        "service": "ai-roundtable-gateway",
        "version": "0.1.0",
    }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("GATEWAY_HOST", "0.0.0.0")
    port = int(os.getenv("GATEWAY_PORT", "8000"))
    uvicorn.run("gateway.main:app", host=host, port=port, reload=True)
