# contracts/ws_events.md — Browser <-> Gateway events (canonical)

This is the single source of truth for the browser/gateway seam. It replaces the "illustrative"
event names in the product docs (including any `09_TEAM_HANDOFF_AND_CONTRACT.md`) and the
starting list in `workflow/collaboration.md`. Change only via a small `[contract]` PR, and only
additively (add fields; never rename or remove).

Transport: one WebSocket per session, JSON text frames. Audio is sent as base64 inside
`audio_chunk` (simple first; optimise to binary later only if latency demands it).
All timestamps `t_client_ms` come from `performance.now()` on the client unless stated.

## 1. Session states (match product doc 03, section B)

`session_state.state` is one of:

| Code | state | Meaning |
|---|---|---|
| S0 | `ready` | Topic chosen, not started |
| S1 | `connecting` | Joining |
| S2 | `waiting_first_speaker` | Running, no audio yet |
| S3 | `agent_speaking` | An agent is actually audible |
| S4 | `user_speaking` | Mic is capturing the user's turn |
| S5 | `processing_user` | User turn ended, interpreting/routing |
| S6 | `agent_generating` | Target reply being generated/synthesised |
| S7 | `recovery` | Mic denied / disconnect / TTS or agent failure |
| S8 | `ended` | Session closed, no queued audio may play |

`mode` is `live` or `mock`. **If `mode` is `mock` the UI must show a persistent "Mock data"
banner.** The mock gateway exists only for UI development.

## 2. Epoch and turn validity

- The gateway keeps an integer `epoch` per session. It increments on every `barge_in`,
  `end_session`, and on any event that invalidates in-flight audio.
- Every `audio_chunk`, `transcript` and `turn_*` event carries `turn_id` and `epoch`.
- **The client drops any audio/transcript whose `epoch` is older than the latest seen**, and
  clears its playback queue when it sees a higher epoch. After `session_state: ended`, nothing
  may play (AT-12, ERR-10).
- Only one foreground agent voice at a time. If the client receives audio for a second active
  turn, it keeps the valid one, drops the other and sends `collision` (ERR-06).

## 3. Client -> gateway

```jsonc
{"type":"start_session","topic_id":"topic_1","session_id":null}
{"type":"resume_session","session_id":"...","last_seq":123}          // reconnect
{"type":"end_session"}
{"type":"mic_state","state":"on|off|denied|unavailable"}
{"type":"vad","state":"start|end","t_client_ms":0}                    // user voice activity (for metrics)
{"type":"user_audio","seq":1,"chunk_b64":"...","mime":"audio/webm"}  // only if STT runs on the gateway
{"type":"user_utterance","utterance_id":"u1","text":"...","final":true,
 "input_mode":"voice|text","confidence":0.0,"target_hint":null}      // STT result or typed fallback
{"type":"address_agent","agent_id":"oss_maintainer|null"}           // TargetSelector (FR-13)
{"type":"barge_in","turn_id":12,"epoch":3,"sentence_idx":1,"played_ms":850,"t_client_ms":0}
{"type":"playback_started","turn_id":12,"epoch":3,"sentence_idx":0,"t_client_ms":0}
{"type":"playback_progress","turn_id":12,"epoch":3,"sentence_idx":1,"played_ms":850}
{"type":"playback_stopped","turn_id":12,"epoch":3,"reason":"barge_in|end|finished|error","t_client_ms":0}
{"type":"collision","turn_ids":[12,13]}
```

`input_mode:"text"` utterances work but are **never** counted as evidence of spoken barge-in.

## 4. Gateway -> client

