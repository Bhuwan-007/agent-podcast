"""A1 connection-local single-expert session using root ws-events.md.

No A2A, automatic debate, STT, human routing or reconnect replay is claimed.
"""

import asyncio
import base64
import json
import os
import time
import uuid
from contextlib import aclosing
from pathlib import Path

import yaml
from fastapi import WebSocket, WebSocketDisconnect

from agents.llm import AgentError
from gateway.tracing import trace_logger
from gateway.voice.tts import TTSError

ROOT = Path(__file__).resolve().parents[1]


def load_topic(topic_id):
    # Never interpolate a client-supplied path.
    if topic_id != "topic_1":
        raise ValueError("Only Topic 1 is supported in A1")
    topic = json.loads((ROOT / "topics/topic_1.json").read_text(encoding="utf-8"))
    persona = yaml.safe_load((ROOT / "agents/personas/topic_1/ai_engineer.yaml").read_text(encoding="utf-8"))
    if not topic.get("available") or not any(a["agent_id"] == persona["id"] for a in topic["agents"]):
        raise ValueError("Topic configuration is unavailable")
    return topic, persona


class VoiceSession:
    def __init__(self, socket: WebSocket, services_factory):
        self.socket = socket
        self.services_factory = services_factory
        self.session_id = uuid.uuid4().hex
        self.epoch = 0
        self.turn_id = 0
        self.sequence = 0
        self.ended = False
        self.topic = None
        self.active = None
        self.worker = None
        self.send_lock = asyncio.Lock()
        self.target = None

    async def emit(self, event_type, **fields):
        async with self.send_lock:
            await self.socket.send_json({"type": event_type, **fields})

    async def state(self, name):
        await self.emit("session_state", state=name, mode="live",
                        session_id=self.session_id, epoch=self.epoch)

    async def notice(self, code, text):
        await self.emit("notice", code=code, level="warn", text=text, recoverable=True)

    async def trace(self, kind, payload):
        await trace_logger.log_event(
            trace_id=self.session_id, session_id=self.session_id, turn_id=self.turn_id,
            from_entity="gateway", to_entity="client", msg_type=kind, payload=payload)

    async def cancel_turn(self):
        self.epoch += 1
        if self.worker:
            self.worker.cancel()
            await asyncio.gather(self.worker, return_exceptions=True)
            self.worker = None
        self.active = None

    async def run(self):
        try:
            while not self.ended:
                message = await self.socket.receive()
                if message["type"] == "websocket.disconnect":
                    return
                raw = message.get("text")
                if not isinstance(raw, str):
                    await self.socket.close(code=1008, reason="JSON text frames are required")
                    return
                if len(raw) > 16_384:
                    await self.socket.close(code=1009)
                    return
                try:
                    event = json.loads(raw)
                    if not isinstance(event, dict) or not isinstance(event.get("type"), str):
                        raise ValueError
                except (ValueError, TypeError):
                    await self.socket.close(code=1008, reason="Expected a JSON event object")
                    return
                await self.handle(event)
        except WebSocketDisconnect:
            pass
        finally:
            await self.cancel_turn()

    async def handle(self, event):
        kind = event["type"]
        if kind == "end_session":
            await self.cancel_turn()
            self.ended = True
            await self.state("ended")
            await self.socket.close(code=1000)
        elif kind == "resume_session":
            await self.notice("session_lost", "A1 does not restore disconnected sessions. Start a new session.")
        elif kind == "start_session":
            if self.topic:
                await self.notice("collision", "A session already exists; end it before starting another.")
                return
            try:
                topic, persona = load_topic(event.get("topic_id"))
            except (ValueError, OSError, KeyError):
                await self.notice("topic_unavailable", "Topic 1 content is required; other topics are unavailable in A1.")
                return
            try:
                self.expert, self.tts = self.services_factory()
                self.voice_id = os.getenv(persona["voice_id_env"], "").strip()
                if not self.voice_id:
                    raise ValueError("VOICE_ID_AGENT1 is required")
            except ValueError:
                await self.notice("tts_failed", "Configure ElevenLabs key/voice and LLM URL/model in the server .env, then retry.")
                await self.state("recovery")
                return
            self.topic, self.persona = topic, persona
            await self.state("connecting")
            await self.emit("topic_config", **{k: topic[k] for k in
                            ("topic_id", "title", "background", "opening_prompt")},
                            agents=[{k: (a["agent_id"] == persona["id"] if k == "available" else a[k])
                                     for k in ("agent_id", "role", "display_name", "voice_label", "aliases", "available")}
                                    for a in topic["agents"]])
            await self.notice("topic_unavailable", "A1 single-expert check: only Alex responds. A2A panel discussion, microphone input and routing are not implemented.")
            await self.state("waiting_first_speaker")
            for metric in ("interrupt_to_silence_ms", "user_question_to_first_audio_ms", "grant_to_first_audio_ms"):
                await self.emit("metrics", name=metric, value=None, available=False)
            # Exact opening text is passed to the model, never voiced as the reply.
            await self.trace("a1.opening_input", {"from": "organizer_prompt", "text": topic["opening_prompt"]})
            await self.start_turn(topic["opening_prompt"], "agent")
        elif kind == "user_utterance":
            if not self.topic:
                await self.notice("no_speech", "Start a session first.")
            elif event.get("input_mode") != "text":
                await self.notice("no_speech", "A1 supports typed questions only; speech input comes in A4.")
            elif event.get("final") is not True:
                return
            elif (event.get("target_hint") or self.target) not in (None, "ai_engineer"):
                await self.notice("topic_unavailable", "Only Alex is available in A1; multi-expert routing comes later.")
            elif not isinstance(event.get("text"), str) or not 0 < len(event["text"].strip()) <= 2000:
                await self.notice("no_speech", "Enter a question of 1–2000 characters.")
            elif self.active:
                await self.notice("collision", "Wait for playback to finish, or stop the current turn first.")
            else:
                await self.start_turn(event["text"].strip(), "human_reply")
        elif kind == "barge_in":
            if self.matches(event):
                old = self.active.copy()
                await self.cancel_turn()
                await self.emit("turn_end", turn_id=old["id"], epoch=old["epoch"], status="interrupted")
                await self.state("processing_user")
                await self.notice("no_speech", "Generation cancelled. A1 accepts a typed question; spoken routing/resume is not implemented.")
        elif kind == "playback_started" and self.matches(event):
            idx = event.get("sentence_idx")
            if type(idx) is int and idx in self.active["sentences"] and idx in self.active["audio_sent"]:
                self.active["played"].add(idx)
                await self.emit("speaker_active", agent_id=self.persona["id"], turn_id=self.turn_id)
                await self.state("agent_speaking")
        elif kind == "playback_stopped" and self.matches(event):
            if (event.get("reason") == "finished" and self.active["generated"]
                    and self.active["played"] == self.active["audio_sent"]):
                for idx in sorted(self.active["played"]):
                    await self.emit("transcript", turn_id=self.turn_id, epoch=self.epoch,
                                    speaker=self.persona["id"], text=self.active["sentences"][idx], final=True, sentence_idx=idx)
                self.active["finished"].set()
            elif event.get("reason") == "error":
                await self.cancel_turn()
                await self.state("recovery")
                await self.notice("tts_failed", "Client audio playback failed. Start a new typed turn or end the session.")
        elif kind == "address_agent":
            self.target = event.get("agent_id")
            if self.target not in (None, "ai_engineer"):
                await self.notice("topic_unavailable", "Only Alex is available in A1.")
        elif kind == "mic_state" and event.get("state") == "denied":
            await self.notice("mic_denied", "Microphone denied; A1 is text input only.")
        elif kind == "collision":
            await self.cancel_turn()
            await self.state("recovery")
            await self.notice("collision", "Playback collision reported; pending generation discarded.")
        # VAD/progress/address messages are not interpreted as A4 functionality.

    def matches(self, event):
        return (self.active is not None and type(event.get("turn_id")) is int
                and type(event.get("epoch")) is int
                and event["turn_id"] == self.active["id"] and event["epoch"] == self.epoch)

    async def start_turn(self, question, kind):
        self.turn_id += 1
        self.active = {"id": self.turn_id, "epoch": self.epoch, "sentences": {},
                       "audio_sent": set(), "played": set(), "generated": False,
                       "finished": asyncio.Event()}
        await self.emit("turn_start", turn_id=self.turn_id, epoch=self.epoch,
                        agent_id=self.persona["id"], kind=kind)
        if kind == "human_reply":
            await self.emit("transcript", turn_id=self.turn_id, epoch=self.epoch,
                            speaker="human", text=question, final=True, sentence_idx=0)
        await self.state("agent_generating")
        self.worker = asyncio.create_task(self.generate(question))

    async def generate(self, question):
        turn = self.active
        started = time.perf_counter()
        first = True
        stage = "agent"
        try:
            async with asyncio.timeout(90):
                sentences = await self.expert.respond(self.topic, self.persona, question)
                if not sentences:
                    raise AgentError("Empty response")
                stage = "tts"
                for idx, sentence in enumerate(sentences):
                    turn["sentences"][idx] = sentence
                    await self.emit("transcript", turn_id=turn["id"], epoch=turn["epoch"],
                                    speaker=self.persona["id"], text=sentence, final=False, sentence_idx=idx)

                    async def text_chunks():
                        yield sentence + " "

                    async with aclosing(self.tts.stream(text_chunks(), self.voice_id)) as audio:
                        async for chunk in audio:
                            if first:
                                await self.trace("a1.first_audio_received", {
                                    "turn_to_first_audio_received_ms": (time.perf_counter() - started) * 1000,
                                    "audible_latency": "unavailable"})
                                first = False
                            self.sequence += 1
                            turn["audio_sent"].add(idx)
                            await self.emit("audio_chunk", turn_id=turn["id"], epoch=turn["epoch"],
                                            sentence_idx=idx, seq=self.sequence, mime="audio/mpeg",
                                            data_b64=base64.b64encode(chunk).decode("ascii"))
                turn["generated"] = True
                await self.emit("turn_end", turn_id=turn["id"], epoch=turn["epoch"], status="completed")
            # Generation completion does not mean the listener heard the response.
            await asyncio.wait_for(turn["finished"].wait(), timeout=60)
            self.active = None
            await self.state("waiting_first_speaker")
        except (AgentError, TTSError):
            await self.failed(turn, stage)
        except (WebSocketDisconnect, RuntimeError):
            # A closed ASGI socket may raise RuntimeError instead of disconnect.
            return
        except Exception:
            await self.failed(turn, stage)

    async def failed(self, turn, stage):
        self.epoch += 1
        self.active = None
        if not turn["generated"]:
            await self.emit("turn_end", turn_id=turn["id"], epoch=turn["epoch"], status="failed")
        await self.state("recovery")
        await self.notice("agent_timeout" if stage == "agent" else "tts_failed",
                          "Expert generation failed." if stage == "agent" else
                          "Audio synthesis or playback acknowledgement failed; stale output was discarded.")
