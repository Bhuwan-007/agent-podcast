# STATUS-web.md — Frontend (Lane B) Development Status

## Phase B3: Live Session UI Driven Only by Events — COMPLETED (PASSED)

### Completed
- [x] **Strict Event-Driven State Machine (S0–S8):**
  - Fully implements reconciliation decision R3: Local-only states S0 (`ready`), S1 (`connecting`), S4 (`user_speaking` on VAD / bargeIn), and S7 (`recovery` on WebSocket close / mic denied).
  - All other states (S2 `waiting_first_speaker`, S3 `agent_speaking`, S5 `processing_user`, S6 `agent_generating`, S8 `ended`) driven strictly by canonical `session_state` events from the gateway.
- [x] **Authoritative Speaker Highlight (RULE-32 & RULE-33):**
  - Gated strictly on `speaker_active` / verified playback events.
  - `turn_start` only signals turn initialization and begins grant measurement; never optimistically activates visual highlight.
  - Highlight clears immediately on `turn_end`, `playback_stopped`, `session_state: ended`, or barge-in.
- [x] **Epoch Filtering & Stale Audio Invalidation (contracts/ws_events.md Section 2):**
  - Implemented client epoch tracker `epochRef`. Any audio chunk, transcript, or turn event with `epoch < currentEpoch` is dropped.
  - Epoch advances on barge-in and session termination, discarding any in-flight playback queues.
- [x] **Client-Clock Interaction Metrics (AT-06, Section 4 & contracts/ws_events.md Section 5):**
  - High-resolution `performance.now()` client timestamps compute:
    - `interrupt_to_silence_ms = playback_stopped.t_client_ms - vad(start).t_client_ms`
    - `grant_to_first_audio_ms = speaker_active.t_client_ms - turn_start.receipt_ms`
    - `user_question_to_first_audio_ms = speaker_active.t_client_ms - vad(end).t_client_ms`
  - In the Minutes Drawer, unmeasured metrics display as `Unavailable`, **never faked as 0**.
  - Client sends computed metrics to gateway via canonical `{"type": "metrics", ...}` events.
- [x] **Claims Verification Policy (RULE-06):**
  - The Minutes Drawer displays `✓ Verified by tool` if and only if `claim.verified === true`.
  - Displays `Claimed (Unverified)` when `claim.verified === false`. No unverified claims claim backing evidence.
- [x] **Direct Addressing & Routing (RULE-10, RULE-11, RULE-12):**
  - Clicking 3D chairs or 2D seat nameplates dispatches `address_agent` event. Clicking again clears direct target.
  - Clarification slips display for `unknown_target` routing events with quick-select action pills (Alex, Sam, Maya).
- [x] **Browser Microphone Integration (RULE-16 & ERR-03):**
  - Integrated `navigator.mediaDevices.getUserMedia` with echo cancellation.
  - Handles permission denial gracefully: dispatches `{"type": "mic_state", "state": "denied"}` and displays recoverable warning slip.
- [x] **Automated Protocol Unit Tests (`npm test`):**
  - Created `web/test/protocol.test.mjs` verifying fixture validity, speaker highlight gating, epoch filtering, claims rules, metrics formatting, and state transitions. 6/6 tests passing.
- [x] **Browser Subagent Live Verification:**
  - Verified full UI flow on `http://localhost:5173`: redesigned studio obsidian header, smooth 3D camera dolly arc transitions, active speaker highlight, barge-in desk mic glow, claims ledger, and 2D/3D view switcher.

---

## Phase B4: Audio Integration + Real-time Web Audio + Live Microphone VAD — COMPLETED (PASSED)

### Completed
- [x] **Web Audio API Streaming Audio Player (`web/src/audio/AudioPlayer.ts`):**
  - Streams and decodes base64 PCM WAV / ElevenLabs MP3 chunks via `AudioContext.decodeAudioData`.
  - Strict sentence and chunk sequencing queue sorted by `(sentenceIdx, seq)`.
  - Dispatches canonical client playback telemetry back to gateway:
    - `playback_started` on first audio frame of a turn/sentence with high-resolution `t_client_ms`.
    - `playback_progress` emitted periodically every 200ms with played duration `played_ms`.
    - `playback_stopped` on completion (`finished`), barge-in (`barge_in`), session termination (`end`), or decode error (`error`).
  - Stale epoch chunk rejection (`chunk.epoch < currentEpoch`).
  - Immediate queue flush and audio cutoff on `stop()` / `setEpoch()`.
- [x] **Client VAD & Automated Voice Barge-In (`web/src/audio/ClientVad.ts`):**
  - Browser microphone stream processing via `MediaStreamAudioSourceNode` and `AnalyserNode`.
  - Continuous RMS energy detection (speech start threshold: RMS > 0.028; silence timeout: 800ms).
  - Triggers automated spoken barge-in (`bargeIn()`) without requiring manual button clicks when user speaks while agent is active.
  - Emits canonical `{"type": "vad", "state": "start"|"end", "t_client_ms": ...}` events.
  - Integrated Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) to transcribe human speech and emit canonical `user_utterance` with `target_hint` extraction.
- [x] **Real-time Audio Visualizations Driven Solely by AnalyserNode:**
  - `AnalyserNode` frequency spectrum drives 3D avatar GLSL noise displacement shaders and glow ripples (`ThreeTableScene.tsx`).
  - Active speaker voice energy directly vibrates the speaking expert's 3D avatar orb.
  - 5-bar live equalizer soundwave on the host desk mic (`YourSeat.tsx`, `RoundTable.tsx`, `CinematicTable.tsx`) pulsing to real ambient microphone audio.
- [x] **Automated Unit & Integration Tests (`npm test`):**
  - `web/test/audio.test.mjs` (4 tests) + `web/test/protocol.test.mjs` (6 tests) = 10/10 passing tests.
  - `oxlint` 0 errors, 0 warnings across 37 files.
  - Vite production build passing (`tsc -b && vite build`).
- [x] **Live Browser Verification:**
  - Recorded browser verification session confirming smooth 3D camera transitions, audio decoding, typewriter HUD, desk mic equalizer, and zero console errors.

---

## Next Phase: Phase B5 — Full Integration & Polish with Person A Backend
- Connect live to Lane A's streaming ElevenLabs gateway endpoint.
- Verify end-to-end multi-agent voice podcast generation with live human interruptions in real time.

