"""MOCK TRANSPORT tests: these do not prove live ElevenLabs synthesis."""

import asyncio
import base64
import json
from contextlib import aclosing, asynccontextmanager

import pytest

from gateway.voice import tts


class MockSocket:
    def __init__(self, frames):
        self.frames = asyncio.Queue()
        for frame in frames:
            self.frames.put_nowait(json.dumps(frame))
        self.sent = []
        self.closed = False

    async def send(self, message):
        self.sent.append(json.loads(message))

    async def recv(self):
        return await self.frames.get()


def install_transport(monkeypatch, frames):
    socket = MockSocket(frames)
    connections = []

    @asynccontextmanager
    async def mock_connect(uri, **kwargs):
        connections.append(uri)
        try:
            yield socket
        finally:
            socket.closed = True

    monkeypatch.setattr(tts, "connect", mock_connect)
    return socket, connections


async def words():
    yield "Hello "
    yield "roundtable. "


def adapter(**kwargs):
    return tts.ElevenLabsTTS(tts.TTSConfig(api_key="test-secret", **kwargs))


@pytest.mark.asyncio
@pytest.mark.parametrize("final_key", ["isFinal", "is_final"])
async def test_stream_and_protocol(monkeypatch, final_key, caplog):
    socket, connections = install_transport(monkeypatch, [
        {"audio": base64.b64encode(b"first").decode()},
        {"audio": base64.b64encode(b"last").decode(), final_key: True},
    ])
    with caplog.at_level("INFO"):
        result = [chunk async for chunk in adapter().stream(words(), "voice/one")]
    assert result == [b"first", b"last"]
    assert socket.sent == [{"text": " ", "xi_api_key": "test-secret"},
                           {"text": "Hello "}, {"text": "roundtable. "}, {"text": ""}]
    assert "voice%2Fone/stream-input?" in connections[0]
    assert "model_id=eleven_flash_v2_5" in connections[0]
    assert "test-secret" not in connections[0] + caplog.text
    assert "tts_first_audio_received_ms" in caplog.text
    assert socket.closed


@pytest.mark.asyncio
@pytest.mark.parametrize("frame", [{"audio": "%%%"}, {"error": "private provider detail"},
                                  {"is_final": True}, ["invalid"]])
async def test_bad_response_closes_socket(monkeypatch, frame):
    socket, _ = install_transport(monkeypatch, [frame])
    with pytest.raises(tts.TTSError):
        _ = [chunk async for chunk in adapter().stream(words(), "voice")]
    assert socket.closed


@pytest.mark.asyncio
async def test_cancellation_closes_socket_and_text_source(monkeypatch):
    socket, _ = install_transport(monkeypatch, [])
    entered = asyncio.Event()
    cleaned = asyncio.Event()

    async def slow_text():
        try:
            entered.set()
            await asyncio.Event().wait()
            yield "never"
        finally:
            cleaned.set()

    stream = adapter().stream(slow_text(), "voice")
    pending = asyncio.create_task(anext(stream))
    await asyncio.wait_for(entered.wait(), 1)
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending
    assert socket.closed and cleaned.is_set()


@pytest.mark.asyncio
async def test_early_exit_releases_capacity(monkeypatch):
    socket, connections = install_transport(monkeypatch, [
        {"audio": base64.b64encode(b"first").decode()},
    ])
    service = adapter(max_concurrency=1)
    async with aclosing(service.stream(words(), "voice")) as stream:
        assert await anext(stream) == b"first"
    assert socket.closed
    socket.frames.put_nowait(json.dumps({"audio": "eA==", "is_final": True}))
    assert [chunk async for chunk in service.stream(words(), "voice")] == [b"x"]
    assert len(connections) == 2


@pytest.mark.asyncio
async def test_concurrent_turn_waits_for_capacity(monkeypatch):
    socket, connections = install_transport(monkeypatch, [
        {"audio": base64.b64encode(b"first").decode()},
    ])
    service = adapter(max_concurrency=1)
    async with aclosing(service.stream(words(), "voice")) as first:
        await anext(first)
        async with aclosing(service.stream(words(), "other")) as second:
            attempted = asyncio.Event()

            async def consume_second():
                attempted.set()
                return await anext(second)

            pending = asyncio.create_task(consume_second())
            await attempted.wait()
            assert len(connections) == 1
            assert not pending.done()
            await first.aclose()
            socket.frames.put_nowait(json.dumps({"audio": "eA==", "is_final": True}))
            assert await asyncio.wait_for(pending, 1) == b"x"
            assert len(connections) == 2


@pytest.mark.asyncio
async def test_timeout_and_sender_failure(monkeypatch):
    socket, _ = install_transport(monkeypatch, [])
    with pytest.raises(tts.TTSError, match="timed out"):
        _ = [chunk async for chunk in adapter(turn_timeout_s=0.02).stream(words(), "voice")]
    assert socket.closed

    async def broken_text():
        raise RuntimeError("sensitive source detail")
        yield "unreachable"

    with pytest.raises(tts.TTSError, match="input stream failed"):
        _ = [chunk async for chunk in adapter().stream(broken_text(), "voice")]


def test_missing_configuration():
    with pytest.raises(ValueError):
        tts.TTSConfig(api_key="")
    with pytest.raises(ValueError):
        tts.TTSConfig(api_key="secret", max_concurrency=0)
    assert "secret" not in repr(tts.TTSConfig(api_key="secret"))
