# STATUS-backend.md — Lane A Progress & Verification

**Owner:** Person A (Backend / Agents / Voice)  
**Last Updated:** 2026-10-22 — A1 functional playback verified; latency goal outstanding

---

## 1. Current Status

| Phase | Description | Status | Verification / Evidence |
|---|---|---|---|
| **A0** | Scaffold & Architecture Skeleton | **DONE** | `pytest eval/` passed (2/2); `/health` returns `{"status":"ok"}`; JSONL tracing active |
| **A1** | One real agent speaking + live WS | Functional pass; latency goal outstanding | 34 Python + 4 player tests; real voice and question-quality samples; user confirmed speech, typed reply and End |
| **A2** | Three A2A agents + floor protocol | Planned | — |
| **A3** | Voice for all agents (multi-voice TTS) | Planned | — |
| **A4** | Mid-sentence barge-in, routing, STT | Planned | — |
| **A5** | Claims ledger & rolling memory | Planned | — |
| **A6** | Reliability & chaos endpoints | Planned | — |
| **A7** | Pipelined drafting | Planned | — |
| **A8** | Eval replay & protocol documentation | Planned | — |

---

## 2. Implemented Components
- **FastAPI Gateway (`gateway/main.py`):** `/health`, `/ws`, origin validation, and backend-owned `/dev/a1` voice test page. CORS permits `http://localhost:5173`.
- **Voice session (`gateway/session.py`):** Topic 1 loader, single active turn, epoch cancellation, JSON/base64 audio events, real playback acknowledgements and safe error notices.
- **Single expert (`agents/llm.py`, `agents/personas/topic_1/ai_engineer.yaml`):** Dynamic model response in Alex's perspective; strips claims metadata before speech. This is not A2A, which starts in A2.
- **TTS (`gateway/voice/tts.py`):** ElevenLabs stream-input adapter, bounded concurrency and cleanup. No new dependencies.
- **JSONL Tracing (`gateway/tracing.py`):** Async non-blocking file logger writing structured traces to `logs/traces/<session_id>.jsonl`.
- **Configuration (`.env.example`):** Complete template containing all 16 variables from `architecture.md` Section 11.
- **Dependency Management (`requirements.txt`):** Pinned core dependencies (`fastapi`, `uvicorn`, `pydantic`, `websockets`, `httpx`, `aiohttp`, `pyyaml`, `pytest`).
- **Automation (`Makefile`, `docker-compose.yml`):** Targets `run`, `test`, `install`.

---

## 3. Real vs Mocked Ledger

| Component | State | Notes |
|---|---|---|
| Gateway `/health` & trace writer | **Real** | Verified via `eval/test_gateway.py` |
| A1 model/TTS/WS path | Real transport verified | Live model-generated turn streamed 170,614 bytes in 10 chunks; browser audibility unverified |
| Backend A1 player | Real playback confirmed by user | `/dev/a1`; clear speech, typed reply and End passed; sentence buffering adds latency |
| Web frontend + topic content | Lane B | B1 merged into main; untouched by A1. Topic 1 loaded from B's JSON |
| Three-agent A2A discussion, STT, routing, memory | Planned | No success or compliance claim from A1 |

---

## 4. Known Bugs / Blockers
- User explicitly authorized root `ws-events.md` on 2026-10-21. It matches fetched origin/main; no shared contract was edited. `contracts/ws_events.md` remains absent as a path.
- Live ElevenLabs access, dynamic model-to-WebSocket audio and user-observed browser playback/End verified. The under-1.5-second audible-start goal remains outstanding.
- Truncation mitigation is implemented in the integration branch: supported low reasoning effort plus one bounded length retry. 8/8 live samples succeeded without retries; this small batch is not a long-run reliability guarantee.
- Browser metrics reporting and reconnect sequence details need joint clarification before later integration. See `docs/protocol.md`.
- Docker Compose still references an absent Dockerfile; use the documented uvicorn command.

