# 01 — Product Requirements Document (PRD)

**Product:** AI Roundtable — Real-Time Multi-Agent Podcast  
**Version:** 1.0 working proposal  
**Status:** Product-side handoff; technical implementation remains architecture owner's decision

## 1. Product summary

**[OFFICIAL]** Build a voice-native live roundtable with at least three autonomous AI experts who exchange perspectives, respond to one another, challenge assumptions and sustain a coherent discussion. The human can interrupt the current speaker, ask a question directed to a specific expert, receive a voiced response and continue without resetting context. ElevenLabs provides voice generation. Genuine structured agent-to-agent communication is required.

**[PROPOSAL]** A browser-based 'live expert panel' focused on a single topic at a time. The design makes agency and control legible: who is speaking, which argument is being answered, whether the user is being heard, and whether the conversation is recovering from an interruption.

### One-line value proposition

Ask a difficult question, listen to three informed perspectives collide, and join the live discussion at any moment.

### Problem / why this matters

Recorded or scripted podcasts cannot respond to listeners; ordinary chatbots deliver one voice/one perspective; naive multi-agent demos simply rotate independent answers. We want a **responsive discussion**, not sequential monologues.

### Target users

- Curious learners exploring multi-sided issues.
- Students comparing technical, ethical and practical positions.
- Technical judges validating agent cooperation, streaming voice, targeted human participation and resilience.

### Job to be done

'When I want to understand a difficult question, help me hear multiple genuinely interacting expert perspectives and interrupt them with follow-ups so I can clarify what they mean.'

## 2. Goals and non-goals

### Goals

- G1: Demonstrate **real agent-to-agent** argument exchange (not role-labelled concatenation).
- G2: Make session state and current speaker observable.
- G3: Deliver live speech using **distinct ElevenLabs voices**.
- G4: Permit natural **mid-sentence spoken interruption** and directed questions.
- G5: Preserve discussion context through targeted follow-ups and topic shifts.
- G6: Produce inspectable evidence: transcripts, communication traces, timing and reproducible startup.

### Non-goals for the 24-hour MVP

- Training an LLM or reimplementing the Transformer architecture.
- Building a full studio-style podcast editor, publishing platform or social network.
- Multi-user human audiences, accounts, monetization or persistent cloud profiles.
- Long-term personalization or model-weight updates from live feedback.
- Fact-checking every statement against the internet (optional, but unsupported claims must not be presented as verified research).
- RAG document ingestion (belongs to another track; do not add unless useful and safe).

## 3. Primary product journey

1. User chooses one **official starting topic** and sees its brief and three topic-appropriate expert roles.
2. User grants microphone permission or sees a clear recovery message if denied.
3. User starts the session using the **supplied exact opening prompt** for the selected topic.
4. Distinct experts exchange dynamic arguments and audible turns. UI highlights the actual speaker.
5. User interrupts while one expert speaks, addresses an expert and asks a follow-up.
6. Audible output is cancelled/paused promptly and the addressed expert replies.
7. Panel resumes or adapts as the user changes direction, preserving relevant history.
8. User ends the session; audio stops, connection closes and the transcript can be reviewed if implemented.

**[DECISION]** Default initial topic: Topic 1 (AI replacing software developers). Also design topic-selection cards for Topics 2 and 3, with actual topic support verified before labeling them available.

## 4. Prioritized functional requirements

**P0 = mandatory for this product/brief; P1 = valuable but optional; P2 = stretch.**

| ID | Priority | Requirement | Acceptance / evidence |
|---|---|---|---|
| FR-01 | P0 | User starts a roundtable on an organizer-provided topic using its prescribed opening prompt. | Demonstrate supplied prompt in session input/event trace. |
| FR-02 | P0 | >=3 experts with distinct role, expertise and ElevenLabs voice. | Three agents participate meaningfully; voice configuration recorded. |
| FR-03 | P0 | Agents exchange structured messages via documented A2A or equivalent agent communication. | Inspectable communication trace with responses to prior agent messages. |
| FR-04 | P0 | Discussion evolves dynamically, includes reasoned disagreement and references earlier claims. | Change question unexpectedly and observe novel argument/counterargument. |
| FR-05 | P0 | Speech is live and responsive; speaker turns audible through ElevenLabs. | Live output, voice identity and timing are demonstrable. |
| FR-06 | P0 | Human speech can interrupt an actively speaking expert mid-sentence. | Current audio stops/pauses, input receives priority, response routed. |
| FR-07 | P0 | User can direct question to one expert. | Named expert responds to user, not another unrelated agent. |
| FR-08 | P0 | Conversation retains context after interruption and follow-up. | Refer to earlier argument without restating entire topic. |
| FR-09 | P0 | User can change direction/topic and agents adapt. | Unseen topic shift without restarting unless user chooses to. |
| FR-10 | P0 | System handles stalls/failed calls and overlapping outputs without misleading UI. | Simulate recoverable error; show truthfully reported status and safe retry. |
| FR-11 | P0 | Documentation and reproducibility evidence, including logs and measurements, are available. | Public repo, README, setup, .env.example, traces, timing and architecture diagram. |
| FR-12 | P1 | Display live speaker-labelled transcript. | Transcript corresponds to actual spoken output, with pending/final states. |
| FR-13 | P1 | Accessible click/keyboard method to select an expert to address. | Selection visible and interoperates with live mic input; not a substitute for speech barge-in. |
| FR-14 | P1 | Clear controls for end, mute output, and optional pause/resume. | Audio/session state matches visible control state. |
| FR-15 | P2 | Save/export transcript and/or audio. | Exports only actual data and handles consent/disclosure. |
| FR-16 | P2 | Post-turn critique or reflection loop. | Runs outside live audio critical path with honest measurement. |

