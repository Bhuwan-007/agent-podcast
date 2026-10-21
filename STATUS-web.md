# STATUS-web.md — Frontend (Lane B) Development Status

## Phase B1: Web Skeleton + Topic Content — COMPLETED (PASSED)

### Completed
- [x] Initialized workspace and reviewed all product, contract, and workflow documents.
- [x] Recorded Lane B technical decisions in `decisions/B.md` and `B.md`:
  - Node mock gateway script (`web/dev/mock_gateway.mjs`) using `ws` in `web/package.json` to keep frontend isolated and avoid touching `requirements.txt`.
  - Vite `@topics` path alias and `server.fs.allow: ['..']` in `web/vite.config.ts`, directly importing JSON modules to preserve single-source-of-truth.
  - Ignored missing `09_TEAM_HANDOFF_AND_CONTRACT.md` reference per user step 6.
  - Clarified local-only states S0/S1/S4/S7 (reconciliation R3); all other states driven by gateway `session_state`.
  - Set text/color speaker indicator for B3 without fake waveforms (real Web Audio AnalyserNode waveform deferred to B4).
- [x] Created `topics/topic_1.json` with exact verbatim organizer prompt, background brief, and roles (`ai_engineer`, `software_developer`, `oss_maintainer`).
- [x] Created `topics/topic_2.json` and `topics/topic_3.json` marked `available: false` (rendered disabled with "Unavailable" badge; never claim support).
- [x] Scaffolded Vite + React + TypeScript in `web/` with Inter font, design tokens in `web/src/index.css` per doc 04, and reduced-motion support.
- [x] Implemented Screens A through F:
  - **Screen A (Topic Selection / Lobby):** Product brand, 3 topic cards (Topic 1 selectable, Topics 2 & 3 disabled), verbatim opening prompt preview, role tags, and permissions notice.
  - **Screen B (Desktop Session - 1440px):** S3 `agent_speaking` active state, 3 ExpertCards with speaker indicator, spotlight quote, live transcript (draft vs. final), TargetSelector, Mic control, Claims ledger, A2A trace panel, and client-clock metrics.
  - **Screen C (Mobile Session - 390px):** Responsive mobile viewport layout with vertically stacked cards, scrollable transcript, and sticky bottom touch controls.
  - **Screen D (Interrupted / Listening):** Visual mid-sentence barge-in state (S4 `user_speaking` / S5 `processing_user`), interrupted turn indicator, and target routing notice.
  - **Screen E (Error / Recovery):** S7 `recovery` state displaying notices for `mic_denied`, `disconnected`, and `agent_timeout` with retry actions.
  - **Screen F (Session Ended):** S8 `ended` state with "Roundtable Concluded", audio buffer cleared notice, transcript review, and "Start New Roundtable" CTA.
- [x] Client configuration: `web/src/config/clientConfig.ts` with `VITE_GATEWAY_WS_URL` (default `ws://localhost:8000/ws`).
- [x] **Acceptance Check B1:**
  - `npm run build` passed with 0 errors.
  - `npm run dev` running on `http://localhost:5173`.
  - Browser subagent verified all screens A through F interactively and captured visual proof.
  - Opening prompt in `topics/topic_1.json` verified verbatim against `05_OFFICIAL_TOPICS.md`.

---

## Next Phase: Phase B2 — Mock Gateway + Golden Fixtures (dev only)
- Create `web/dev/mock_gateway.mjs` listening on `ws://localhost:8000/ws` using Node `ws`.
- Generate fixtures in `web/dev/fixtures/*.jsonl` with real short synthetic audio/WAV chunks, proper epoch increments on barge-in/end, and all event types in `contracts/ws_events.md`.
- Display persistent "Mock data" banner when `mode: "mock"`.
