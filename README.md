# AI Roundtable — Real-Time Multi-Agent Voice Podcast

FOSS Forge 2.0 (ElevenLabs Track).

A real-time, voice-native live roundtable with autonomous AI experts who exchange dynamic perspectives, challenge assumptions via Agent2Agent (A2A) protocol, and respond to mid-sentence human voice interruptions.

---

## Architecture Overview

```
┌────────────────────────── Browser (web/) ──────────────────────────┐
│ mic + VAD  │ audio playback queue (Web Audio) │ HUD: transcript,   │
│ barge-in   │ playback progress acks           │ claims, A2A trace  │
└──────┬──────────────────────▲──────────────────────────────────────┘
       │ WS (control + mic)   │ WS (audio chunks + events)
┌──────▼──────────────────────┴──────────────────────────────────────┐
│ Gateway (FastAPI, gateway/)                                        │
│  Session store ── Claims ledger ── Moderator (floor arbiter only)  │
│  Router (human question -> target agent)                           │
│  Voice service: TTS adapter (ElevenLabs WS) / STT adapter          │
│  Tracing: JSONL log of every A2A message + timing marks            │
└──────┬─────────────┬─────────────┬─────────────┬───────────────────┘
       │ A2A         │ A2A         │ A2A         │ A2A   (JSON-RPC over HTTP, SSE)
┌──────▼───┐  ┌──────▼───┐  ┌──────▼───┐  ┌──────▼───┐
│ Alex     │  │ Sam      │  │ Maya     │  │ Sana*    │   each = its own process
│ AI Eng   │  │ Software │  │ OSS Maint│  │ Historian│   own persona, own LLM
│ :9101    │  │ :9102    │  │ :9103    │  │ :9104    │   (* optional)
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Quickstart

### 1. Requirements
- Python 3.11+
- Node.js 18+ (for frontend)
- ElevenLabs API Key

### 2. Backend Setup
```bash
# Clone repository
git clone <repo-url>
cd agent-podcast

# Configure environment
cp .env.example .env
# Edit .env with your ELEVENLABS_API_KEY, VOICE_IDs, and LLM_API_KEY

# Install dependencies
make install
# or: pip install -r requirements.txt

# Run tests
make test

# Start Gateway (runs on http://localhost:8000 and ws://localhost:8000/ws)
make run
```

---

## Real vs Mocked Table

| Component | Status | Notes |
|---|---|---|
| Gateway `/health` & JSONL tracing | **Real** | Implemented in `gateway/main.py` and `gateway/tracing.py` |
| A2A agent servers + Agent Cards | Planned (A2) | `agents/agent_server.py` |
| Bid/grant floor protocol | Planned (A2) | `gateway/moderator.py` |
| ElevenLabs TTS streaming WS | Planned (A1/A3) | `gateway/voice/tts.py` |
| Barge-in + routing | Planned (A4) | `gateway/router.py`, `gateway/session.py` |
| Claims ledger | Planned (A5) | `gateway/ledger.py` |
| Chaos / failure resilience | Planned (A6) | `gateway/chaos.py` |

---

## Team Lanes & Collaboration
- **Lane A (Backend):** `agents/`, `gateway/`, `eval/`, `docs/protocol.md`, `STATUS-backend.md`.
- **Lane B (Frontend):** `web/`, `topics/`, `STATUS-web.md`.
- Seam between lanes: [ws-events.md](file:///c:/Dev/Hacks/multiagent%20podcast/ws-events.md)
