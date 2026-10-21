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