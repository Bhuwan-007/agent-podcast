# AI Roundtable — A1 integration guide

## Scope and evidence

A1 supplies a real provider path: Topic 1 → one Alex model response → ElevenLabs MP3 →
gateway WebSocket → a backend-owned browser check at `/dev/a1`.
It is a single-expert integration milestone, not a multi-agent discussion. A2 introduces
independent A2A servers, Agent Cards, bids, grants and autonomous speaker selection.
There are no synthetic dialogue fixtures on the production path.

The user approved using the existing root `ws-events.md` on 2026-10-21. It matches the
fetched `origin/main` version. This guide explains our A1 subset; it does not replace,
move or amend that shared contract. The referenced `contracts/ws_events.md` path is
still absent. `workflow/reconciliation.md` supplies the documented amendments.

## Run and check

1. Configure the gitignored `.env` from `.env.example`. Set `ELEVENLABS_API_KEY`,
   `VOICE_ID_AGENT1`, `LLM_BASE_URL`, and `LLM_MODEL_SPEAK`; set `LLM_API_KEY` if the
   model endpoint requires authentication. Use an open-weight model. No key belongs
   in the browser, chat, committed source or traces.
2. Install the existing pinned requirements: `python -m pip install -r requirements.txt`.
3. Start: `python -B -m uvicorn gateway.main:app --host 127.0.0.1 --port 8000`.
   Restart after changing `.env` so the process reads the new settings.
4. Open `http://localhost:8000/dev/a1`, then click **Start Topic 1**. The click unlocks
   browser audio. This performs real model/TTS requests and uses provider credits.
5. Hear Alex's generated response. After playback ends, enter a typed question and
   choose **Ask Alex**. Each question is standalone in A1; conversation memory is A5.
6. Click **End and stop audio** during generation or playback. The test page stops
   locally and the gateway cancels work and increments the epoch.

Automated checks: `python -B -m pytest eval/ -v -p no:cacheprovider`.
The tests explicitly mock external providers and cannot prove audible quality or live latency.

Optional transport-only live check, while the server runs: `python -B -m eval.a1_smoke`.
This counts received real audio bytes; it never sends fake playback acknowledgements.
It does not verify decoding or audible playback. No audio is saved by either check.

## How the files connect

- `gateway/main.py` owns `/health`, `/ws`, origin checks and `/dev/a1`. Provider services
  are configured lazily, so health remains available without keys.
- `gateway/session.py` owns connection-local state, one active turn, monotonically
  increasing turn IDs, cancellation epochs, event emission and playback acknowledgements.
- `topics/topic_1.json` is Lane B's exact public content. The loader restricts input to
  Topic 1 rather than accepting arbitrary file paths. Topics 2/3 are unavailable in A1.
- `agents/personas/topic_1/ai_engineer.yaml` supplies Alex's backend behavior and voice
  environment variable. The other roles are advertised with `available:false` in A1 output.
- `agents/llm.py` calls the configured OpenAI-compatible `/chat/completions` endpoint.
  It generates up to three short sentences, rejects incomplete/provider-error output,
  ignores provider reasoning fields and removes `<<<CLAIMS>>>` metadata before speech.
  It does not fabricate A2A traffic. Sentence splitting is a simple A1 heuristic.
  For verified Groq GPT-OSS models it uses low reasoning effort and excludes reasoning
  fields. A length cutoff or oversized/overlong-sentence-count response gets at most
  one retry within 25 seconds; oversized output is asked to be shorter rather than
  cut mid-answer. Authentication failures are not retried. No provider/model substitution
  is performed. Common abbreviations such as "vs." do not split spoken sentences.
- `gateway/voice/tts.py` sends each sentence to ElevenLabs' `stream-input` WebSocket and
  yields decoded audio bytes. One shared adapter bounds concurrent provider connections.
- `gateway/dev_a1.html` assembles each sentence's MP3 bytes, decodes them with Web Audio,
  plays sentences sequentially and sends playback acknowledgements. It is a technical
  test page, separate from Lane B's frontend. This buffering adds latency.
- `gateway/tracing.py` writes opening-input and timing evidence as JSONL. No audio or
  API credentials are placed in those records.

## Events used in A1

