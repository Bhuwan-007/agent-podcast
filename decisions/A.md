# Lane A decisions

- 2026-10-22 | A2 uses real A2A SDK 0.3.26 JSON-RPC/SSE, with explicit protocol 0.3.0 cards, separate localhost processes and independent model calls. Internal payload validation follows architecture sections 4–5; no missing shared contract is created or finalized.
- 2026-10-22 | A2 remains text-only; A1 browser/voice behavior stays unchanged. Diagnostic model/deadline/pacing overrides are recorded and never written into the user's .env. A default-deadline or quality pass cannot be inferred from successful diagnostic transport.
- 2026-10-22 | Fairness penalty increased after a real-SDK/mocked-model test showed two targeted experts could exclude the third. There is still no fixed speaking order. Speech metadata must have a valid delimiter/JSON and is never sent as public speech.

- 2026-10-21 | Contract location: the user explicitly authorized using GitHub's existing
  root `ws-events.md` for the remaining A1 implementation. Fetched `origin/main` matches
  the local file. Use its shapes; do not create, move or rewrite shared contracts.
- 2026-10-21 | A1 is an explicitly labeled single-expert provider integration check.
  Alex's reply is model-generated, not a scripted fixture. A2 will add actual A2A servers
  and bid-based speaker selection; no A2A compliance is claimed for A1.
- 2026-10-21 | Browser harness lives in `gateway/dev_a1.html`, served at `/dev/a1`, to
  respect Lane B ownership of `web/**`. Its playback buffers complete MP3 sentences.
- 2026-10-21 | `turn_end(completed)` closes generation; the client finishes the queue
  before `playback_stopped(finished)`. Waiting for playback preserves one active turn.
  Reuse S2 for standalone A1 waits; a proper idle/pause state and full panel behavior
  require shared agreement before later integration. See `docs/protocol.md` requests.
- 2026-10-21 | Unspecified client metrics/reconnect sequence shapes are not invented.
  Backend shared metrics are unavailable; A1 emits honest session_lost on reconnect.
