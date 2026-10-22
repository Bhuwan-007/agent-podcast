# A1 + B4 integration review — 2026-10-22

## Latest B5 pairing follow-up

During A2, main through `20560b2` was merged without conflicts. B5 accepts epoch 0,
assembles sentence MP3 bytes and adds an asynchronous decode cancellation token.
Its 12 frontend unit tests and production build pass. An actual-class diagnostic
with mocked Web Audio still reproduces two failures: `finished` is emitted before
pending decodes complete, and starting the second sentence's decode invalidates the
first sentence's decode. Only sentence 1 starts when 0 and 1 were expected.
Run `node eval/check_b5_player.mjs`; see `docs/b5_player_pairing_diagnostic.json`.
Whole-turn completion needs no `sentence_idx`; that earlier request was incorrect.
Source review additionally shows generation
flags and flushed sentence IDs are not reset for each new turn. Please cover multiple
turns in production-class tests. These are frontend pairing issues, not A2 text failures.
Earlier B3/B4 findings below are historical; no teammate source was changed here.

## Pre-merge verification (latest)

User authorized merging A1 into main. Main's B4 commit `71ac6e6` was merged into
the integration branch without conflicts; teammate source was not edited.
After combining: 34 Python tests passed in 0.79 s, 4 A1 player tests passed,
10 frontend tests passed, and the production build passed (887.17 kB bundle warning).
The first test attempt hit sandbox temporary-directory permissions; the approved rerun passed.
These automated checks use mocked providers/browser APIs, not new live acceptance evidence.

B4 adds real Web Audio playback and sentence-aware transcript keys. The historical
B3 findings below describe the earlier snapshot. Current pairing gaps remain:
the hook and player initialize at epoch 1 while A1 starts at 0; the player decodes
each incoming MP3 fragment separately while A1 emits fragments of a sentence;
End during asynchronous decode has no cancellation token unless the epoch advances;
Whole-turn completion needs no index; A1 requires per-sentence playback starts instead.
Topic configuration is logged but not applied to availability. Client latency still
uses speaker-active receipt and barge-in still includes placeholder progress/timed VAD.
Do not claim integrated frontend acceptance from passing simulated protocol tests.

A1's verified experience is the backend-owned `/dev/a1` page. Single-expert functional
acceptance is recorded; the 1.5 s audible-start engineering goal remains outstanding.
Merging this working increment does not certify B4 pairing or later multi-agent phases.

## Historical implementation and evidence

