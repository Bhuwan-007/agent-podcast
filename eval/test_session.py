"""Real session logic with MOCK model/TTS services; no live-provider claims."""

import asyncio
import base64
import json

import pytest
from fastapi.testclient import TestClient

from gateway import main, session
from gateway.tracing import TraceLogger
from gateway.voice.tts import TTSError


class Socket:
    def __init__(self):
        self.events = []
        self.queue = asyncio.Queue()
        self.closed = False

    async def send_json(self, event):
        assert not self.closed
        self.events.append(event)
        await self.queue.put(event)

    async def close(self, **kwargs):
        self.closed = True

    async def until(self, kind):
        async with asyncio.timeout(2):
            while True:
                event = await self.queue.get()
                if event["type"] == kind:
                    return event


class Expert:
    def __init__(self):
        self.questions = []

    async def respond(self, topic, persona, question):
        self.questions.append(question)
        return ["Review remains necessary."]


class Audio:
    def __init__(self):
        self.texts = []
        self.cleaned = False

    async def stream(self, chunks, voice):
        try:
            self.texts += [text async for text in chunks]
            yield b"MOCK audio bytes"
        finally:
            self.cleaned = True


@pytest.fixture
def services(monkeypatch, tmp_path):
    monkeypatch.setenv("VOICE_ID_AGENT1", "mock-voice")
    monkeypatch.setattr(session, "trace_logger", TraceLogger(tmp_path))
    return Expert(), Audio()


@pytest.mark.asyncio
async def test_start_uses_exact_prompt_and_playback_authority(services):
    socket = Socket()
    voice = session.VoiceSession(socket, lambda: services)
    try:
        await voice.handle({"type": "start_session", "topic_id": "topic_1"})
        end = await socket.until("turn_end")
        assert end["status"] == "completed"
        topic = next(e for e in socket.events if e["type"] == "topic_config")
        assert services[0].questions == [topic["opening_prompt"]]
        assert [a["agent_id"] for a in topic["agents"] if a["available"]] == ["ai_engineer"]
        assert not any(e["type"] == "speaker_active" for e in socket.events)
        assert not any(e.get("state") == "agent_speaking" for e in socket.events)
        chunk = next(e for e in socket.events if e["type"] == "audio_chunk")
        assert base64.b64decode(chunk["data_b64"]) == b"MOCK audio bytes"
        assert chunk["epoch"] == end["epoch"] == 0
        ack = {"turn_id": end["turn_id"], "epoch": end["epoch"], "sentence_idx": 0}
        count = len(socket.events)
        await voice.handle({"type": "playback_started", **ack, "epoch": -1})
        assert len(socket.events) == count
        await voice.handle({"type": "playback_started", **ack})
        assert socket.events[-1]["state"] == "agent_speaking"
        await voice.handle({"type": "playback_stopped", **ack, "reason": "finished"})
        await asyncio.wait_for(voice.worker, 2)
        assert voice.active is None
        assert any(e["type"] == "transcript" and e["final"] for e in socket.events)
        await voice.handle({"type": "user_utterance", "text": "What about review?", "final": True,
                            "input_mode": "text", "target_hint": "ai_engineer"})
        await asyncio.wait_for(socket.until("audio_chunk"), 2)
        assert voice.turn_id == 2
        assert any(e["type"] == "transcript" and e.get("speaker") == "human"
                   and e["text"] == "What about review?" for e in socket.events)
    finally:
        await voice.cancel_turn()


@pytest.mark.asyncio
async def test_end_cancels_inflight_audio_and_no_post_end_events(services):
    entered = asyncio.Event()
    cleaned = asyncio.Event()

    class SlowAudio:
        async def stream(self, chunks, voice):
            try:
                entered.set()
                await asyncio.Event().wait()
                yield b"never"
            finally:
                cleaned.set()

    socket = Socket()
    voice = session.VoiceSession(socket, lambda: (services[0], SlowAudio()))
    await voice.handle({"type": "start_session", "topic_id": "topic_1"})
    await asyncio.wait_for(entered.wait(), 2)
    await voice.handle({"type": "end_session"})
    assert cleaned.is_set() and socket.closed and voice.ended
    assert socket.events[-1]["state"] == "ended"
    assert socket.events[-1]["epoch"] == 1
    assert not any(e["type"] == "audio_chunk" for e in socket.events)


