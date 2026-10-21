"""Real gateway cancellation checks; no forged playback or acoustic latency claims."""
import asyncio
import json
import time
from pathlib import Path

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosedOK


async def check(trigger):
    result = {"trigger": trigger, "mocked": False, "audio_chunks_before_end": 0}
    async with connect("ws://127.0.0.1:8000/ws") as ws:
        await ws.send(json.dumps({"type": "start_session", "topic_id": "topic_1", "session_id": None}))
        sent = False
        async with asyncio.timeout(40):
            async for raw in ws:
                event = json.loads(raw)
                if event["type"] == "audio_chunk":
                    result["audio_chunks_before_end"] += 1
                if event["type"] == "notice" and event["code"] in ("tts_failed", "agent_timeout"):
                    result["passed"] = False
                    result["failure_code"] = event["code"]
                    break
                if event["type"] == trigger and not sent:
                    started = time.perf_counter()
                    await ws.send(json.dumps({"type": "end_session"}))
                    sent = True
                if event["type"] == "session_state" and event["state"] == "ended":
                    result["end_request_to_ended_event_ms"] = round((time.perf_counter() - started) * 1000, 1)
                    result["ended_epoch"] = event["epoch"]
                    try:
                        await ws.recv()
                        result["passed"] = False
                        result["unexpected_post_end_frame"] = True
                    except ConnectionClosedOK:
                        result["passed"] = True
                        result["connection_closed_normally"] = True
                    break
    return result


async def main():
    rows = [await check("turn_start"), await check("audio_chunk")]
    report = {"checks": rows, "interpretation": "Server cancellation and closure only, not audible stop latency."}
    Path("docs/a1_cancellation_results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
