# STATUS-backend.md — Lane A Progress & Verification

**Owner:** Person A (Backend / Agents / Voice)  
**Last Updated:** Phase A0 (Scaffold) Completed  

---

## 1. Current Status

| Phase | Description | Status | Verification / Evidence |
|---|---|---|---|
| **A0** | Scaffold & Architecture Skeleton | **DONE** | `pytest eval/` passed (2/2); `/health` returns `{"status":"ok"}`; JSONL tracing active |
| **A1** | One real agent speaking + live WS | In Progress | Next step |
| **A2** | Three A2A agents + floor protocol | Planned | — |
| **A3** | Voice for all agents (multi-voice TTS) | Planned | — |
| **A4** | Mid-sentence barge-in, routing, STT | Planned | — |
| **A5** | Claims ledger & rolling memory | Planned | — |
| **A6** | Reliability & chaos endpoints | Planned | — |
| **A7** | Pipelined drafting | Planned | — |
| **A8** | Eval replay & protocol documentation | Planned | — |

---

## 2. Implemented Components
- **FastAPI Gateway (`gateway/main.py`):** Configured with `/health` endpoint and CORS middleware permitting `http://localhost:5173`.
- **JSONL Tracing (`gateway/tracing.py`):** Async non-blocking file logger writing structured traces to `logs/traces/<session_id>.jsonl`.
- **Configuration (`.env.example`):** Complete template containing all 16 variables from `architecture.md` Section 11.
- **Dependency Management (`requirements.txt`):** Pinned core dependencies (`fastapi`, `uvicorn`, `pydantic`, `websockets`, `httpx`, `aiohttp`, `pyyaml`, `pytest`).
- **Automation (`Makefile`, `docker-compose.yml`):** Targets `run`, `test`, `install`.

---

## 3. Real vs Mocked Ledger

| Component | State | Notes |
|---|---|---|
| Gateway `/health` & trace writer | **Real** | Verified via `eval/test_gateway.py` |
| Web dev placeholder | Mock / Stub | `web/.gitkeep` reserved for Lane B |
| Topics placeholder | Mock / Stub | `topics/.gitkeep` reserved for Lane B |

---

## 4. Known Bugs / Blockers
- None. All Phase A0 checks passed.
