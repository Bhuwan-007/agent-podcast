"""Real TTS diagnostic: safe response structure/status only; no audio saved."""

import asyncio
import base64
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from gateway.voice import tts


async def main():
    load_dotenv(override=True)
    info = {"mocked": False, "audio_bytes": 0, "frames": []}
    original = tts.connect

    def inspect_payload(raw):
        try:
            data = json.loads(raw)
            record = {"fields": sorted(data.keys())}
            # Record only short machine codes, never provider message text.
            for field in ("error", "detail"):
                detail = data.get(field)
                code = detail.get("status") if isinstance(detail, dict) else detail
                if isinstance(code, str) and re.fullmatch(r"[a-z_]{1,80}", code):
                    record["error_code"] = code
            if type(data.get("code")) is int:
                record["code"] = data["code"]
            info["frames"].append(record)
        except Exception:
            info["non_json_frame"] = True

    @asynccontextmanager
    async def observed_connect(*args, **kwargs):
        try:
            async with original(*args, **kwargs) as socket:
                info["handshake_completed"] = True
                class Observer:
                    async def send(self, value):
                        await socket.send(value)
                    async def recv(self):
                        raw = await socket.recv()
                        inspect_payload(raw)
                        return raw
                yield Observer()
        except Exception as error:
            info["transport_error_type"] = type(error).__name__
            response = getattr(error, "response", None)
            if response is not None:
                info["http_status"] = response.status_code
                inspect_payload(response.body)
            raise

    async def text():
        yield "This is a live audio integration test. "

    tts.connect = observed_connect
    started = time.perf_counter()
    try:
        async for chunk in tts.ElevenLabsTTS(tts.TTSConfig.from_env()).stream(text(), os.environ["VOICE_ID_AGENT1"]):
            info["audio_bytes"] += len(chunk)
        info["completed"] = True
    except tts.TTSError as error:
        info["completed"] = False
        info["public_error"] = str(error)
    finally:
        tts.connect = original
    info["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
    Path("docs/a1_tts_diagnostic.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
