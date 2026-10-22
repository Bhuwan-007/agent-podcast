# Live roundtable progress — 2026-10-22

The user authorized continuing remaining phases during the final-hour shipping effort.

## A3

`gateway/runtime.py` starts independent A2A services. `gateway/panel_session.py` connects
the selected expert to its own configured ElevenLabs voice, waits for playback confirmation
before advancing the floor, and cancels/invalidates audio on End. `gateway/launch.py` loads
an explicitly selected private environment file in memory and enables panel mode.

```powershell
python -B -m gateway.launch --env-file "C:/Dev/Hacks/multiagent podcast/.env" `
  --bid-model openai/gpt-oss-20b --speak-model openai/gpt-oss-120b --bid-timeout-ms 2500
```

These are explicit diagnostic overrides, not changes to `.env`. Ordinary uvicorn defaults
to A1 unless `ROUNDTABLE_MODE=panel`. Shared browser events are unchanged.
3 panel tests plus 10 A1 session checks passed using mocked external services. They verify
voice selection, ordering, configuration errors and cancellation, not real audio quality.
Real three-voice acceptance is pending: saved voice lookups returned 200/400/400.

Correction: whole-turn `playback_stopped` needs no sentence index. A1 instead requires
per-sentence `playback_started` before accepting completion. The earlier index request
is withdrawn. The valid B5 findings remain premature completion and decode invalidation.

## A4

Implemented conservative role/name routing and best-fit bid selection for general questions.
Unknown or ambiguous names ask for clarification. Typed input is excluded from voice evidence.
Barge-in cancels model/TTS work and advances epoch; only fully confirmed sentences are retained
from an interrupted turn. The incomplete current sentence is omitted, not invented as heard.
An expert answers through real A2A `human.question`; peers receive `floor.resume` afterwards.

`gateway/voice/stt.py` sends bounded in-memory audio to ElevenLabs Scribe v2. No microphone
files or raw audio traces are written. The adapter follows the official convert endpoint:
https://elevenlabs.io/docs/api-reference/speech-to-text/convert . Provider retention policy is
separate from local no-disk handling; enterprise zero-retention was not requested or claimed.
`/dev/roundtable` is a backend-owned test page with real Web Audio, a 250 ms VAD guard,
microphone consent, typed fallback and playback metrics. It does not modify teammate UI files.

64 backend tests passed, covering A1/A2/A3 and A4 routing, stale-epoch suppression,
confirmed-prefix retention, question reply/resume and malformed microphone audio.
Provider/model/audio services are explicitly mocked in these automated session checks.
The user approved replacing only Agents 2/3 with Roger/Sarah; all three metadata lookups
then returned HTTP 200. Real TTS, STT and gateway checks are recorded separately.

## A5–A8 and final evidence

A5: added a bounded verbatim ledger and memory archive (60 turns, 120 unverified sentence
records), actor-constrained claim transitions, quote-based earlier-reference retrieval,
extractive rolling context and explicit topic-focus changes without restarting. These are
not verified facts or a semantic claims classifier. Summaries are extractive, not LLM-generated.
Incomplete interrupted sentences are omitted rather than falsely recorded as heard.

A6: health checks every three seconds, four-second generation deadlines, fallback to another
eligible bidder, and a single explicitly configured model fallback on HTTP 429/5xx. Authentication
errors are never retried. Guarded localhost chaos endpoints can kill only owned expert processes,
or inject stall/error faults; disabled by default. Mocked regression proves failover and bounded
fallback. Live chaos is not certified; TTS errors still enter honest recovery rather than claiming
successful speech. Reconnect replay is not implemented and returns honest session_lost.

A7: optional bounded text preparation during current audio; exact utterance, version, memory
and direct-inbox keys gate reuse. Interruption/context changes discard stale drafts. Model-call
reuse/invalidation tests pass. The real text timing probe failed with A2AError, so no speedup is
claimed and `--drafts` stays OFF for the demo. See docs/draft_probe_results.json.

A8: `python -m eval.run_eval` runs the actual regression/player gates and writes
`docs/eval_results.md` without paid calls. Public traces, provider reports, failure baselines,
scope boundaries and run commands are included. Final frontend acceptance and submission
README/video assembly remain separate; no final-product or judging score is claimed.

Latest automated gates: 70 backend tests and 4 checks for each of A1/panel player scripts pass.
Real TTS produced bytes for all three configured voices; real STT transcribed a synthesized
question in 3169.5 ms (not a live microphone check). A real gateway turn streamed 455289 bytes;
start to first received bytes 3830.3 ms. That is transport timing, not an audible-start pass.
The later real-provider protocol run streamed 1441226 bytes across all experts, targeted Maya,
resumed and confirmed End in 19784 ms. Its playback acknowledgements were synthetic and are
explicitly excluded from acoustic/microphone acceptance. Browser control was denied Chrome
access by Computer Use. The frontend B5 production-player diagnostic remains a known failure.

## Reproduce the working demo

Install requirements in a Python virtual environment. Start the real backend with:

```powershell
python -m gateway.launch --env-file "C:/Dev/Hacks/multiagent podcast/.env" `
  --bid-model openai/gpt-oss-20b --speak-model openai/gpt-oss-120b `
  --fallback-model openai/gpt-oss-20b --bid-timeout-ms 2500
```

Open http://localhost:8000/dev/roundtable. Start Topic 1, select a target or name one,
and use typed input or the microphone button. Headphones reduce echo. End clears queued
audio immediately locally. `/dev/a1` remains a single-expert regression page using `/ws/a1`.
The ordinary uvicorn entrypoint retains A1 behavior; the explicit launcher enables panel mode.
Add `--chaos` only for deliberate failure demos; POST `/admin/chaos/<agent>/kill|stall|error|reset`
with `X-Demo-Chaos: 1` from localhost. `--drafts` is experimental and not enabled by this command.
Use `python -m eval.live_panel_check --env-file <private path>` for paid provider checks and
`python -m eval.live_protocol_check` for the synthetic-playback protocol check.
