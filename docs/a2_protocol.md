# A2: three independent experts in a text roundtable

A1 proved that one answer can become audible speech. A2 builds the discussion behind
that voice: three independent expert processes receive what was said, decide whether
they have something useful to add, and request permission to speak. A small deterministic
moderator grants one request. It cannot write an answer or call a language model.

This increment is text-only. It does not change browser WebSocket events, turn on three
frontend voices, implement microphone transcription, or claim A3/A4/A5 completion.
The A1 `/dev/a1` path remains available with its existing single-expert behavior.

## Run it

Use Python 3.11+ in a virtual environment and install `requirements.txt`.
On Windows, invoke the virtual environment's `Scripts/python.exe`; activating it is optional.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -B -m gateway.cli --env-file .env --turns 10
```

By default the CLI starts Alex, Sam and Maya in separate processes on localhost
9101–9103, discovers their Agent Cards, runs the discussion, then terminates only
the processes it started. Occupied ports cause an abort, not termination of somebody
else's service. Use `--base-port` to select another consecutive range.
Each expert can also be launched with `python -m agents.agent_server --agent <id>
--port <port> --env-file <path>`; `--external` on the CLI uses existing services.
Services bind localhost and have no authentication; do not expose these development ports.

The default opening is the exact organizer Topic 1 prompt. A positional CLI argument
supplies an unscripted alternative; the personas remain Topic 1 experts.
`--report docs/<name>.json` saves public generated text, outcomes and actual timings.
It does not save provider bodies, prompts, keys or model reasoning.

The original configured bid model is unset. Default behavior explicitly reports using
`LLM_MODEL_SPEAK` for bids; `LLM_MODEL_BID` or `--bid-model` selects another model.
No model is silently substituted after a failure. Provider discovery returned the GPT-OSS
20B and 120B models; the attempted `llama-3.1-8b-instant` returned HTTP 404 and is not usable
on this account despite appearing in public provider documentation.

Diagnostic invocation used during development (settings are explicit, not new defaults):

```powershell
.venv/Scripts/python.exe -B -m gateway.cli --env-file .env `
  --speak-model openai/gpt-oss-120b --bid-model openai/gpt-oss-20b `
  --bid-timeout-ms 2500 --turn-delay-s 12 --turns 10 `
  --report docs/a2_live_results.json
```

The environment file stays private and unmodified. `--env-file` is loaded in memory
and inherited by the three child processes. Without it, only the checkout's own `.env`
is loaded; no parent-directory credential discovery is used.

## How files and information connect

1. `gateway/cli.py` starts processes and injects the organizer utterance. It drives the
   transport loop, not the dialogue content, and offers a hook for later voice integration.
2. `gateway/a2a_client.py` discovers cards and uses the SDK's JSON-RPC/SSE client.
   `floor.utterance` calls run concurrently. Each response is validated and logged.
   Late, malformed or failed bids become a recorded pass, never a fabricated agent bid.
3. `agents/agent_server.py` exposes each expert's standard card at
   `/.well-known/agent-card.json` and A2A endpoint at `/`. Its executor validates DataParts,
   runs the expert, and publishes task status and sentence artifact events over SSE.
4. `agents/base_agent.py` owns each expert's contribution decisions, recent conversation
   view and direct-message inbox. The agent calls its own provider through `agents/model.py`.
   The gateway never imports or invokes a model to produce the discussion.
5. `agents/personas/topic_1/*.yaml` gives Alex, Sam and Maya different priorities.
   Public names/roles still come from the teammate-owned Topic 1 JSON.
6. `gateway/moderator.py` scores valid bids, applies fairness, and selects one winner.
   The CLI sends that winner `floor.grant`; its expert produces the public answer.
7. A targeted challenge/clarification authored by the expert is relayed as `agent.direct`
   to the selected peer, which returns a real `agent.ack`. Its next bid sees the message.
8. The actual speech becomes the next broadcast. The speaker also receives it to retain
   its own contribution, but passes on the immediately following floor request.

