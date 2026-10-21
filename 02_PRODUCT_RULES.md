# 02 — Product Rules, Conversation Policy and Failure Behavior

**Status:** Product behavior proposal; architecture owner must approve implementation boundaries.  
**Labels:** [OFFICIAL] competition mandate; [PROPOSAL] team rule; [RESEARCH] optional paper-inspired pattern.

## 1. Core roundtable interaction rules

| ID | Rule | Why / test |
|---|---|---|
| RULE-01 | [OFFICIAL] At least three experts make **substantive, distinct** contributions. | Three voices alone are not three collaborating agents. |
| RULE-02 | [OFFICIAL] Communication between experts uses A2A or a documented standardized equivalent; preserve observable message exchange. | Sequential central orchestration alone is insufficient. |
| RULE-03 | [OFFICIAL] No fixed speaker script or predetermined answer sequence. | On unseen interruptions, roles still exchange genuine arguments. |
| RULE-04 | [OFFICIAL] Each expert keeps distinctive expertise, voice and perspective through the session. | One speaker cannot randomly assume another's role. |
| RULE-05 | [OFFICIAL] Experts refer to preceding points and challenge assumptions **when appropriate**. | Forced disagreement in every turn would also feel fake. |
| RULE-06 | [PROPOSAL] Clearly attribute arguments to speakers; display what is claimed versus what has been externally verified. | Prevent misleading factual certainty. |
| RULE-07 | [PROPOSAL] No repetitive recitation of topic prompt, introductions or role descriptions after start. | Maintain natural pace. |
| RULE-08 | [PROPOSAL] Allow current topic to evolve based on a user's follow-up rather than resetting the entire conversation. | Make continuity observable. |

## 2. Human authority and targeting

| ID | Trigger | Required behavior |
|---|---|---|
| RULE-09 | [OFFICIAL] User interrupts while speaker is audible | Detect user interruption, stop/pause **current audible playback**, record/interpet input and prioritize human response. |
| RULE-10 | [OFFICIAL] User names an expert | Route to the named intended agent; its **actual** distinct voice replies. |
| RULE-11 | [PROPOSAL] User asks a question without naming an agent | Coordinator selects an appropriate agent and optionally makes the routing visible. |
| RULE-12 | [PROPOSAL] User refers to a non-existent agent | Ask 'Which expert did you mean?' or clearly choose only with high certainty; never silently route to the wrong expert. |
| RULE-13 | [PROPOSAL] User stops halfway through a question | Use input-end/silence state, seek clarification if needed, avoid invented completion. |
| RULE-14 | [PROPOSAL] User interrupts while a prior interrupt is being handled | Prefer latest coherent user turn; deduplicate events and reject stale audio from older turns. |
| RULE-15 | [PROPOSAL] User presses End during processing | Stop audio immediately and terminate the live session without speaking queued agent output afterward. |
| RULE-16 | [PROPOSAL] Permission denied / mic unavailable | Explain it plainly, let user retry access; any typed fallback is supplemental and cannot be passed off as spoken interruption. |

## 3. Audio/playback correctness

- [PROPOSAL] In normal operation there is at most one **foreground agent voice** audible at a time; double playback should be treated as a defect.
- [PROPOSAL] The speaker highlight reflects the audio session's authoritative speaker, not an optimistic UI timer.
- [PROPOSAL] When a turn is invalidated by interruption or session end, future audio chunks from that stale turn must be discarded.
- [PROPOSAL] 'Listening' means user audio capture is available and active; 'Processing' means the user's utterance has ended and system work is underway; 'Speaking' means audio playback is underway (or confirmed active via events).
- [PROPOSAL] When playback is muted by the user, continue the session only as agreed with engineering and clearly communicate the muted state.
- [PROPOSAL] On stutter or queue backlog, prefer short, correct speech and graceful pauses over an audio pile-up.
- [DECISION] Exact interruption threshold and VAD semantics depend on voice stack; tune and measure, do not hard-code untested claims.

