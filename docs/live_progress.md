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
