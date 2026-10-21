# architecture.md — AI Roundtable (FOSS Forge 2.0, ElevenLabs track)

> Read this file fully before writing code. If something here conflicts with the
> hackathon brief, the brief wins. If a library API differs from what is written
> here, check the library's current docs/README and follow those. Do not guess.

## 1. Non-negotiables (from the brief)

1. At least **3 autonomous agents**, each with its own role, expertise and **ElevenLabs voice**.
2. Agents collaborate through **A2A (Agent2Agent protocol)** or an equivalent documented standard.
   A central controller making sequential LLM calls does NOT qualify.
3. The conversation is **generated dynamically**. No scripts, no hard-coded dialogue order.
4. A human can **interrupt mid-sentence**, **address one expert**, get a spoken answer, and the
   discussion **resumes with context intact**. No session restart.
5. Voice output uses **ElevenLabs**. Everything else is **open source** (open-weight models,
   open frameworks).
6. Evidence is required: architecture diagram, A2A message traces, interruption demo,
   latency/timing logs, and a README that clearly separates real vs mocked parts.

## 2. System overview

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
       │ A2A         │ A2A         │ A2A         │ A2A   (JSON-RPC over HTTP, SSE for streaming)
┌──────▼───┐  ┌──────▼───┐  ┌──────▼───┐  ┌──────▼───┐
│ Agent 1  │  │ Agent 2  │  │ Agent 3  │  │ Agent 4* │   each = its own process + Agent Card
│ :9101    │  │ :9102    │  │ :9103    │  │ :9104    │   own persona, own memory view, own LLM calls
└──────────┘  └──────────┘  └──────────┘  └──────────┘   (* optional)
```

Key principle: **the moderator is a deterministic arbiter, not a writer.** It never produces
discussion content. Content comes only from the agents. The router is an NLU classifier for
*human* input only.

## 3. Repo layout

```
roundtable/
  README.md                 # architecture, roles, flow, real-vs-mocked table
  .env.example
  requirements.txt          # pinned versions
  docker-compose.yml        # optional but nice
  docs/ architecture.md prompts.md workflow/overview.md
  agents/
    agent_server.py         # generic A2A server, loads a persona file
    base_agent.py           # bid(), speak(), react(), respond_to_human()
    personas/*.yaml         # one file per expert
    llm.py                  # OpenAI-compatible client (base_url + model from env)
  gateway/
    main.py                 # FastAPI app, WS endpoints
    moderator.py            # floor arbitration (pure function + state)
    ledger.py               # claims ledger + rolling summary
    router.py               # human question routing
    a2a_client.py           # fan-out/fan-in helpers
    voice/tts.py            # ElevenLabs streaming adapter
    voice/stt.py            # speech-to-text adapter
    tracing.py              # JSONL traces + timing marks
    chaos.py                # kill/stall/error injection for demo
  web/                      # frontend (Vite + vanilla/React)
  eval/scenarios.yaml  eval/run_eval.py
  logs/                     # traces/*.jsonl (gitignored except samples)
```

## 4. A2A usage

- Use the Python `a2a-sdk` (verify the current package name, Agent Card path and message
  types in its README before coding).
- Each agent exposes an **Agent Card** (name, description, url, skills, capabilities incl.
  streaming) and an A2A endpoint.
- Skills per agent: `bid`, `speak`, `react`, `respond_to_human`.
- Message payloads are **structured JSON** carried in data parts. Free text only appears inside
  the `text` field of speech.
- Every message carries `trace_id`, `turn_id`, `from`, `to`, `type`, `ts`. All are logged.

### Message types

```jsonc
// floor.utterance  (gateway -> all other agents, broadcast after each sentence/turn)
{"type":"floor.utterance","turn_id":12,"from":"meera","text":"...","claims":[{"id":"c7","text":"..."}],
 "final":false,"interrupted":false}

// floor.bid  (agent -> gateway, within BID_TIMEOUT_MS)
{"type":"floor.bid","turn_id":12,"from":"arjun","intent":"challenge",  // agree|challenge|build|clarify|pass
 "target":"meera","claim_id":"c7","urgency":0.82,"novelty":0.6,"preview":"The cost assumption ignores..."}

// floor.grant  (gateway -> winner)
{"type":"floor.grant","turn_id":13,"to":"arjun","reason":"highest score","context_version":41}

// agent.direct  (agent -> specific agent, via gateway relay or direct A2A call)
{"type":"agent.direct","from":"arjun","to":"meera","act":"challenge","claim_id":"c7","text":"..."}

// human.question  (gateway -> routed agent)
{"type":"human.question","from":"human","to":"kabir","text":"...","interrupted_turn":{"speaker":"meera","spoken_text":"..."}}

// floor.resume  (gateway -> all, after a human exchange)
{"type":"floor.resume","open_threads":["c7","c9"],"human_exchange_summary":"..."}
```

## 5. Floor protocol (the heart of the A2A requirement)

1. When a speaker emits a sentence (or finishes), the gateway **broadcasts** `floor.utterance`
   to all other agents **in parallel**.
2. Each agent privately decides whether it wants the floor and returns a `floor.bid` within
   `BID_TIMEOUT_MS` (default 400). Late or missing bids count as `pass`.
3. The **arbiter** (`moderator.py`) picks the next speaker with a deterministic score:
   `score = w_u*urgency + w_t*(is_target) + w_n*novelty - w_r*recency_penalty - w_d*dominance_penalty`
   Seeded tie-break. No LLM here.
4. Gateway sends `floor.grant` to the winner. The winner **streams** its speech over A2A
   (SSE). The gateway splits into sentences and pushes them to TTS.
5. **Pipelining:** while the current speaker is still talking, other agents may pre-draft a
   reply from the partial utterance (text only, never audio). On grant, the winner reuses its
   draft only if still valid against the latest ledger version, else regenerates.
6. Agents may also send `agent.direct` messages (e.g. "challenge claim c7"), which strongly
   raises the target's bid urgency next turn.

## 6. Claims ledger and context

- Each agent's `speak` output ends with a claims JSON block (see prompts.md). The gateway
  stores it in the ledger: `{claim_id, agent, text, turn, status, challenged_by[], supports[]}`.
  `status`: open | challenged | conceded | supported.
- Each agent's context window = persona + topic brief + **rolling summary** + **last N turns**
  + **open claims** + any pending direct messages. Never dump the full transcript.
- After a topic shift the gateway marks old claims `dormant`, keeps them retrievable, and
  injects a one-line shift note.

## 7. Voice pipeline

**TTS (ElevenLabs).** One voice id per agent. Use the WebSocket streaming input endpoint with
the Flash model (`eleven_flash_v2_5`) for lowest latency. Verify the current endpoint, message
format and output formats in the ElevenLabs docs. Pattern:

- Open a WS per speaking turn, send the initial config message, push LLM text chunks as they
  arrive (sentence-aligned), send the end-of-input message, forward audio chunks to the browser.
- Cap speech to 2-3 sentences per turn. Short turns keep latency and interruption cost low.
- A bounded concurrency pool around TTS requests, set just under the plan limit. Only one
  agent speaks at a time, so this mostly protects against retries after interruptions.

**Playback + progress.** Browser plays chunks through Web Audio. It sends
`playback_progress {turn_id, sentence_idx, ms}` acks so the gateway knows what was
**actually heard**. `spoken_text` = fully played sentences + a proportional slice of the
current one.

**STT.** Pick one and document it:
- A) ElevenLabs speech-to-text (preferred if the key supports it; check the current API).
- B) Browser Web Speech API as fallback (Chrome), clearly marked in the README.

## 8. Interruption protocol

```
t0  client VAD detects >=250 ms of speech while audio is playing   (echoCancellation on)
t1  client pauses/clears audio queue immediately            target: t1 - t0 < 100 ms
t2  client -> gateway: barge_in {turn_id, sentence_idx, ms}
t3  gateway cancels LLM stream task, closes TTS WS, marks turn.interrupted = true,
    stores spoken_text (what the user actually heard) in the session history
t4  STT final transcript arrives
t5  router decides target: (1) explicit name mention, (2) LLM classifier, (3) "everyone"
t6  gateway -> target agent: human.question (+ interrupted_turn context)
t7  agent streams reply -> TTS -> browser                    target: first audio < 1.5 s after t4
t8  gateway broadcasts floor.resume with open threads; agents bid; discussion continues
```

Edge cases to handle: false barge-in (cough/noise) -> resume the same turn from the unplayed
sentence; user speaks during another human answer; two barge-ins in a row; user says
"go on" / "continue" (no question) -> just resume.

## 9. Reliability

| Failure | Handling |
|---|---|
| Agent bid timeout | Treat as `pass`, log `bid_timeout` |
| Agent stalls while speaking (>4 s no token) | Cancel, mark `stalled`, grant to next best bid, show notice in HUD |
| Agent process down | Health ping every 3 s; exclude from bidding; discussion continues with the rest |
| LLM error / rate limit | One retry with backoff, then fallback model from env, then `pass` |
| TTS failure | Show text in HUD, skip audio for that turn, continue |
| Overlapping responses | Moderator grants exactly one floor at a time; late streams are dropped |
| Unexpected/off-topic question | Router -> `everyone` or best-fit expert; agents may say what is outside their expertise |

`gateway/chaos.py` exposes `/admin/chaos/{agent}/{kill|stall|error}` for the live demo.

## 10. Observability (evidence for judges)

- `logs/traces/<session>.jsonl`: one line per A2A message with `trace_id, turn_id, ts, from,
  to, type, payload`.
- Timing marks per turn: `t_user_speech_end, t_barge_in_detected, t_audio_stopped,
  t_first_token, t_first_audio, t_response_first_audio`.
- Derived metrics shown in the HUD and written to `logs/metrics.json`:
  time-to-first-audio, interruption-to-response, bid latency, turns per minute.
- HUD panels: speaker avatars, live transcript, claims graph/list, A2A trace stream, latency.

## 11. Configuration (.env.example must list all of these)

```
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
VOICE_ID_AGENT1=
VOICE_ID_AGENT2=
VOICE_ID_AGENT3=
VOICE_ID_AGENT4=
STT_PROVIDER=elevenlabs        # or webspeech
LLM_BASE_URL=                  # any OpenAI-compatible endpoint serving an open-weight model
LLM_API_KEY=
LLM_MODEL_SPEAK=
LLM_MODEL_BID=                 # smaller/faster model
LLM_MODEL_FALLBACK=
BID_TIMEOUT_MS=400
MAX_SENTENCES_PER_TURN=3
CONTEXT_LAST_N_TURNS=8
TTS_MAX_CONCURRENCY=3
```

Never commit real keys. Never log keys.

## 12. Latency targets

| Metric | Target |
|---|---|
| Bid round (parallel) | < 500 ms |
| Grant -> first audio (pipelined) | < 1.2 s |
| Barge-in -> audio stopped | < 150 ms |
| Human question end -> first audio of answer | < 1.5 s |

Measure and report the real numbers, even if they miss the targets.

## 13. Real vs mocked table (fill in honestly before submission)

| Component | Status (real / mocked / planned) | Notes |
|---|---|---|
| A2A agent servers + Agent Cards | | |
| Bid/grant floor protocol | | |
| ElevenLabs TTS streaming | | |
| STT | | |
| Barge-in + routing | | |
| Claims ledger | | |
| Topic-shift handling | | |
| Chaos/failure handling | | |