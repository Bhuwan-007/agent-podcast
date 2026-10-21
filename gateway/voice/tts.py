"""Provider-only ElevenLabs streaming TTS; no browser event contract is defined here.

Callers must close the async generator (use contextlib.aclosing) on early exit.
Only spoken text belongs here; claims parsing is the caller's responsibility.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import json
import logging
import os
import time
from collections.abc import AsyncIterable, AsyncIterator
from dataclasses import dataclass, field
from urllib.parse import quote, urlencode

from websockets.asyncio.client import connect

logger = logging.getLogger(__name__)


class TTSError(RuntimeError):
    """Synthesis failed; messages deliberately exclude provider payloads/secrets."""


@dataclass(frozen=True)
class TTSConfig:
    api_key: str = field(repr=False)
    model_id: str = "eleven_flash_v2_5"
    output_format: str = "mp3_44100_128"
    max_concurrency: int = 3
    turn_timeout_s: float = 30.0

    def __post_init__(self):
        if not self.api_key.strip() or not self.model_id.strip():
            raise ValueError("TTS requires an API key and model ID")
        if self.max_concurrency < 1 or self.turn_timeout_s <= 0:
            raise ValueError("TTS concurrency and timeout must be positive")

    @classmethod
    def from_env(cls) -> TTSConfig:
        """Read existing environment configuration; never load or log credentials."""
        return cls(
            api_key=os.getenv("ELEVENLABS_API_KEY", ""),
            model_id=os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5"),
            max_concurrency=int(os.getenv("TTS_MAX_CONCURRENCY", "3")),
        )


class ElevenLabsTTS:
    """Reuse one adapter per event loop so all turns share its connection limit."""

    def __init__(self, config: TTSConfig):
        self.config = config
        self._slots = asyncio.Semaphore(config.max_concurrency)

    async def stream(self, text: AsyncIterable[str], voice_id: str) -> AsyncIterator[bytes]:
        """Yield MP3 bytes, not playback events. Cancellation is never swallowed.

        Timing measures connection-start to first received audio, NOT audible latency.
        The timeout bounds an entire synthesis, including waiting for capacity.
        """
        if not voice_id.strip():
            raise ValueError("A voice ID is required")
        uri = (
            "wss://api.elevenlabs.io/v1/text-to-speech/"
            f"{quote(voice_id, safe='')}/stream-input?"
            + urlencode({"model_id": self.config.model_id,
                         "output_format": self.config.output_format})
        )
        try:
            async with asyncio.timeout(self.config.turn_timeout_s), self._slots:
                started = time.perf_counter()
                async with connect(uri, open_timeout=10, close_timeout=2, max_queue=4) as ws:
                    await ws.send(json.dumps({"text": " ", "xi_api_key": self.config.api_key}))
                    # Bounded buffering prevents audio accumulating behind a slow consumer.
                    queue: asyncio.Queue[bytes | Exception | None] = asyncio.Queue(maxsize=1)

                    async def send_text():
                        try:
                            async for chunk in text:
                                if not isinstance(chunk, str):
                                    raise TTSError("TTS text chunks must be strings")
                                if chunk.strip():
                                    await ws.send(json.dumps({"text": chunk}))
                            await ws.send(json.dumps({"text": ""}))
                        except Exception:
                            await queue.put(TTSError("TTS input stream failed"))

                    async def receive_audio():
                        try:
                            while True:
                                data = json.loads(await ws.recv())
                                if not isinstance(data, dict) or data.get("error"):
                                    raise TTSError("TTS provider returned an error")
                                if data.get("audio"):
                                    audio = base64.b64decode(data["audio"], validate=True)
                                    if audio:
                                        await queue.put(audio)
                                # Official guide and API reference use different casing.
                                if data.get("isFinal") is True or data.get("is_final") is True:
                                    await queue.put(None)
                                    return
                        except (ValueError, TypeError, binascii.Error):
                            await queue.put(TTSError("TTS provider returned malformed data"))
                        except Exception:
                            await queue.put(TTSError("TTS provider stream failed"))

                    tasks = [asyncio.create_task(send_text()), asyncio.create_task(receive_audio())]
                    first_audio = True
                    try:
                        while True:
                            item = await queue.get()
                            if isinstance(item, Exception):
                                raise item
                            if item is None:
                                if first_audio:
                                    raise TTSError("TTS completed without audio")
                                return
                            if first_audio:
                                logger.info("tts_first_audio_received_ms=%.1f",
                                            (time.perf_counter() - started) * 1000)
                                first_audio = False
                            yield item
                    finally:
                        for task in tasks:
                            task.cancel()
                        await asyncio.gather(*tasks, return_exceptions=True)
        except TimeoutError:
            raise TTSError("TTS synthesis timed out") from None
        except TTSError:
            raise
        except Exception:
            raise TTSError("TTS connection failed") from None
