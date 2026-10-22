# Person A MVP acceptance - 2026-10-22

## What the listener gets

Three independently running experts discuss Topic 1 through A2A. The gateway acts
like a producer: it chooses among bids without writing arguments, streams real
ElevenLabs voices, and only remembers complete sentences confirmed by the player.
The listener can interrupt, address Maya, pause/resume, finish with takeaways,
restore a disconnected episode, and download the delivered transcript.
The backend-owned page at `/` and `/dev/roundtable` contains these controls.
The teammate's React client remains separately owned and is not the full acceptance path.

## Final actual checks

| Check | Actual result | Boundary |
|---|---|---|
| `mvp_episode_results.json` | PASS: 145453.8 ms, 2046607 real audio bytes; Sam, Maya and Alex complete; Pause/Resume, targeted Maya question, closing, export, End | Synthetic playback acknowledgements with explicit 20 s pacing |
| `mvp_voice_gateway_results.json` | PASS: 10894.6 ms; 83217 bytes synthesized user speech through actual gateway STT; Maya reply 381684 bytes; resumed and End | Synthesized input, not a physical microphone |
| `mvp_recovery_results.json` | PASS: 9461.7 ms; disconnect restores paused without replay; kill Sam; Alex audio; reset; End | Deliberate owned-child fault, not arbitrary production resilience |

Episode first-byte receipt intervals were 933.2-3988.9 ms. Pause HTTP control
acknowledgement was 220.2 ms. These are measured transport/control intervals,
not audible-start or acoustic-stop latency. The episode skipped one failed/stalled
expert turn and used `attributed_extractive_fallback` after a closing validation
failure. This is a disclosed recovery, not a successful generated closing.
Failed initial reports are retained with `before`, `initial` or `retry_only` names.

A narrow transcript review found Maya correctly limited the Reflexion inference:
feedback-based task improvement does not establish general architecture judgment;
she proposed a controlled project-design evaluation. Alex's proposed security-triage
agent carried a ReAct source ID, but that abstract does not establish its efficacy.
This remains a proposal, and every annotation is marked not independently verified.
Reference validation prevents unknown IDs; it does not prove semantic entailment.
No overall accuracy score or guaranteed factual correctness is claimed.

## Why the fixes matter

`gateway/panel_session.py` now enters a genuinely paused recovery state when an
expert, bid round, playback or transcription fails. Resume can restart from delivered
context instead of doing nothing. A single bounded bid retry handles transient
errors without overriding deliberate pass bids or manufacturing a speaking order.

`agents/model.py` uses the documented efficient Qwen instruct mode for bid requests.
`agents/speech_output.py` constrains supported Groq speech to sentences and typed
source/reply/correction annotations; `base_agent.py` independently validates them
before speaking. Invalid output still fails visibly instead of being presented as
successful audio. Older providers retain the existing validated delimiter path.
`gateway/evidence.py` accepts legitimately retrieved delivered references.

Provider documentation: [Groq reasoning](https://console.groq.com/docs/reasoning)
and [strict structured output](https://console.groq.com/docs/structured-outputs).

## Reproduce

Use docs/DEMO.md for installation and explicit live launcher settings. This run used
Qwen 3.8 27B bids, GPT-OSS 120B speech, configured GPT-OSS 20B fallback, a 2500 ms bid
deadline, and speculative drafts disabled. The unchanged 400 ms default has not passed.
Load the private `.env` explicitly; do not commit keys or voice IDs.

```powershell
python -B -m eval.run_eval
npm test --prefix web
npm run build --prefix web
# Paid, real APIs; gateway already running on isolated port 8001:
python -B -m eval.live_episode_check --base http://127.0.0.1:8001 --output docs/mvp_episode_results.json
python -B -m eval.live_voice_gateway_check --base http://127.0.0.1:8001
python -B -m eval.live_recovery_check --base http://127.0.0.1:8001 --output docs/mvp_recovery_results.json
```

The recovery runner needs `--chaos` on the launcher. Ordinary demo use does not.
No provider responses were mocked in these three live reports. Automated regression
suites do use labelled doubles. Current exact gate results are in docs/eval_results.md.

## Open acceptance and scope

The user agreed to try the current browser page but has not yet reported sound/mic
results. Browser automation was denied access; no acoustic or real-microphone pass
is inferred. Optional A7 remains disabled. Only Topic 1, a fixed three-person roster
and reviewed abstract passages are implemented. No arbitrary uploads, comprehensive
live research, durable session storage, recording export, or organizer scoring claim.
The app cannot guarantee model availability or prevent every unsupported inference.

## Final regression gate

89 Python tests passed (one upstream AnyIO deprecation warning); 4 A1 player,
8 panel player and 6 actual TypeScript player lifecycle tests passed. Frontend
pairing diagnostic passed. Teammate frontend unit tests: 12 passed; production
TypeScript/Vite build passed with the existing approximately 896 kB bundle warning.
No frontend source was changed in this final backend patch.

## Browser restart audio fix

A user reported audible preflight but silent Start. The latest session trace showed
provider audio at 644.9 ms with no playback-start acknowledgement. A regression
reproduced cancellation keys surviving pause/end/start: the new episode reused turn
1/epoch 0 and its audio was discarded as cancelled. Fresh episodes now clear those
keys and previous report state; restored sessions retain cancellation protection.
Retired socket callbacks cannot stop a newer session. The restart test failed before
the fix and passes after it. All eight panel lifecycle tests pass with browser API
doubles; this does not certify actual audibility. Refresh the page to load the fix.

Retry on the running port-8001 gateway produced 237026 real introduction audio bytes
in 2802.6 ms from setup through generation completion; End was acknowledged. The
served page contained the reset fix. Frontend units (12) and build also passed.
This transport retry still does not establish browser audibility.