## 5. Nonfunctional / quality requirements

| ID | Area | Product requirement / test approach |
|---|---|---|
| NFR-01 | Responsiveness | Track time from user starts talking until audible agent stops, and from end of user speech to first relevant response audio. **Proposed targets**: interruption acknowledgement <= 700 ms and first response audio <= 4 s under demo-network conditions; do not claim thresholds are organizer-mandated. Confirm with engineering. |
| NFR-02 | Continuity | Follow-up can refer to the previous exchange and the correct expert; measure in a scripted manual test suite. |
| NFR-03 | Honesty | Display only events supported by live backend state; label mocks, simulated failures and unavailable capabilities. |
| NFR-04 | Resilience | Handle denied microphone, disconnection, late audio chunks, failed agent generation and end-session safely. |
| NFR-05 | Accessibility | Keyboard operation for start/end, clear focus, labels, transcript/captions if implemented, adequate contrast, reduced-motion support. |
| NFR-06 | Privacy | Show microphone status; do not record/retain audio silently; define retention policy before enabling export. No secrets in client or repo. |
| NFR-07 | Performance | Keep client UI usable during audio streaming; avoid unnecessary animation/video assets. Log timings and actual environment. |
| NFR-08 | Open-source | Outside ElevenLabs, use open-source components in accordance with challenge rules; record models/providers and exceptions. |

## 6. Content rules and factual care

- Opening discussion must use the supplied topic prompt (see `05_OFFICIAL_TOPICS.md`). Topic briefs are contextual materials, not externally verified facts.
- AI characters are artificial experts, not real human credential holders. Do not imply the speakers are licensed physicians, attorneys, etc.
- On consequential topics (hiring, healthcare, loans), discussion should explore uncertainty, trade-offs, human accountability and limitations; not give personalized high-stakes instructions.
- Make a clear distinction between a speaker's reasoning/opinion and a researched claim. Research tools are optional; if invoked, externally observed evidence can be cited or reported as a source.
- Do not show internal private chain-of-thought or 'AI thinking' as a live transparent reasoning stream; display user-facing conclusions, arguments, references and tool/activity statuses instead.

## 7. Dependencies, owners and approval gates

| Dependency | Owner | Needed before |
|---|---|---|
| Agent communication protocol + trace format | Teammate | Agent state design, evaluation evidence |
| Voice TTS/STT + stream cancellation strategy | Teammate | Finalizing UX interruption states |
| State/event names and fields | Both (architecture approves) | Wiring interactive frontend |
| Agent roles/prompting per official topic | Teammate | Final content/voice assignment |
| Product/UI states and copy | You | Frontend implementation |
| Acceptance tests and demo proof | Shared | Freeze / submission |

**Approval gate:** Do not mark 'Live', 'Listening', 'Interrupted' or 'Saved' in UI unless the corresponding observed event exists.

## 8. Definition of done

- [ ] All official P0 behaviors work live on a selected official topic and unseen follow-ups.
- [ ] Agent-to-agent protocol is documented; test logs prove collaborative exchanges.
- [ ] Human voice genuinely interrupts an actively playing response.
- [ ] Named expert responds; conversation continues correctly.
- [ ] Distinct ElevenLabs voices audible for at least three agents.
- [ ] Errors, limitations and partial features disclosed truthfully.
- [ ] README, run instructions, pinned dependencies, .env.example, architecture and evidence available.
- [ ] Acceptance suite executed and result summary recorded; no fabricated metrics.

## 9. Open decisions

- [DECISION] Selected first topic / support for other official topics.
- [DECISION] Exact voice-agent configuration and how STT is handled.
- [DECISION] Full A2A vs equivalent standardized message protocol and its documentation.
- [DECISION] Simultaneous-voice policy, turns, and cancellation behavior.
- [DECISION] Transcript availability and retention.
- [DECISION] Runtime local vs hosted model; capacity and budget limits.
- [DECISION] Whether after-turn reflection is built; never let it block active audio.