@pytest.mark.asyncio
async def test_provider_failure_invalidates_output_without_leaking(services):
    class BadAudio:
        async def stream(self, chunks, voice):
            raise TTSError("secret provider message")
            yield b"never"

    socket = Socket()
    voice = session.VoiceSession(socket, lambda: (services[0], BadAudio()))
    await voice.handle({"type": "start_session", "topic_id": "topic_1"})
    await asyncio.wait_for(voice.worker, 2)
    assert any(e.get("status") == "failed" for e in socket.events)
    assert socket.events[-1]["code"] == "tts_failed"
    assert voice.epoch == 1 and voice.active is None
    assert "secret provider" not in json.dumps(socket.events)


@pytest.mark.asyncio
async def test_unavailable_topic_and_missing_config(services):
    socket = Socket()
    def missing():
        raise ValueError("private configuration")
    voice = session.VoiceSession(socket, missing)
    await voice.handle({"type": "start_session", "topic_id": "../../.env"})
    assert socket.events[-1]["code"] == "topic_unavailable"
    await voice.handle({"type": "start_session", "topic_id": "topic_1"})
    assert socket.events[-1]["state"] == "recovery"
    assert voice.topic is None
    assert "private configuration" not in json.dumps(socket.events)


@pytest.mark.asyncio
async def test_barge_in_discards_old_turn_but_does_not_claim_routing(services):
    socket = Socket()
    voice = session.VoiceSession(socket, lambda: services)
    try:
        await voice.handle({"type": "start_session", "topic_id": "topic_1"})
        turn = await socket.until("turn_end")
        await voice.handle({"type": "barge_in", "turn_id": turn["turn_id"], "epoch": turn["epoch"]})
        assert voice.epoch == 1 and voice.active is None
        assert any(e.get("status") == "interrupted" for e in socket.events)
        assert not any(e["type"] == "routing" for e in socket.events)
        count = len(socket.events)
        await voice.handle({"type": "playback_started", "turn_id": turn["turn_id"], "epoch": 0, "sentence_idx": 0})
        assert len(socket.events) == count
    finally:
        await voice.cancel_turn()


def test_websocket_route_and_origin(monkeypatch, services):
    monkeypatch.setattr(main, "a1_services", lambda: services)
    with TestClient(main.app) as client:
        with client.websocket_connect("/ws", headers={"origin": "http://localhost:5173"}) as ws:
            ws.send_json({"type": "start_session", "topic_id": "topic_1"})
            types = []
            while True:
                event = ws.receive_json()
                types.append(event["type"])
                if event["type"] == "turn_end":
                    break
            assert all(t in types for t in ["topic_config", "session_state", "turn_start", "audio_chunk", "transcript"])
            ws.send_json({"type": "end_session"})
            assert ws.receive_json()["state"] == "ended"
        from starlette.websockets import WebSocketDisconnect
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws", headers={"origin": "https://untrusted.example"}):
                pass
        page = client.get("/dev/a1")
        assert page.status_code == 200 and "Single-expert integration check" in page.text


@pytest.mark.asyncio
async def test_end_cancels_model_before_tts(services):
    entered, cleaned = asyncio.Event(), asyncio.Event()
    class SlowExpert:
        async def respond(self, *args):
            try:
                entered.set()
                await asyncio.Event().wait()
            finally:
                cleaned.set()
    socket = Socket()
    voice = session.VoiceSession(socket, lambda: (SlowExpert(), services[1]))
    await voice.handle({"type": "start_session", "topic_id": "topic_1"})
    await asyncio.wait_for(entered.wait(), 2)
    await voice.handle({"type": "end_session"})
    assert cleaned.is_set() and services[1].texts == []
    assert socket.events[-1]["state"] == "ended"


@pytest.mark.parametrize("raw", ["not JSON", "[]", '{"type":123}'])
def test_malformed_events_close_cleanly(raw):
    from starlette.websockets import WebSocketDisconnect
    with TestClient(main.app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_text(raw)
            with pytest.raises(WebSocketDisconnect) as error:
                ws.receive_json()
            assert error.value.code == 1008
