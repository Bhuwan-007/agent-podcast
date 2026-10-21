"""FastAPI Gateway for AI Roundtable."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from gateway.tracing import trace_logger
from gateway.session import VoiceSession
from gateway.voice.tts import ElevenLabsTTS, TTSConfig
from agents.llm import SingleExpert

# Keep worktree configuration local; do not discover a parent's .env.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Semaphores must not survive across application event loops (e.g. tests).
    if hasattr(app.state, "tts"):
        del app.state.tts
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
    if hasattr(app.state, 'runtime'):
        await app.state.runtime.close()
        del app.state.runtime
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


def a1_services():
    """Lazy configuration keeps /health usable without provider credentials."""
    expert = SingleExpert()
    if not hasattr(app.state, "tts"):
        app.state.tts = ElevenLabsTTS(TTSConfig.from_env())
    return expert, app.state.tts


@app.websocket("/ws")
async def websocket_session(socket: WebSocket):
    # CORSMiddleware does not validate WebSocket origins. CLI clients have no Origin.
    allowed = origins + ["http://localhost:8000", "http://127.0.0.1:8000"]
    if socket.headers.get("origin") and socket.headers["origin"] not in allowed:
        await socket.close(code=1008)
        return
    await socket.accept()
    if os.getenv('ROUNDTABLE_MODE') == 'panel':
        from gateway.panel_session import PanelSession
        await PanelSession(socket, panel_services).run()
    else:
        await VoiceSession(socket, a1_services).run()


async def panel_services(session_id, logger):
    from gateway.runtime import AgentRuntime
    if not hasattr(app.state, 'runtime'):
        app.state.runtime = AgentRuntime()
    if not hasattr(app.state, 'tts'):
        app.state.tts = ElevenLabsTTS(TTSConfig.from_env())
    return await app.state.runtime.pool(session_id, logger), app.state.tts


@app.get("/dev/a1", include_in_schema=False)
async def a1_test_page():
    """Backend-owned integration check; does not alter Lane B's frontend."""
    return FileResponse(Path(__file__).with_name("dev_a1.html"))


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("GATEWAY_HOST", "0.0.0.0")
    port = int(os.getenv("GATEWAY_PORT", "8000"))
    uvicorn.run("gateway.main:app", host=host, port=port, reload=True)
