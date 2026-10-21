# 06 — Acceptance Tests, Evidence and Judging Matrix

**Test status:** Templates / expected outcomes, NOT executed results. Fill actual results during development.  
**Required by brief:** Live multi-agent cooperation, ElevenLabs voices, interruption and targeting, context continuity, dynamic behavior, evidence and reproducibility.

## 1. Official functional evaluation weighting

| Criterion | Weight |
|---|---:|
| Multi-agent collaboration | 25% |
| Discussion quality | 20% |
| Human interaction | 20% |
| Voice and responsiveness | 15% |
| Context and continuity | 10% |
| Reliability and reproducibility | 10% |

Official document also contains a separate **judging/verification** table (30/20/25/15/10). Do not confuse the two breakdowns or claim that the evaluator uses one particular calculation beyond what is stated in the PDF.

## 2. Test recording format

For each test record: `test_id`, `build/commit`, `selected_topic`, `test_input`, `expected_behavior`, `observed_behavior`, `pass/fail/not-run`, `timestamps` if available, `evidence_link` (audio/video/message trace/transcript), `notes`, `tester`.

**Do not mark a test Pass because the UI animates.** Verify the actual event, audio, routing, or log.

## 3. Core test suite

| ID | Priority | Test setup / user action | Pass criterion | Evidence |
|---|---|---|---|---|
| AT-01 | P0 | Select Topic 1 and start session | First session uses supplied Topic 1 opening prompt and selected roles | Session config / trace |
| AT-02 | P0 | Let discussion run across three roles | >=3 distinct agents make meaningful topic-relevant contributions | Transcript + speaker IDs |
| AT-03 | P0 | Observe after first agent makes factual claim | Another agent specifically references/supports/rebuts a preceding claim | Two linked A2A messages / transcript |
| AT-04 | P0 | Inspect architecture logs | Documented A2A/equivalent structured messages show actual exchanges, not merely serialized independent prompts | Protocol docs + trace |
| AT-05 | P0 | Listen as each expert speaks | All distinct voice IDs/output from ElevenLabs correctly map to agents | Configuration + live audio |
| AT-06 | P0 | Start talking mid-sentence | Current audio stops/pauses when interruption recognized; speech receives priority | Audio capture & stop timestamps / live demonstration |
| AT-07 | P0 | Say 'Open-Source Maintainer, explain that risk' | Targeted expert answers directly and in correct voice | Route trace + speaker transcript |
| AT-08 | P0 | Ask 'What did the previous expert disagree with?' | Answer accurately refers to discussion history or seeks clarification | Transcript/grounded context |
| AT-09 | P0 | Ask novel question not in prompt pack | Agents respond dynamically rather than reciting canned content | Video + messages |
| AT-10 | P0 | Shift direction to student access or safety-critical software | Panel adapts without losing relevant prior context | Session trace |
| AT-11 | P0 | Interrupt, then continue roundtable | Agents continue coherently after human-targeted reply | Full trace |
| AT-12 | P0 | End during an ongoing or queued voice turn | No stale audio plays after End | Audio playback/state log |
| AT-13 | P0 | Disconnect network or simulate agent timeout (safely) | Honest error and bounded recovery; no fake success | Error-state video/log |
| AT-14 | P0 | Review repository fresh clone / clean env | Setup works, deps pinned, keys env-configured, architecture and communication documented | README, .env.example, test output |
| AT-15 | P1 | Deny microphone permission | UI tells user why mic is unavailable, offers clear recovery | UI capture |
| AT-16 | P1 | Speak without naming expert | System chooses one appropriately or clarifies, without inventing specificity | Routing trace |
| AT-17 | P1 | User says an unknown agent name | Clarification rather than wrong-person reply | Transcript |
| AT-18 | P1 | Repeated interruption immediately after first one | Stale audio discarded; latest coherent request processed | Turn IDs + playback log |
| AT-19 | P1 | Load Topic 2 or 3, if claimed available | Correct topic-specific roles, voices and exact starting prompt | Session config + initial transcript |
| AT-20 | P2 | Research tool succeeds/fails (if implemented) | Agent reflects observed result; failure not reported as verified evidence | Tool action/observation log |

## 4. Human interaction metrics (proposed)

Record actual timestamps when observability permits:

- `t_user_voice_start` = human starts audible input; usually detectable only with an input/VAD signal.
- `t_agent_audio_stop` = audible speaker playback actually stops (not request issued).
- `t_user_voice_end` = end of question.
- `t_target_first_audio` = first audible response from addressed agent.
- `t_speaker_start` / `t_speaker_end` = audible active periods by speaker.

**Calculated:** `interrupt_to_silence_ms = t_agent_audio_stop - t_user_voice_start`; `user_question_to_first_audio_ms = t_target_first_audio - t_user_voice_end`. If event accuracy is insufficient, mark result **unavailable**, not zero or a fabricated estimate.

**Suggested team targets, NOT official thresholds:** median interruption-to-silence <= 700 ms under demo conditions; first relevant agent audio <= 4 s after the user finishes. Engineering should revise these after first measurement.

## 5. Discussion quality rubric (manual)

Score each trace 0–2 on:

- **Specific response:** responds to previous speaker's concrete claim, not generic opinion.
- **Distinctness:** adds novel role-relevant perspective.
- **Reasoned challenge:** disagreement supported by reasoning, not automatically adversarial.
- **Coherence:** new turn connects to the shared question.
- **Continuity:** follow-up/reframing respects earlier context.

Total 0–10 per sampled exchange. **Proposed team rubric**, not official evaluator formula. Save human annotator notes and traces.

## 6. Suggested live judge proof sequence

1. Open Topic 1, verify exact starting prompt.
2. Let three agents contribute and show actual A2A messages.
3. Interrupt someone mid-sentence by speaking.
4. Direct a question to the Open-Source Maintainer.
5. Ask a follow-up referencing a previous argument.
6. Introduce an unexpected angle.
7. Show one measured latency, a test result and architecture diagram.

## 7. Results ledger (fill in; no fake values)

| Test ID | Build commit | Result | Evidence | Owner |
|---|---|---|---|---|
| AT-01 | TBD | NOT RUN | TBD | TBD |
| AT-03 | TBD | NOT RUN | TBD | TBD |
| AT-06 | TBD | NOT RUN | TBD | TBD |
| AT-07 | TBD | NOT RUN | TBD | TBD |
| AT-14 | TBD | NOT RUN | TBD | TBD |

## 8. Submission quality gate

- [ ] Unseen prompt was tested live.
- [ ] Actual audio-interrupt handling demonstrated.
- [ ] Structured message traces included.
- [ ] Separate ElevenLabs voice identities recorded.
- [ ] Known limitations described honestly.
- [ ] Credentials absent from committed files.
- [ ] Architecture diagram, install/run steps and versions available.
- [ ] No mock or prerecording is passed off as core functionality.