Each agent has a separate model client and a process-local, bounded memory view.
Memory retains up to `CONTEXT_LAST_N_TURNS` (default 8, bounded 2–20), four direct messages,
and 64 sessions with a ten-minute idle expiry checked on access. This is recent context,
not the persistent claims ledger or rolling-summary memory planned for A5.
The SDK's development task store remains in memory; CLI process exit clears it.

## Protocol and arbitration

Pinned compatibility target: `a2a-sdk[http-server]==0.3.26`, A2A protocol 0.3.0,
`pydantic==2.11.10`, `sse-starlette==3.0.3`. The SDK's installed APIs were inspected.
Version 1.x exists; this phase intentionally uses the verified 0.3 interface rather
than guessing compatibility with a different major protocol. A clean requirements install
is verified separately from the initial environment that inherited unrelated global packages.
See the [pinned SDK server source](https://github.com/a2aproject/a2a-python/blob/v0.3.26/src/a2a/server/apps/jsonrpc/starlette_app.py)
and [request context](https://github.com/a2aproject/a2a-python/blob/v0.3.26/src/a2a/server/agent_execution/context.py).

`agents/messages.py` validates the application's internal floor payloads from architecture
sections 4–5. This is implementation validation, not a replacement shared contract.
Every payload is carried in a standard A2A DataPart and includes `trace_id`, `turn_id`,
`from`, `to`, `type`, `ts`, and `payload`. The trace ID is also the A2A context ID.
Cards advertise `bid`, `speak`, `react`, and `respond_to_human`.
`respond_to_human` is an internal expert capability; browser routing, STT and resume are
not implemented by this CLI. The shared `contracts/a2a_messages.md` is still absent;
cross-team schema agreement remains necessary before another implementation depends on it.

The score is `0.45*urgency + 0.30*novelty + 0.35*addressed - 0.25*recency - 0.80*dominance`.
Recency uses distance from the last contribution; dominance is the fraction of previous
turns spoken. Seeded SHA-256 ranking breaks ties reproducibly. There is no fixed order.
A previous speaker or an agent that passes cannot win. If no eligible bid arrives, the CLI
stops honestly; it does not assign a speaker by rotation or manufacture a contribution.
Fairness cannot force an unavailable or genuinely passing expert to speak.

Default bid timeout remains 400 ms. Any format repair shares that deadline. Cancelled
requests send real A2A task cancellation so the provider work is stopped too.
Cancellation cleanup may add up to one second after the decision deadline; measured round
times include cleanup. The 2,500 ms diagnostic override must not be presented as a
400 ms pass. A text-only pause to fit provider quotas is also reported separately.

Speech is generated and validated before sentence artifacts are emitted. This is real
SSE sentence delivery, not token-by-token generation or pipelined drafting. A malformed
claims separator, oversized response or known unsupported research attribution gets at
most one repair under a 25-second deadline. Metadata is never part of spoken output.
HTTP failures are not immediately retried or silently switched to another model.

## Verification and limits

`eval/test_a2.py` uses explicitly mocked models with the real SDK. It covers deterministic
selection, two-agent domination, malformed bids, stale/replayed grants, memory isolation,
speech repair, metadata rejection, ten-turn card/SSE/direct-message exchange, parallel
timeouts, and cancellation over an actual localhost socket. This is transport and logic
evidence, not live discussion-quality evidence.

Real provider samples are retained in `docs/a2_live_*.json`, including failures:
the unavailable small model, early invalid bids, malformed output, and HTTP 429 after
eight unpaced turns. A 429 means the provider limited usage; it is unrelated to ElevenLabs.
Inspect the final report and acceptance note for the actual final result; an intent label
such as `challenge` is not by itself proof of substantive disagreement.

Live JSONL traces remain Git-ignored under `logs/traces/`; public generated-text reports
are reviewable evidence. No raw audio or reasoning was stored. The recent-context buffer
does not verify facts or prevent every unsupported claim. Human review still matters.
Model quality, quota handling/fallback, live UI pairing, multiple voices and spoken
interruption remain separately measured integration work rather than implied successes.