## 4. Discussion memory and context

**Short-term context** must include enough of the current topic, preceding contributions, explicit user requests, targeted speaker, key agreements/disagreements and changed direction to support follow-ups.

- On 'Why did you disagree with them?', use the actual last relevant disagreement rather than generic expert principles.
- Preserve author/speaker attribution so agents do not quote another expert as themselves.
- On direction change, retain relevant prior context without forcing the earlier topic into every response.
- If history was truncated or missing, ask for context rather than invent a past statement.
- Do not imply memory persists across sessions unless implemented and disclosed.

**[RESEARCH] Optional Reflexion:** An after-turn or after-session **brief feedback memo** can identify repetition, missed rebuttals or ungrounded claims. This is not a replacement for protocol-level coordination; do not claim model weights learn or change. It must not delay the live conversation's audio-critical path.

## 5. Evidence, research tools and trustworthiness

- [RESEARCH] ReAct motivates retrieving information when a question needs external evidence and then updating the argument based on **observations**. Tool calls and their outcomes can be logged.
- Research is **optional** in the organizer prompt pack. Do not substitute browsing for the core debate.
- Do not represent an unsupported model claim as a verified source; if sourcing is unavailable or failed, speakers can frame the point as a hypothesis or state uncertainty.
- The public UI should show **high-level actions and outcomes**, not hidden internal chain-of-thought or full private model traces.
- Do not expose secrets, API keys, raw sensitive microphone data, system prompts or any third-party private content.

## 6. Error matrix / recovery

| ID | Situation | UI state | Product response | Never do |
|---|---|---|---|---|
| ERR-01 | ElevenLabs synthesis stalls | `Recovering audio` | Retry a bounded number of times or skip failed turn with explanation | Claim speaker is talking while silent |
| ERR-02 | Agent timed out | `Expert unavailable` | Retry/choose another meaningful contributor transparently | Fabricate that agent's comment |
| ERR-03 | Microphone denied | `Mic permission needed` | Explain how to enable and offer safe recovery | Pretend listening |
| ERR-04 | Connection lost | `Disconnected / reconnecting` | Stop false live indicators, attempt session recovery if supported | Play stale generated speech as current |
| ERR-05 | No recognizable words | `Didn't catch that` | Request repeat or ask user to select a target | Guess an intimate/sensitive query |
| ERR-06 | Two agents begin speaking | `Correcting playback` (if visible) | Enforce one foreground audio turn; log collision | Continue unintended overlap |
| ERR-07 | User interrupts before speech starts | `Listening` | Treat as a fresh user question, preserving topic | Require a speaker to be active |
| ERR-08 | User changes topic abruptly | `Adapting topic` (if useful) | Reflect updated intent in next agent output | Continue fixed scripted content |
| ERR-09 | No external evidence | Normal discussion with uncertainty | Debate viewpoints without falsely citing research | Invent links and studies |
| ERR-10 | Session ended with queued output | `Ended` | Drop pending events and all audio from old session | Resume speaking after End |

## 7. State invariants for engineering tests

1. An `ended` session must not transition back to `speaking` without a **new session**.
2. An audio chunk's `turn_id`/generation token must match the current valid turn.
3. At most one agent is active for foreground playback at any instant (unless a separately designed overlap mode is explicitly supported; not required).
4. The selected addressed `agent_id` matches the responding expert or the system explains why routing changed.
5. Every final displayed transcript line has a source: recognized user speech or generated agent utterance.
6. If a tool fails, 'success' cannot be emitted for it.
7. If the UI displays real-time timing or transcripts, their metrics/source must be observable, not seeded demo values.

## 8. Limitations to disclose

- AI expert opinions are simulated viewpoints, not professional advice.
- Source research may not be available and claims should be treated accordingly.
- Latency varies with network, models and audio hardware; benchmark conditions matter.
- Spoken barge-in should be tested live; push-to-interrupt fallback alone does not satisfy the challenge's full voice-native barge-in expectation.