## 5. A1 provider adapter milestone (2026-10-21)
- Added `gateway/voice/tts.py`: `TTSConfig.from_env()` reads existing environment variables; `ElevenLabsTTS.stream()` sends asynchronous spoken-text chunks and yields decoded MP3 bytes. Reuse one adapter per event loop for a shared concurrency limit.
- Provider API verified against official ElevenLabs WebSocket guide and API reference; installed `websockets==14.1` connection API inspected. No dependencies added.
- Handles both documented final-marker spellings (`isFinal` / `is_final`), provider/malformed-data errors, empty audio completion, bounded buffering, turn timeout, cancellation and connection cleanup. Credentials and provider payloads are excluded from emitted error messages.
- Caller must use `contextlib.aclosing()` if it stops consuming early. Claims metadata must be stripped upstream before calling this spoken-text-only adapter.
- Logs `tts_first_audio_received_ms` through Python logging: connection-start to first received audio bytes. This is NOT browser playback latency or a shared contract metric.
- Initial adapter milestone: 13 tests passed. Superseded by the combined verification below.

## 6. Remaining A1 implementation (2026-10-21)
- `start_session` uses the exact Topic 1 organizer opening text. Only Alex is marked available. The opening reply is generated from the configured model, not a dialogue fixture.
- Sentence audio flows through ElevenLabs to `/ws` with `turn_id`, `epoch`, `sentence_idx`, `seq`, MIME and base64 data. Speaker state follows client playback, not synthesis.
- `turn_end(completed)` marks production completion; client `playback_stopped(finished)` marks playback completion. Final agent transcript follows the latter. Server timings measure received bytes, not acoustic playback.
- End cancels model/TTS work; stale acknowledgements are ignored. Basic cancellation is not proof of A4 spoken interruption, routing or resume.
- `/dev/a1` is outside teammate-owned `web/` and can be used before B integrates the real backend. It shows explicit A1 limitations; no mic or fake multi-agent state.
- `python -B -m pytest eval/ -q -p no:cacheprovider --tb=short`: **28 passed in 1.04 s**, using mocked external services. Temporary-directory access required the permission-approved run.
- `node --test eval/test_a1_player.mjs`: **3 passed**, with mocked browser APIs. Tests cover queue completion and stale playback suppression during End/epoch changes.
- Player JavaScript passed `node --check`. These checks do not establish real MP3 decoding or audible quality.
- See `docs/protocol.md` for run steps, file/function responsibilities, timing definitions and teammate requests. `eval/a1_smoke.py` is an opt-in live transport check.
- No commit, push or merge of A1 yet. Live acceptance is the next gate, followed by A2's independent A2A agents and bid/grant protocol.

## 7. Live checks (2026-10-22, IST)
- All five required .env variables present; no values printed. No successful responses were mocked.
- Earlier TTS failed with provider `payment_required` / code 1008. Latest real TTS retry succeeded: 34,734 bytes in 3,328.1 ms; no payment error.
- Subscription metadata lookup still returned HTTP 401. Plan tier/active status/credits could not be confirmed with that endpoint; do not infer that the account has no subscription.
- Latest voice lookup returned HTTP 200. An independent model request failed as incomplete in 3,086.6 ms, but the gateway's subsequent model request completed and generated real speech.
- Real gateway WebSocket turn: **170,614 bytes / 10 chunks**, `turn_end(completed)`, End confirmed. First audio received **2,905.3 ms after turn_start**, **2,931.3 ms after check start**; whole WS check **3,816.0 ms**. These are received-byte timings, not audible latency.
- Results: `docs/a1_live_results.json`, `docs/a1_tts_diagnostic.json`, `docs/a1_subscription_check.json`. Failed baselines retained in `docs/a1_live_results_initial.json` and `docs/a1_live_results_after_token_fix.json`.
- Browser playback and the <1.5 s audible target remain unverified; no overall A1 acceptance pass claimed.

