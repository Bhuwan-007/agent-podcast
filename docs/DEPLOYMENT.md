# Single-service Render deployment

Status: deployed on the user-approved Free plan at https://ai-roundtable-vpme.onrender.com.
Initial deployed code: ce4eee5. Public health, frontend assets and browser-Origin WSS
passed. Real full-episode and synthesized voice-question transport passed; see
`render_episode_results.json` and `render_voice_gateway_results.json`. Physical
microphone and audible browser playback are not certified by these automated runs.

The cinematic React build and FastAPI gateway share one HTTPS origin. `/` serves
the built frontend, `/assets` its compiled assets, `/ws` the real WebSocket, and
`/dev/roundtable` the backend diagnostics/source review. No frontend API key is used.
The gateway starts three owned localhost A2A subprocesses on ports 9101-9103.

## Configuration to approve

- Repository: `Bhuwan-007/agent-podcast`; branch: `deployment`, created from merged main.
- One Docker Web Service, one instance, one Uvicorn worker; no database or disk.
- Build: multi-stage Dockerfile (Node 22 frontend, Python 3.13 backend).
- Start: `python -m uvicorn gateway.main:app --host 0.0.0.0 --port $PORT --workers 1`.
- Health path: `/health`. Public origin comes from Render's `RENDER_EXTERNAL_URL`.
- `render.yaml` defaults to the free plan pending explicit resource approval.
- Required server secrets/settings: `ELEVENLABS_API_KEY`, `VOICE_ID_AGENT1`,
  `VOICE_ID_AGENT2`, `VOICE_ID_AGENT3`, `LLM_BASE_URL`, `LLM_API_KEY`.
- Runtime: `ROUNDTABLE_MODE=panel`, `BID_TIMEOUT_MS=2500`, Qwen 3.8 27B bids,
  GPT-OSS 120B speech, GPT-OSS 20B fallback; chaos and speculative drafts disabled.
- Never send `RENDER_API_KEY` to the application. It is an administrative credential.
  Deployment tooling explicitly loads the private root `.env` with python-dotenv,
  uses a Bearer header in memory, and prints only safe status/metadata.

Read-only Render authentication and workspace/service inspection returned HTTP 200.
The ai-roundtable service was created after Free-plan approval. Existing services were untouched.
Render CLI is not installed in this session; REST authentication works. The official
[Render Codex integration](https://render.com/agents/codex) supports OAuth if preferred.

## Costs and boundaries

Render lists Free at $0/month with 512 MB and idle sleep after 15 minutes. The
0.5c-512mb paid plan is $7/month; 1c-2g is $25/month. Provider usage, bandwidth
overages and taxes are separate. Prices checked 2026-10-22 against
[Render pricing](https://render.com/pricing) and [free limits](https://render.com/docs/free).
No paid plan is selected without approval. Four Python processes share the instance;
memory/latency must be measured on the chosen plan, not assumed sufficient.
In-memory episodes disappear on restarts; there is no durable recording.

## Validation

Frontend production build and 12 existing frontend tests pass. Backend regressions,
player queue tests, microphone capture lifecycle tests, and static frontend serving
tests are recorded in `docs/eval_results.md`. Browser API doubles do not establish
physical microphone or audible playback success. Docker CLI is available, but the
local Docker daemon is stopped; the actual Docker build succeeded on Render.

After approval: create the service from `deployment`, securely supply only the listed
application variables, wait for build/deploy completion, check `/health`, verify the
frontend/assets, test WSS handshake, then run a real audio/question/End check on the
public URL. Record provider and transport evidence separately from browser listening.

## Hosted acceptance and cold-start repair

First attempt failed expert startup (retained in render_episode_initial.json). After
cold imports completed, the full episode passed: all three experts, 2102526 bytes,
Pause/Resume, Maya question, generated closing, export and End in 129018.7 ms. Two
expert failures were transparently skipped. Real synthesized user speech through
hosted STT routed to Maya, produced 389668 reply bytes, resumed and ended in 9156.4 ms.
These use synthetic playback acknowledgements, not acoustic measurements.

The previous 60-retry startup loop could expire during CPU-throttled imports. The
repair allows a hard 60-second wall-clock window with bounded individual probes,
retains immediate failure for exited child processes, and closes unsuccessful pools.
93 Python tests passed, including late readiness beyond the old retry count and
hard-deadline cleanup. A fresh deployed first-start check is still required after
shipping this repair. Free-tier idle sleeps still apply.
