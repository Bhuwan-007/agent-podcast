"""Opt-in real A1 provider/WS checks. Outputs no environment values or raw errors.

Start gateway first; then python -B -m eval.a1_live_check. Uses provider credits.
"""

import asyncio
import base64
import datetime as dt
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from websockets.asyncio.client import connect

from agents.llm import SingleExpert, AgentError
from gateway.session import load_topic

ROOT = Path(__file__).resolve().parents[1]


async def main():
    load_dotenv(ROOT / ".env", override=True)
    required = ("ELEVENLABS_API_KEY", "VOICE_ID_AGENT1", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL_SPEAK")
    report = {
        "checked_at_ist": dt.datetime.now(dt.timezone(dt.timedelta(hours=5, minutes=30))).isoformat(),
        "base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "implementation": "local uncommitted A1", "mocked": False,
        "variables_present": {name: bool(os.getenv(name, "").strip()) for name in required},
        "audible_browser_playback": "not tested", "interrupt_to_silence_ms": None,
        "user_question_to_first_audio_ms": None, "grant_to_first_audio_ms": None,
    }
    if not all(report["variables_present"].values()):
        report["blocked"] = "Missing required local environment variables"
        save(report)
        return

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            response = await client.get(
                "https://api.elevenlabs.io/v1/voices/" + quote(os.environ["VOICE_ID_AGENT1"], safe=""),
                headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]})
            report["voice_access"] = {"http_status": response.status_code,
                "accessible": response.status_code == 200 and
                response.json().get("voice_id") == os.environ["VOICE_ID_AGENT1"]}
    except Exception as error:
        report["voice_access"] = {"accessible": False, "error_type": type(error).__name__}
    report["voice_access"]["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)

    started = time.perf_counter()
    try:
        topic, persona = load_topic("topic_1")
        sentences = await SingleExpert().respond(topic, persona, topic["opening_prompt"])
        report["llm"] = {"responded": bool(sentences), "sentence_count": len(sentences),
                         "spoken_character_count": sum(map(len, sentences))}
    except Exception as error:
        report["llm"] = {"responded": False, "error_type": type(error).__name__}
        if isinstance(error, AgentError):
            report["llm"]["error"] = str(error)  # Our public-safe message, never provider body.
    report["llm"]["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)

    started = time.perf_counter()
    streamed = {"completed": False, "audio_bytes": 0, "audio_chunks": 0,
                "start_to_first_audio_received_ms": None, "turn_to_first_audio_received_ms": None,
                "turn_id": None, "epoch": None, "notices": []}
    try:
        async with connect("ws://127.0.0.1:8000/ws", open_timeout=10) as ws:
            await ws.send(json.dumps({"type": "start_session", "topic_id": "topic_1", "session_id": None}))
            turn_started = None
            async with asyncio.timeout(100):
                async for raw in ws:
                    event = json.loads(raw)
                    if event["type"] == "turn_start":
                        turn_started = time.perf_counter()
                        streamed.update(turn_id=event["turn_id"], epoch=event["epoch"])
                    elif event["type"] == "audio_chunk":
                        audio = base64.b64decode(event["data_b64"], validate=True)
                        if streamed["audio_chunks"] == 0:
                            now = time.perf_counter()
                            streamed["start_to_first_audio_received_ms"] = round((now - started) * 1000, 1)
                            streamed["turn_to_first_audio_received_ms"] = round((now - turn_started) * 1000, 1)
                        streamed["audio_bytes"] += len(audio)
                        streamed["audio_chunks"] += 1
                    elif event["type"] == "notice":
                        streamed["notices"].append({"code": event["code"], "text": event["text"]})
                        if event["code"] in ("tts_failed", "agent_timeout"):
                            break
                    elif event["type"] == "turn_end" and event["status"] == "completed":
                        streamed["completed"] = streamed["audio_bytes"] > 0
                        await ws.send(json.dumps({"type": "end_session"}))
                    elif event["type"] == "session_state" and event["state"] == "ended":
                        streamed["end_confirmed"] = True
                        break
    except Exception as error:
        streamed["error_type"] = type(error).__name__
    streamed["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
    report["gateway_websocket"] = streamed
    report["latency_interpretation"] = "Received-byte timings only; browser playback and the <1.5 s audible target are unverified."
    save(report)


def save(report):
    output = ROOT / "docs/a1_live_results.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