On `start_session(topic_id:"topic_1")`, the gateway emits `session_state(connecting)`,
`topic_config`, an explicit single-expert limitation notice, `waiting_first_speaker`,
unavailable metrics, `turn_start`, and `agent_generating`. The exact opening prompt is
passed to the model, not spoken verbatim as its reply.

The generated response produces `transcript(final:false)` and streamed `audio_chunk`
events for each sentence, followed by `turn_end(status:"completed")`. Every audio,
transcript and turn event has a `turn_id` and `epoch`. Audio uses `mime:"audio/mpeg"`,
`data_b64`, `sentence_idx` and a connection-local increasing audio `seq`.

**Production and playback are separate:** `turn_end(completed)` closes generation, not
the playback queue. The client flushes its last sentence at that boundary, plays all
queued sentences and sends `playback_stopped(reason:"finished")` afterward.
`playback_started` is required for each sentence before the gateway emits `speaker_active`
and `agent_speaking`. A final agent transcript is emitted after the client confirms the
turn finished, for sentences it reported starting. This relies on honest client
acknowledgements; there is no independent acoustic measurement or word alignment.

A1 reuses `waiting_first_speaker` as its waiting state between standalone typed checks.
The full panel's continuous bid/grant loop replaces this A1-only wait in A2/A3.

Typed input uses the contract's `user_utterance` with `input_mode:"text"`, `final:true`,
and `target_hint:"ai_engineer"`. Other selected targets are reported unavailable rather
than silently routed. A second turn is refused while the current turn is active.

End cancels the worker before emitting the new epoch's `session_state(ended)` and
closing the socket. Clients must stop locally immediately and reject stale output.
Matching `barge_in` also invalidates the active turn, but A1 does not recognize speech,
route it or resume a discussion. These remain A4 acceptance requirements.

Malformed JSON/non-text WebSocket frames close with 1008; oversized text closes with 1009.
Only configured browser origins are accepted. Origin-less CLI clients are allowed.
This is a local development service, without production authentication or rate limiting.

## Timings and unavailable features

`a1.first_audio_received` traces contain `turn_to_first_audio_received_ms`, measured
from turn generation start through model completion to the first received TTS bytes.
`tts_first_audio_received_ms` in Python logging measures only the provider connection
to first audio receipt. Neither is audible browser latency.

The test page displays local turn-receipt-to-first-playback timing. The shared three
metrics stay `value:null, available:false` on the backend until their client reporting
shape is agreed. No 1.5-second latency pass is claimed without a live measurement.

The user confirmed clear playback, working typed replies and immediate perceived End
stopping in `docs/a1_manual_acceptance.md`. The revised prompt was separately checked
against the user's architecture question in `docs/a1_question_quality_results.json`.
Those examples now discuss AI selection mechanisms and validation; they are not a
formal discussion-quality pass and do not add session memory to A1.

Reconnect replay/session retention, microphone capture, STT, routing, claims ledger,
multi-agent turns and context continuity are not implemented here. `resume_session`
returns an honest `session_lost` notice; disconnection cancels the connection's work.

## Lane B integration requests

1. Point `VITE_GATEWAY_WS_URL` at `ws://localhost:8000/ws`. Run either the mock gateway
   or real gateway on port 8000, not both. Keep mock banners for mock data.
2. Assemble MP3 chunks by turn/epoch/sentence; do not decode arbitrary partial MP3 chunks
   as independent files. Close the final sentence on `turn_end(completed)`.
3. Report actual `playback_started`, `playback_progress` and `playback_stopped`. Highlight
   only after playback starts. Clear audio immediately on End or higher epochs.
4. Honor `topic_config.agents[].available`; A1 only exposes Alex as available. Do not
   portray the other two cards or static preview messages as active backend agents.
5. Confirm the ambiguous parts before A3/A4: final transcript semantics for partial speech,
   client-to-gateway metrics schema (not listed in the current client event examples),
   global event sequence/replay rules (only audio has a defined seq), and the missing idle
   state for a stopped panel. Agree additions through the existing contract PR workflow.

## Provider references checked

- [ElevenLabs streaming guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts)
- [ElevenLabs WebSocket reference](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)
- [Together chat completions](https://docs.together.ai/reference/chat-completions)
- [FastAPI WebSocket testing](https://fastapi.tiangolo.com/advanced/testing-websockets/)

The pinned local `websockets==14.1` API was inspected. Runtime model/voice availability
and real provider behavior must still be established with the configured accounts.
