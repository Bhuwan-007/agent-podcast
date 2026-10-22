"""FastAPI Gateway for AI Roundtable."""

from __future__ import annotations

import os
import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.responses import FileResponse
from fastapi.responses import Response, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from gateway.tracing import trace_logger
from gateway.session import VoiceSession
from gateway.voice.tts import ElevenLabsTTS, TTSConfig
from agents.llm import SingleExpert
from gateway.episodes import EpisodeStore
from gateway.evidence import SOURCES
from pydantic import BaseModel, Field, field_validator

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
episode_store = EpisodeStore()

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
        episode_store.clean()
        setup_id = socket.query_params.get('setup_id')
        prepared = episode_store.prepared.pop(setup_id, None) if setup_id else None
        if setup_id and not prepared:
            await socket.send_json({'type': 'notice', 'code': 'session_lost', 'level': 'warn',
                                    'text': 'Episode setup expired. Configure it again.', 'recoverable': True})
            await socket.close(code=1008)
            return
        session = PanelSession(socket, panel_services, options=prepared['options'] if prepared else None)
        session.store = episode_store
        try:
            episode_store.register(session)
        except ValueError:
            await socket.close(code=1013, reason='Episode capacity reached')
            return
        await session.run()
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


@app.get('/dev/roundtable', include_in_schema=False)
@app.get('/', include_in_schema=False)
async def roundtable_test_page():
    return FileResponse(Path(__file__).with_name('dev_roundtable.html'))


class EpisodeOptions(BaseModel):
    duration_minutes: float = Field(default=3, ge=.25, le=30, allow_inf_nan=False)
    max_turns: int = Field(default=18, ge=3, le=20)
    voice_order: list[int] = Field(default_factory=lambda: [0, 1, 2])

    @field_validator('voice_order')
    @classmethod
    def distinct_slots(cls, value):
        if sorted(value) != [0, 1, 2]:
            raise ValueError('Choose each configured voice once')
        return value


def local_mutation(request):
    origin = request.headers.get('origin')
    if origin and origin not in origins + ['http://localhost:8000', 'http://127.0.0.1:8000']:
        raise HTTPException(403, 'Origin not allowed')
    if request.headers.get('x-roundtable-client') != '1':
        raise HTTPException(403, 'Explicit roundtable client header required')


@app.get('/api/sources')
async def sources():
    return {'sources': SOURCES, 'organizer_requirements_verified': False}


@app.get('/api/sources/{source_id}', response_class=HTMLResponse)
async def source_passage(source_id: str):
    from html import escape
    source = next((s for s in SOURCES if s['id'] == source_id), None)
    if source is None:
        raise HTTPException(404, 'Unknown source ID')
    s = {k: escape(str(v), quote=True) for k, v in source.items()}
    return HTMLResponse(f'''<!doctype html><meta charset="utf-8"><title>{s['title']}</title>
        <main style="font:18px system-ui;max-width:850px;margin:50px auto;padding:20px">
        <h1>{s['title']}</h1><p>Source ID: {s['id']} · {s['locator']}</p>
        <h2>Exact supporting passage</h2><blockquote>{s['excerpt']}</blockquote>
        <h2>Bounded interpretation</h2><p>{s['finding']}</p>
        <h2>Limitations</h2><p>{s['limitation']}</p>
        <p>This excerpt was manually checked on 2026-10-22. A citation does not automatically verify an agent's interpretation.</p>
        <a href="{s['url']}" target="_blank" rel="noopener">Open primary paper and full abstract</a></main>''')


@app.post('/api/preflight')
async def preflight(request: Request):
    local_mutation(request)
    if getattr(app.state, 'preflight_running', False):
        raise HTTPException(409, 'Preflight already running')
    app.state.preflight_running = True
    try:
        from gateway.preflight import preflight as check
        return await check()
    finally:
        app.state.preflight_running = False


@app.post('/api/episodes/prepare')
async def prepare_episode(options: EpisodeOptions, request: Request):
    local_mutation(request)
    episode_store.clean()
    if len(episode_store.prepared) >= 64:
        raise HTTPException(429, 'Too many pending setups; retry later')
    setup_id = uuid.uuid4().hex
    episode_store.prepared[setup_id] = {'created': time.monotonic(), 'options': options.model_dump()}
    return {'setup_id': setup_id, 'topic_id': 'topic_1'}


def get_episode(session_id):
    episode_store.clean()
    session = episode_store.sessions.get(session_id)
    if session is None:
        raise HTTPException(404, 'Episode expired or unknown; in-memory reports expire 60 seconds after disconnect.')
    return session


@app.get('/api/episodes/{session_id}')
async def episode_report(session_id: str):
    return get_episode(session_id).report()


@app.post('/api/episodes/{session_id}/control')
async def episode_control(session_id: str, request: Request):
    local_mutation(request)
    payload = await request.json()
    if not isinstance(payload, dict) or payload.get('action') not in ('pause', 'resume', 'finish'):
        raise HTTPException(422, 'Choose pause, resume or finish')
    session = get_episode(session_id)
    try:
        await session.control(payload['action'])
    except ValueError:
        raise HTTPException(409, 'Episode is not connected or running') from None
    return session.report()


@app.get('/api/episodes/{session_id}/export')
async def episode_export(session_id: str):
    # This exports committed text, never generated-but-unheard text or raw audio.
    report = get_episode(session_id).report()
    return Response(json.dumps(report, ensure_ascii=False, indent=2), media_type='application/json',
                    headers={'Content-Disposition': 'attachment; filename="roundtable-transcript.json"',
                             'Cache-Control': 'no-store'})


@app.post('/admin/chaos/{agent}/{action}')
async def chaos(agent: str, action: str, request: Request):
    if (os.getenv('ENABLE_CHAOS') != '1' or request.headers.get('x-demo-chaos') != '1'
            or request.client.host not in ('127.0.0.1', '::1', 'testclient')
            or request.headers.get('origin', 'http://localhost:8000') not in
                origins + ['http://localhost:8000', 'http://127.0.0.1:8000']):
        raise HTTPException(403, 'Chaos controls are disabled')
    if action not in ('kill', 'stall', 'error', 'reset') or not hasattr(app.state, 'runtime'):
        raise HTTPException(400, 'Invalid action or runtime not started')
    try:
        await app.state.runtime.chaos(agent, action)
    except Exception:
        raise HTTPException(409, 'Could not apply chaos action') from None
    return {'status': 'applied', 'agent': agent, 'action': action}


@app.websocket('/ws/a1')
async def a1_socket(socket: WebSocket):
    allowed = origins + ['http://localhost:8000', 'http://127.0.0.1:8000']
    if socket.headers.get('origin') and socket.headers['origin'] not in allowed:
        await socket.close(code=1008)
        return
    await socket.accept()
    await VoiceSession(socket, a1_services).run()


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("GATEWAY_HOST", "0.0.0.0")
    port = int(os.getenv("GATEWAY_PORT", "8000"))
    uvicorn.run("gateway.main:app", host=host, port=port, reload=True)
