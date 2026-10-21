# decisions/B.md — questions and choices recorded by lane B

Written ONLY by lane B. Use when documents conflict or something is unclear and you must not guess.
Ask a human, then record the answer here. Newest at the bottom.

Template:
- YYYY-MM-DD | question or conflict (quote both documents) | decision and who approved | files affected

- 2026-10-21 | Node mock gateway language vs python (`contracts/ws_events.md` line 131 vs user instruction) | Implement mock gateway as Node.js script `web/dev/mock_gateway.mjs` using `ws` in `web/package.json` to keep frontend isolated and avoid touching requirements.txt (User approved) | `web/dev/mock_gateway.mjs`, `web/package.json`
- 2026-10-21 | Vite importing `../topics/*.json` from parent directory | Configure Vite `server.fs.allow: ['..']` and resolve alias `@topics` in `web/vite.config.ts`, directly importing JSON modules to preserve single-source-of-truth without duplicating files | `web/vite.config.ts`, `web/tsconfig.json`
- 2026-10-21 | Missing `09_TEAM_HANDOFF_AND_CONTRACT.md` referenced in `ws-events.md` and `04_DESIGN_SYSTEM.md` | Ignore missing file; `contracts/ws_events.md` is canonical and authoritative (User approved) | none
- 2026-10-21 | Local-only states vs gateway event-driven states (reconciliation R3) | S0 (`ready`) and S1 (`connecting`) set locally before session_state; S4 (`user_speaking`) set locally on VAD start; S7 (`recovery`) set locally on socket close. All others (S2, S3, S5, S6, S8) driven strictly by gateway `session_state` events (User approved) | `web/src/hooks/useGatewayWs.ts`
- 2026-10-21 | Speaker visualization in B3 (doc 04 waveform vs realism) | No waveform animation in B3. Use text badges and color highlight cards. Waveform will be added in B4 driven solely by real Web Audio `AnalyserNode` (User approved) | `web/src/components/ExpertCard.tsx`
- 2026-10-22 | Authoritative speaker highlight gating (RULE-32 & contracts/ws_events.md) | `turn_start` only signals turn initialization and records client receipt time; speaker highlight is strictly gated on `speaker_active` / `playback_started`. On `turn_end` or `playback_stopped`, active highlight is immediately cleared. | `web/src/hooks/useGatewayWs.ts`
- 2026-10-22 | Client-clock metrics computation and transmission (AT-06, Section 4 & contracts/ws_events.md Section 5) | `interrupt_to_silence_ms`, `grant_to_first_audio_ms`, and `user_question_to_first_audio_ms` are measured on the browser's high-resolution `performance.now()` clock. Unmeasured metrics are preserved as `null` and rendered as `Unavailable` in the Minutes Drawer; never fabricated or displayed as 0. | `web/src/hooks/useGatewayWs.ts`, `web/src/components/MinutesDrawer.tsx`
- 2026-10-22 | Claims verification distinction (RULE-06) | In the Minutes drawer, claims with `verified: true` are explicitly rendered as `✓ Verified by tool`; claims with `verified: false` are rendered as `Claimed (Unverified)` to maintain clear factual transparency. | `web/src/components/MinutesDrawer.tsx`
- 2026-10-22 | Browser microphone integration (RULE-16 & ERR-03) | Integrated real browser `navigator.mediaDevices.getUserMedia` with echo cancellation. Permission denial triggers `mic_denied` slip with clear recovery instructions, while state transitions to `denied` and dispatches canonical `mic_state` event. | `web/src/hooks/useGatewayWs.ts`, `web/src/components/Slip.tsx`