## 8. Integration branch update (2026-10-22)
- Fetched and fast-forwarded only `gateway/a1-b2-integration` to teammate B3 commit `1539311`. Original checkout remains on `meds`; no teammate source or shared contract was edited.
- Model fix: Groq GPT-OSS uses documented low reasoning effort and excludes reasoning fields; 1,024-token generation allowance retries once at 2,048 only for `finish_reason:length`, under a 25 s total deadline. Speech stays short. No retry for authentication failures.
- Automated verification: **31 backend tests**, **6 B3 protocol tests**, frontend build passed (bundle-size warning remains). Existing **3 player lifecycle tests** use mocked browser APIs.
- Real model batch: **8/8**, first attempt every time; median **1,109.8 ms**, max **1,202.5 ms**. Final speech examples and timings in `docs/a1_reliability_results.json`; these are completion checks, not full discussion-quality scores.
- Latest real WS turn: **208,649 bytes / 12 chunks**; first bytes **1,620.5 ms** after turn_start; total check **2,612.9 ms**. See `docs/a1_live_results.json`. Audible-latency target is not yet demonstrated.
- Real socket End before audio and after first audio chunk passed. Server End acknowledgements **474.9 ms / 82.8 ms**; normal close and no post-End frames. See `docs/a1_cancellation_results.json`; not acoustic stop timings.
- No browser connected for automation. User agreed to manual listening/typed reply/End check at `http://localhost:8000/dev/a1`; result pending.
- Source root `.env.example` API-key fields sanitized as approved; original `.env` unchanged. Integration uses credentials in memory without copying them.
- B3 improved highlights/epoch handling/socket stability; B4 playback still pending. Remaining pair-up findings are in `docs/integration_review.md`, including initial epoch mismatch and transcript sentence keying.
- A1 is not committed, pushed, merged or declared fully accepted yet.

## 9. User playback confirmation and review scope
- User confirmed: "Speech played clearly, typed reply worked, and End stopped audio immediately" at `/dev/a1`. See `docs/a1_manual_acceptance.md`. This is manual functional evidence, not an exact acoustic latency measurement.
- A1 is functionally verified for a single expert. No under-1.5 s audible-start pass, A2A discussion, voice barge-in, routing, or memory is claimed.
- Prepare a draft PR from the integration branch for review. Do not automatically merge into main; latency and B4 integration limitations remain explicit.

## 10. Direct-question quality follow-up
- User found a real response incomplete in meaning: their question asked how AI could select architectures, but the answer shifted to training developers. This was a task-following issue, not a token cutoff.
- Refined the prompt to preserve the requested actor/task, engage valid challenges, explain mechanisms and evaluation in plain language, and describe unimplemented systems as proposals. No architecture answer was hardcoded.
- Up to three concise sentences are supported per existing configuration. Common abbreviations (e.g. "vs.") stay intact. An oversized response gets one bounded short-answer repair, sharing the same two-attempt/25 s limit as truncation retries; repeated invalid output fails honestly.
- Final regression: **34 Python tests passed in 1.10 s**, **4 player tests passed** (including three-sentence order). B3's **6 tests** and frontend build previously passed and its files were unchanged.
- Latest direct-question batch: **3/3 complete, first attempt**, median **1,126.3 ms**. See `docs/a1_question_quality_results.json`; earlier initial/oversize trials are preserved. These completion flags are not semantic-quality scores. The final answers address AI mechanisms more directly; long-term depth/attribution remain A2/A5 work.
- Final live WS run after these changes: **316,525 bytes / 18 chunks**, first bytes **1,664.0 ms after turn_start**, total **3,416.2 ms**, End confirmed. `<1.5 s` audible goal remains unverified/not passed. Earlier 1,620.5 ms run is retained in `docs/a1_live_results_before_quality.json`.
- User's pasted interface text corroborated generated/final transcript lines and a typed reply, but did not contain the requested local playback timing line; that metric remains unavailable.
