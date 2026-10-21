# workflow/overview.md — How we build the AI Roundtable

Read this together with `architecture.md`, `prompts.md` and `workflow/collaboration.md`.
The team is two people working on separate branches: follow the lane ownership, contract and
merge rules in `workflow/collaboration.md`. Where documents disagree, use the precedence list
in `workflow/reconciliation.md` section 4. That file also records decisions that amend
architecture.md and prompts.md; read it right after architecture.md, and treat
`contracts/ws_events.md` as the canonical event list.

## 1. Working agreement for the coding agent

1. **Read first.** Read architecture.md and this file before any code. Re-read the relevant
   section before each phase.
2. **One phase at a time.** Finish a phase and its acceptance checks before starting the next.
3. **Real or labelled.** Never fake A2A messages, agent turns or latency numbers. Mocked parts
   go behind an interface, are tagged `MOCK` in code, and are listed in STATUS.md.
4. **Verify APIs.** For a2a-sdk, ElevenLabs and any other library, check the current docs or
   installed package before writing calls. Do not rely on memory.
5. **Keep STATUS.md current.** After each phase: what works, what is mocked, known bugs,
   next step, measured numbers.
6. **Keep it demoable.** `main` must always run. Work on branches or commit only working states.
7. **Security.** No keys in code, logs, traces or screenshots. `.env` is gitignored.
8. **Small, cheap models for bids, stronger for speech.** Keep turns to 2-3 sentences.
9. **Do not polish UI before Phase 4 passes.**

## 2. Definition of done (per feature)

- Runs from a clean checkout using the README steps.
- Has at least one automated or scripted check (unit test or eval scenario).
- Logs enough to debug (trace + timings).
- Failure behaviour is defined (see architecture.md section 9).
- STATUS.md updated.

## 3. Phases and acceptance checks

| Phase | Goal | Acceptance check |
|---|---|---|
| 0 | Scaffold | `make run` starts gateway; `/health` ok; JSONL trace file created |
| 1 | One agent speaks via ElevenLabs | Typed text plays; time-to-first-audio logged (< 1.5 s) |
| 2 | 3 A2A agents debate in text | 10 turns; trace shows `floor.utterance`, `floor.bid`, `floor.grant`; at least one real disagreement; moderator contains no LLM calls |
| 3 | Voice for all agents | Distinct voices; avg dead air < 1 s; transcript matches audio |
| 4 | Barge-in + routing | Interrupt mid-sentence: audio stops < 150 ms; targeted question reaches the named agent; answer spoken; discussion resumes |
| 5 | Ledger + memory + topic shift | Accurate callback to an earlier statement; topic shift handled without restart |
| 6 | Reliability + chaos | Kill/stall an agent live; session survives; HUD shows notice |
| 7 | Pipelined drafting | Before/after latency recorded in docs/metrics.md |
| 8 | HUD + eval + docs | `python eval/run_eval.py` produces docs/eval_results.md; README complete |

## 4. Suggested schedule (2 days)

**Day 1: working core**
- Hours 0-1: Phase 0, plus ElevenLabs account, voice picks, model provider keys.
- Hours 1-3: Phase 1.
- Hours 3-7: Phase 2.
- Hours 7-9: Phase 3.
- Hours 9-12: Phase 4 (start it even if tired; it is the highest-value phase).

**Day 2: stand-out features and evidence**
- Hours 0-2: finish and harden Phase 4.
- Hours 2-4: Phase 5.
- Hours 4-6: Phase 6.
- Hours 6-8: Phase 7 (skip if behind; Phase 8 matters more).
- Hours 8-10: Phase 8: HUD, eval script, README, diagram, traces, demo recording.
- Final hours: rehearse with topics the team has NOT prepared; fix only critical bugs.

If behind schedule, cut in this order: Phase 7, optional 4th agent, topic-brief retrieval,
audio export. Never cut Phase 4, A2A traces or the README.

## 5. Parallel work lanes (adapt to team size)

| Lane | Owns |
|---|---|
| Backend/agents | agents/, a2a_client, moderator, ledger |
| Voice/audio | tts.py, stt.py, browser VAD, playback queue, barge-in timing |
| Frontend/HUD | web/, transcript, claims view, trace panel, chaos button |
| Eval/docs | eval/, README, diagram, STATUS.md, demo script |

Agree on the message schemas in architecture.md section 4 first so lanes do not block each other.

## 6. Test scenarios (used by eval/run_eval.py and the live demo)

| # | Scenario | Pass condition |
|---|---|---|
| 1 | Topic discussion | 3+ agents speak; each references another's point |
| 2 | Disagreement | An agent challenges a named claim with a specific reason; the target responds |
| 3 | Targeted question | "Kabir, what would this cost?" is routed to Kabir and answered |
| 4 | Mid-sentence interruption | Speaker stops; selected agent answers; discussion resumes with context |
| 5 | Follow-up question | "What did Arjun say about consent earlier?" answered accurately without restating the topic |
| 6 | Topic shift | New topic adopted; relevant earlier context retained |
| 7 | Failure | One agent killed; remaining agents continue |

Use the product doc 06 test ids (AT-01..AT-20) and metric names, per `workflow/reconciliation.md`
section 5 (what is automated vs manual). Record pass/fail/not-run with evidence; unavailable
metrics are reported as unavailable, never zero.

## 7. Live demo script (about 4 minutes)

1. Show the HUD and architecture diagram (15 s).
2. Give an unscripted topic from a judge. Let agents debate for ~40 s. Point out the A2A trace
   panel and the claims list.
3. Interrupt mid-sentence with a targeted question to one named expert. Show audio stopping,
   the routing event, and the spoken answer.
4. Ask a follow-up that needs earlier context. Show the callback.
5. Change topic.
6. Click Kill Agent. Show the system recovering.
7. Show latency panel and the real-vs-mocked table.

Keep headphones on the demo machine to avoid echo triggering false barge-ins. Have a fallback
text-input path in case the venue is too noisy for the mic.

## 8. Submission checklist

- [ ] Public repo with full source
- [ ] README: architecture, agent roles, conversation flow, install/run steps
- [ ] A2A documentation: agent cards, message types, floor protocol
- [ ] List of models, frameworks, voice configuration, external services
- [ ] requirements.txt (pinned) and optionally Dockerfile / docker-compose
- [ ] .env.example with all variables, and no real secrets anywhere in history
- [ ] Architecture diagram (agents, communication paths, moderator, voice layer)
- [ ] Sample A2A traces (logs/traces sample file)
- [ ] Example conversation logs with timing (response latency, interruption-to-response)
- [ ] Interruption demo evidence (detected, routed, answered)
- [ ] Unscripted topic/follow-up demonstration
- [ ] Real vs mocked vs planned table, honest
- [ ] Short demo video as a bonus (never as a substitute for the live system)

## 9. Common failure modes to watch

- Agents sounding alike: strengthen stance and style in persona files.
- Agents agreeing too much: raise the weight of `challenge` intent when the same view has been
  repeated twice.
- One agent dominating: increase the dominance penalty.
- Echo triggering barge-in: require headphones, keep echoCancellation on, raise the VAD threshold.
- Context bloat: always use summary + last N turns + open claims, never the full transcript.
- Rate limits: retry with backoff, use the fallback model, and keep the bounded TTS pool.