# handoff/A-to-B.md — requests from lane A (backend) to lane B (frontend)

Written ONLY by lane A's agent/human. Lane B reads it, acts, and replies in `B-to-A.md`.
Keep entries short, newest at the bottom. Contract changes still need a `[contract]` PR.

Template:
- [ ] YYYY-MM-DD HH:MM | what A needs from B or what changed | files/events involved | status: open/done

- [x] 2026-10-21 17:05 | Phase A0 scaffold ready for B: requirements.txt, .env.example, Makefile, gateway /health on 8000 (CORS allows 5173), logs/traces/ | requirements.txt, .env.example, gateway/main.py, Makefile | status: done

- [ ] 2026-10-21 | A1 single-expert `/ws` and backend `/dev/a1` harness implemented against root `ws-events.md`, authorized by user. Please integrate MP3 sentence queue + actual playback acks; only Alex is available. `turn_end(completed)` means generation ended, not audio ended. Honor epoch invalidation and stop locally on End. See `docs/protocol.md` for exact scope, known contract gaps and run steps. Live-provider/audio acceptance is pending credentials; no full A1 pass claimed. | gateway/main.py, gateway/session.py, docs/protocol.md | status: open

- [ ] 2026-10-22 | Update: B3 commit 1539311 pulled into gateway/a1-b2-integration. Real A1 stream and user listening/typed reply/End check passed; 8/8 live model samples completed after reliability fix. First audio receipt 1620.5 ms: no <1.5 s audible-start pass. For B4 please wire audio playback/acks, accept the fresh session's authoritative epoch (A1 starts at 0, B3 assumes 1), preserve transcript sentences, handle topic_config availability, and use actual playback/VAD timestamps rather than fixture values or speaker_active receipt. See docs/integration_review.md. No A1 merge into main yet. | web/src/hooks/useGatewayWs.ts, docs/protocol.md | status: open
