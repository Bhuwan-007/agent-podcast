# STATUS-web.md — Frontend (Lane B) Development Status

## Phase B2: Mock Gateway + Golden Fixtures + "The Table" UI — COMPLETED (PASSED)

### Completed
- [x] Implemented "The Table" design system per `04_DESIGN_SYSTEM.md` v2:
  - Palette: `--room` (#17120F), `--wood` (#5A3F2E), `--wood-edge` (#3C2A1F), `--inlay` (#2A1F19), `--paper` (#EADFC8), `--ink` (#1C1612), `--light` (warm radial spotlight pool).
  - Typography: Fraunces (display/headings), Newsreader (body/transcript), Instrument Sans (controls/labels), IBM Plex Mono (traces/metrics).
  - SVG paper-noise filter (`feTurbulence`) for subtle paper texture; two-tone wood gradient.
  - Components created: `RoundTable`, `Seat`, `NamePlate`, `YourSeat`, `Spotlight`, `ThreadLayer`, `SpeechSlip`, `MinutesDrawer`, `TableCard`, `Slip`.
- [x] Golden Event Fixtures created in `contracts/examples/*.jsonl` and `web/dev/fixtures/*.jsonl`:
  - `start.jsonl`: `topic_config`, `session_state` (`connecting` -> `waiting_first_speaker`).
  - `normal_turn.jsonl`: `turn_start` (kind: agent), `audio_chunk` (valid PCM WAV base64), `transcript` (draft vs final), `speaker_active`, `claims_update`, `trace_event`, `turn_end`, `metrics`.
  - `barge_in.jsonl`: mid-turn interruption, epoch increment (1 -> 2), `session_state` (`user_speaking`), `routing`, `turn_start` (kind: human_reply), Maya response audio chunk.
  - `unknown_target.jsonl`: `routing` (`kind: unknown_target`, `question: "Which expert did you mean?"`), notice slip.
  - `no_speech.jsonl`: `notice` (`code: no_speech`, level: warn).
  - `disconnect.jsonl`: `session_state` (`recovery`), `notice` (`code: disconnected`).
  - `end.jsonl`: `session_state` (`ended`), epoch increment (epoch 3).
- [x] Generated valid 16-bit PCM WAV audio chunks (`createWavBuffer`) for Alex (G4), Sam (E4), and Maya (A4) encoded as base64 in fixtures.
- [x] Built Mock Gateway (`web/dev/mock_gateway.mjs`) running on `ws://localhost:8000/ws` and `http://localhost:8000`:
  - Replays golden fixtures with realistic turn timing.
  - Enforces `mode: "mock"`.
  - Handles client messages: `start_session`, `barge_in`, `address_agent`, `end_session`, `resume_session`, and dev triggers.
- [x] Client WebSocket hook (`web/src/hooks/useGatewayWs.ts`) wired to `VITE_GATEWAY_WS_URL`:
  - Dispatches and receives all canonical event types from `contracts/ws_events.md`.
  - Controls active speaker spotlight, speech slip, thread drawing, and Minutes tabs.
- [x] **Voice-Focused 3D Cinematic Experience (`ThreeTableScene` + `CinematicTable`):**
  - Replaced planetary concept with **"The Table"**: top-down and 3D round table session where each AI expert and the user are seated at custom chairs with acoustic voice orbs.
  - **Voice-Driven Camera Focus:** Instead of scrolling, live voice events (`speaker_active`, user speech) smoothly glide the camera across the table to frame the active speaker with intimate cinematic perspective and dynamic FOV zoom (30° close-up, 42° overview).
  - **GLSL Audio-Reactive Avatar Shaders:** Ethereal acoustic spheres sitting in chairs ripple with procedural noise displacement in each agent's signature palette (Alex: oxblood, Sam: brass/ochre, Maya: plum, You: ivory/green).
  - **Studio Lighting & Spotlight:** Overhead fill with a moving warm spotlight (`THREE.SpotLight`) with soft shadow that dynamically tracks the active speaker.
  - **Sci-Fi / Studio Targeting Reticle Cursor:** Smooth custom cursor with spinning locked corner brackets on focus.
  - **Typewriter Speech Telemetry HUD:** Streaming character-by-character live speech subtitle card with blinking block cursor (`█`).
  - **Web Audio Room Acoustics Engine:** Subtle room tone drone (lowpass filtered 55Hz) with acoustic chime feedback on focus shift.
  - **View Switcher:** Segmented toggle between `3D Voice Focus` and `2D Table Blueprint`.
- [x] **Acceptance Check B2:**
  - Mock gateway starts on `ws://localhost:8000/ws` and passes `/health`.
  - UI connects and executes complete interactive lifecycle across all fixture types (`start`, `normal_turn`, `barge_in`, `unknown_target`, `no_speech`, `disconnect`, `end`).
  - Persistent ink-on-brass "MOCK DATA" banner active.
  - Browser subagent verified all flows, screens, 3D voice focus camera glides, and Minutes drawer tabs (recordings saved).

---

## Next Phase: Phase B3 — Live Session UI Driven Only by Events
- State machine S0–S8 strictly driven by `session_state` events (with local S0/S1/S4/S7).
- ExpertCard / Seat states, speaker highlight only after `playback_started` / `speaker_active`.
- Microphone toggle and addressing via NamePlate / TargetSelector.
- Claims list honoring verified state rule.
- Client-clock metrics panel (unavailable shown as unavailable).
