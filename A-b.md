# handoff/A-to-B.md — requests from lane A (backend) to lane B (frontend)

Written ONLY by lane A's agent/human. Lane B reads it, acts, and replies in `B-to-A.md`.
Keep entries short, newest at the bottom. Contract changes still need a `[contract]` PR.

Template:
- [ ] YYYY-MM-DD HH:MM | what A needs from B or what changed | files/events involved | status: open/done

- [ ] 2026-10-22 | A3 panel backend implemented; 13 panel/A1 session tests pass with mocked providers. Real three-voice acceptance pending accessible IDs. CORRECTION: whole-turn playback_stopped does NOT require sentence_idx; withdraw that request. Per-sentence playback_started is required. Premature completion and decode invalidation still reproduce. | gateway/panel_session.py, docs/live_progress.md | status: open

- [ ] 2026-10-22 | Latest: pulled B5 through 20560b2; 12 frontend units/build pass. Actual AudioPlayer diagnostic with mocked Web Audio fails: finished before decode and sentence 0 dropped when sentence 1 decode starts. Reproduce `node eval/check_b5_player.mjs`; JSON evidence in docs/b5_player_pairing_diagnostic.json. Please keep one cancellation token per invalidation, wait for pending decodes, reset state each turn, and include sentence_idx in completion acks. A2 text run reached 10 real turns; default bid latency/quotas remain explicit limits. No teammate source edits from A. | web/src/audio/AudioPlayer.ts, web/src/hooks/useGatewayWs.ts | status: open

- [ ] 2026-10-22 | A2 is an independent text-only CLI with three real A2A services; no browser events or shared contracts changed. A1 merged in PR #4 and latest B4 is included locally. Do not mark three frontend voices available until A3 pairing. Please apply the playback/initial-epoch/sentence-ack fixes in docs/integration_review.md in your lane. New A2 dependency pins require reinstalling requirements.txt in a virtual environment. See docs/a2_protocol.md for setup and scope. | agents/**, gateway/{a2a_client,moderator,cli}.py, requirements.txt | status: open

- [x] 2026-10-21 17:05 | Phase A0 scaffold ready for B: requirements.txt, .env.example, Makefile, gateway /health on 8000 (CORS allows 5173), logs/traces/ | requirements.txt, .env.example, gateway/main.py, Makefile | status: done

- [ ] 2026-10-21 | A1 single-expert `/ws` and backend `/dev/a1` harness implemented against root `ws-events.md`, authorized by user. Please integrate MP3 sentence queue + actual playback acks; only Alex is available. `turn_end(completed)` means generation ended, not audio ended. Honor epoch invalidation and stop locally on End. See `docs/protocol.md` for exact scope, known contract gaps and run steps. Live-provider/audio acceptance is pending credentials; no full A1 pass claimed. | gateway/main.py, gateway/session.py, docs/protocol.md | status: open

- [ ] 2026-10-22 | Update: B3 commit 1539311 pulled into gateway/a1-b2-integration. Real A1 stream and user listening/typed reply/End check passed; 8/8 live model samples completed after reliability fix. First audio receipt 1620.5 ms: no <1.5 s audible-start pass. For B4 please wire audio playback/acks, accept the fresh session's authoritative epoch (A1 starts at 0, B3 assumes 1), preserve transcript sentences, handle topic_config availability, and use actual playback/VAD timestamps rather than fixture values or speaker_active receipt. See docs/integration_review.md. No A1 merge into main yet. | web/src/hooks/useGatewayWs.ts, docs/protocol.md | status: open


## Final demo handoff ? 2026-10-22

AudioPlayer.ts repair was explicitly authorized by the user and merged separately in PR #8. Actual-player regression tests and pairing diagnostic pass; other web source is untouched. The new episode controls/source review/export live in the backend-owned demo at /dev/roundtable (also /), not in the cinematic React hook. Existing /ws clients remain compatible; prepared episode setup is an optional HTTP endpoint plus setup_id URL query. No shared WebSocket contract edit was made.

See docs/DEMO.md for setup and a judge walkthrough. The isolated final-development server uses localhost:8001 while the prior port-8000 process is preserved. Real short-episode transport passed with synthetic acks; live microphone/audibility are unverified. A live expert-kill/restore test did not recover speech, so do not label the whole recovery acceptance passed. Long-loop failures and the corrected semantic-summary baseline are retained. Do not turn a source citation into a verification badge: the entailment still needs review.