Branch: `gateway/a1-b2-integration`, now based on `origin/main` at `1539311` (B3).
The original workspace stays on `meds`. A1 source/tests were initially copied without committing;
the reviewed implementation is now commit `7dd261b`, published in
[draft PR #4](https://github.com/Bhuwan-007/agent-podcast/pull/4). It is not merged into main.
No `.env`, locally edited `.env.example`, or original trace files were copied.
The integration gateway reads only its own root `.env` rather than discovering a parent file.

## Executed checks

- Python A0/A1 tests: **31 passed in 0.88 s**, including bounded truncation retries and supported Groq controls.
- B3 frontend protocol tests: **6 passed**. These tests simulate protocol logic; they do not mount the production hook or prove live audio.
- Player lifecycle checks: 3 passed; mocked browser APIs, no audible-playback claim.
- Frontend locked dependencies installed with `npm ci --ignore-scripts`.
- Frontend `npm run build`: passed. Vite warned about a bundle larger than 500 kB;
  the warning does not establish a runtime failure.
- Both mock JavaScript scripts passed syntax checks.
- All 7 fixture sequences parsed: 42 events, 3 valid mono 22,050 Hz 16-bit WAV chunks.
  Frontend fixtures matched the corresponding `contracts/examples` copies byte-for-byte.
- `node eval/check_mock_gateway.mjs`: real local socket smoke check passed health,
  start/topic fixture, WAV audio fixture, mock mode, and cancellation of pending audio
  after End. The harness binds an ephemeral port in memory, allowing the original
  real gateway to remain on 8000. The teammate's source remains unchanged.

## What B2 contributes

`web/dev/mock_gateway.mjs` replays predefined JSONL event sequences so UI development can
continue without model/TTS calls. `make_audio_fixtures.mjs` generates WAV tones, not expert
speech. Fixtures cover normal turns, interruption displays, unknown targets, no speech,
disconnect displays and End. The UI adds event-driven state, transcript/claims/trace panels,
and 2D/3D table views. These are useful rehearsal tools, not live acceptance evidence.

## Lane B integration findings (source review; not fixed here)

- `audio_chunk` is ignored pending B4 playback. No live spoken output is played by the hook.
- B3 fixed premature highlight on `turn_start` and added stale-epoch filtering.
- Transcript upsert uses turn and speaker but omits sentence index, so multiple A1 sentences
  can overwrite each other.
- B3 removed the callback's dependency on `activeTurnId`, addressing the reconnect-on-turn issue.
- B3 initializes epoch to 1 while the current A1 gateway starts at 0. A fresh connection's first
  authoritative session epoch must be accepted; otherwise live events can be dropped. This
  remains a pairing issue, separate from the backend-owned harness which accepts epoch 0.
- `topic_config` is not dispatched, so the live gateway's A1 availability flags need wiring.
- B3 still uses a fixed `played_ms:500` and a timer for speech end; its stop timestamp surrounds
  code that does not yet stop a real player. These are not valid acoustic interruption evidence.
- B3 measures grant latency at receipt of `speaker_active`, which adds a server round trip;
  the contract instead defines the local first `playback_started` time. Reconcile at B4.
- Disconnect fixtures display recovery without testing a real socket disconnection.
- Decorative shader motion and room-tone/chime audio are not a real speech analyser.

## Model truncation, separate from ElevenLabs

The real diagnostic returned `finish_reason:length`: reasoning plus answer tokens reached
the configured output allowance. At 400 tokens it failed; raising to 1,024 allowed successful
turns but did not eliminate intermittent truncation. We reject cut-off output rather than
voicing it. The latest successful gateway audio stream does not prove repeatable model quality.

Implemented in this branch: verified Groq GPT-OSS low reasoning effort, `include_reasoning:false`,
and the supported `max_completion_tokens` parameter. Other providers retain their compatible
request shape. A `length` finish reason permits one retry, from 1,024 to 2,048 tokens, bounded
by a 25-second total deadline. Authentication failures are not retried. Incomplete output is
never passed to speech. No model or provider was silently substituted.

Live sample: **8/8 completed on the first attempt**, no retries; median generation **1,109.8 ms**,
maximum **1,202.5 ms**. See `a1_reliability_results.json`. This tests completion reliability for
a small sample, not long-run reliability or the multi-agent discussion-quality rubric.
Some generated product-plan claims remain unverified; do not present them as sourced research.

## Latest live transport and cancellation

- Voice lookup HTTP 200; complete dynamic model-to-TTS-to-WebSocket turn succeeded.
- **208,649 bytes / 12 chunks**, first bytes **1,620.5 ms after turn_start**; total WS check
  **2,612.9 ms**. These are receipt timings, not audible browser timings or a <1.5 s pass.
- Real End checks passed before audio and after the first audio chunk. End acknowledgement
  took **474.9 ms** and **82.8 ms** respectively; connections closed normally without post-End
  frames. These measurements do not prove acoustic stop time.
- No browser is connected to the automation tool. The user manually confirmed clear speech,
  a working typed reply, and immediate perceived stopping on End. See `a1_manual_acceptance.md`.
  Exact browser/audio-start latency is not yet recorded and the <1.5 s goal is not passed.
- The integration server is running on localhost:8000 with original .env settings loaded
  into memory; credentials were not copied. The original tracked example's two API-key
  fields were cleared as approved; original .env bytes were verified unchanged.

## Subsequent question-quality revision (latest implementation)

The user's real architecture question exposed an answer-quality issue: the model answered
how developers should review AI rather than how AI could choose architectures. The prompt
now explicitly preserves the requested actor and task, engages challenges, favors concrete
mechanisms and evaluation, and labels unimplemented mechanisms as proposals. A1 remains
standalone; no context-memory implementation was added here.

Three-sentence answers are permitted within the existing configuration. Sentence boundaries
preserve abbreviations; overlong output gets one bounded shorter-answer repair rather than
silent sentence deletion. Total attempts remain two, under the same 25-second deadline.

Final checks: **34 Python tests**, **4 player lifecycle tests**, and **3/3 real architecture
question responses** completed on the first attempt (median 1,126.3 ms). Completion is not
a semantic-quality score. Public examples and prior failed trials are retained for review.

The final live WS run received **316,525 bytes / 18 chunks**, first bytes **1,664.0 ms after
turn_start**, total **3,416.2 ms**. The earlier receipt measurements above are historical.
The user confirmed clear audio/typed reply/End before this prompt-only revision; multi-sentence
ordering is also covered by the player lifecycle test. Exact audible-start latency is unavailable.
