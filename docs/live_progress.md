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
