"""Opt-in LIVE transport check: run after starting the real gateway.

python -B -m eval.a1_smoke
Uses configured provider credits. Does not play audio or forge playback acknowledgements.
"""

import asyncio
import base64
import json

from websockets.asyncio.client import connect


async def main():
    audio_bytes = 0
    async with connect("ws://localhost:8000/ws") as ws:
        await ws.send(json.dumps({"type": "start_session", "topic_id": "topic_1", "session_id": None}))
        async with asyncio.timeout(90):
            async for raw in ws:
                event = json.loads(raw)
                if event["type"] == "notice":
                    print(event["text"])
                elif event["type"] == "audio_chunk":
                    audio_bytes += len(base64.b64decode(event["data_b64"], validate=True))
                elif event["type"] == "session_state" and event["state"] == "recovery":
                    raise RuntimeError("Live transport check could not complete; see the configuration notice")
                elif event["type"] == "turn_end":
                    if event["status"] != "completed" or not audio_bytes:
                        raise RuntimeError("No complete voiced turn was received")
                    await ws.send(json.dumps({"type": "end_session"}))
                    print(f"Received {audio_bytes} real provider audio bytes; turn={event['turn_id']}, epoch={event['epoch']}.")
                    print("Transport only: audible playback and latency acceptance remain unverified.")
                    return


if __name__ == "__main__":
    asyncio.run(main())