```jsonc
{"type":"session_state","state":"agent_speaking","mode":"live","session_id":"...","epoch":3}
{"type":"topic_config","topic_id":"topic_1","title":"...","background":"...","opening_prompt":"...",
 "agents":[{"agent_id":"ai_engineer","role":"AI Engineer","display_name":"Alex",
            "voice_label":"...","aliases":["ai engineer","engineer","alex"],"available":true}]}
{"type":"turn_start","turn_id":12,"epoch":3,"agent_id":"software_developer","kind":"agent|human_reply"}
{"type":"audio_chunk","turn_id":12,"epoch":3,"sentence_idx":0,"seq":5,"mime":"audio/mpeg","data_b64":"..."}
{"type":"transcript","turn_id":12,"epoch":3,"speaker":"software_developer|human|system",
 "text":"...","final":false,"sentence_idx":0}
{"type":"speaker_active","agent_id":"software_developer","turn_id":12}   // sent after client playback_started
{"type":"turn_end","turn_id":12,"epoch":3,"status":"completed|interrupted|failed|discarded"}
{"type":"routing","utterance_id":"u1","kind":"targeted|general|continue|topic_shift|meta|unknown_target|unclear",
 "target":"oss_maintainer|null","question":"Which expert did you mean?|null"}
{"type":"claims_update","claims":[{"id":"c7","agent_id":"ai_engineer","text":"...","status":"open","verified":false}]}
{"type":"trace_event","ts":"...","from":"software_developer","to":"ai_engineer","msg_type":"floor.bid","summary":"challenge c7"}
{"type":"metrics","name":"interrupt_to_silence_ms","value":null,"available":false}
{"type":"notice","code":"mic_denied|no_speech|agent_timeout|tts_failed|disconnected|session_lost|collision|topic_unavailable",
 "level":"info|warn|error","text":"...","recoverable":true}
```

Rules:
- `speaker_active` and the UI highlight follow **actual playback**, not generation.
- `trace_event.summary` is a short public description (intent + target). It never contains
  private reasoning, system prompts or keys.
- `claims.verified` is `false` unless a tool observation set it. UI never says "verified" otherwise.
- `transcript.final:false` is a draft; UI must style partial vs final differently (03, D3).

## 5. Metrics (client clock, so no clock skew)

The client computes these and reports them; the gateway logs them.

| Metric | Definition |
|---|---|
| `interrupt_to_silence_ms` | `playback_stopped(reason=barge_in).t_client_ms` - `vad(start).t_client_ms` of the interrupting speech |
| `user_question_to_first_audio_ms` | first `playback_started` of the `human_reply` turn - `vad(end).t_client_ms` |
| `grant_to_first_audio_ms` | first `playback_started` of a turn - `turn_start` receipt time (same client) |

If an event is missing, send `available:false` with `value:null`. **Never send 0 or an estimate.**

## 6. Reconnect

- Client keeps `session_id` and last received `seq`. On disconnect it shows `disconnected`, retries
  with backoff for a bounded time, and sends `resume_session`.
- The gateway keeps a session in memory for 60 s. If it is gone, it replies with
  `notice: session_lost` and the UI offers "Start new session" and says context was lost.

## 7. Mapping to product doc flows

| Flow | Events |
|---|---|
| Start (03-C) | `start_session` -> `topic_config` -> `session_state(connecting -> waiting_first_speaker)` -> `turn_start` |
| Barge-in (03-E) | `vad(start)` -> `barge_in` -> `playback_stopped` -> `user_utterance` -> `routing` -> `turn_start(kind=human_reply)` |
| Unknown expert (RULE-12) | `routing(kind=unknown_target, question=...)` -> `session_state(processing_user)` waits for next utterance |
| No speech (ERR-05) | `notice(no_speech)` |
| End (03-I) | `end_session` -> epoch++ -> `session_state(ended)` |

## 8. Dev endpoints (so lanes plug together without discussion)

| Thing | Value |
|---|---|
| Gateway WebSocket | `ws://localhost:8000/ws` |
| Gateway HTTP (health, admin/chaos) | `http://localhost:8000` |
| Agent A2A servers | `http://localhost:9101`, `9102`, `9103` (`9104` optional) |
| Web dev server | `http://localhost:5173` (gateway must allow this origin via CORS) |
| Client config | `VITE_GATEWAY_WS_URL` (default `ws://localhost:8000/ws`) |

`web/dev/mock_gateway.py` listens on the **same** URL as the real gateway, so switching between
mock and real is just which process is running. Never change these values without a `[contract]` PR.

## 9. Golden event fixtures

`contracts/examples/*.jsonl` holds sample event sequences (start, normal turn, barge-in, unknown
target, end, disconnect). A writes them from the real gateway as soon as it emits those events;
until then B writes them from this document. The mock gateway replays them, and A's contract
test checks that real gateway output matches their shapes. Fixtures change only via `[contract]` PRs.