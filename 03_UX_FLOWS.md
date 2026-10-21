# 03 — UX Flows, Session States and Interaction Specifications

**Purpose:** Define how the live product behaves *from the user's perspective*. Internal protocol and agent scheduling remain the engineering owner's domain.

## A. Information architecture

```text
Topic select / Home
  ├─ Topic 1: Will AI Replace Software Developers?
  ├─ Topic 2: Should AI Make Decisions That Affect Human Lives?
  └─ Topic 3: Should AI Tutors Replace Traditional Teaching?
        ↓
Live Roundtable
  ├─ Expert panel + active voice status
  ├─ Live text transcript (P1)
  ├─ User mic / interrupt control
  ├─ Directed-expert selector (P1, complements voice routing)
  ├─ Connection / error / permission states
  └─ End Session
        ↓
Session Ended
  ├─ Review visible transcript (only if implemented)
  └─ Start new session
```

## B. Proposed session states

| Code | State | Meaning | Essential UI |
|---|---|---|---|
| S0 | Ready | Topic and roles visible | Start enabled, microphone info |
| S1 | Connecting | Live session being set up | Connecting status, controls disabled appropriately |
| S2 | Waiting for first speaker | Session running; no audio yet | 'Preparing discussion', no fake waveform |
| S3 | Agent speaking | One expert is actually audible | Active speaker, optional live transcript, interrupt affordance |
| S4 | User speaking | Microphone receiving recognized user turn | Listening status, speaker audio suppressed |
| S5 | Processing user request | User utterance submitted / interpreted | Understanding / routing status; no false listening indicator |
| S6 | Agent generating | Target response being generated/synthesized | Waiting for Alex (example), no fake playback |
| S7 | Recovery | Disconnection, voice/model issue, invalid mic | Specific error, recovery controls |
| S8 | Ended | Session closed and playback stopped | New discussion option, no queued speech |

**State rules:** S3 → S4 on detected barge-in, S4 → S5 at end of user speech, S5 → S6 after target resolution, S6 → S3 at response playback, S3 → S3 for next agent turn, any active state → S8 on End. Connection failure → S7; successful recovery can return to a supported state. No technical implementation of the state machine is dictated here.

## C. Flow 1 — First entry / choose official topic

1. Show exactly three organizer-provided topic cards, each with a short description, three suggested expert roles and **Start** action.
2. For a selected topic, display background brief and allow preview of expert roles. Avoid implying every role has fixed universal relevance.
3. Explain microphone use, live AI voices and optional text transcript. Do not require sign-up.
4. On Start, initialize session with **the exact organizer opening prompt** (see `05_OFFICIAL_TOPICS.md`).
5. On failure, show a recoverable message, do not silently switch to a prerecorded demo.

Acceptance: topic choice is reflected in the first agent exchanges; the correct agent profiles/voice IDs are mapped to the chosen topic.

## D. Flow 2 — Standard live debate

1. Agent A is marked active when its real audio begins.
2. Agent B's next turn meaningfully acknowledges/rebuts a specific argument in Agent A's statement.
3. Transcripts (if implemented) show speaker-labelled actual content; partial text must distinguish draft from final text.
4. On a normal speaker transition, remove speaker highlight for A and activate B only when playback actually transitions.
5. Audio visualization (if implemented) should follow actual playback, not an infinite cosmetic loop.

Acceptance: a viewer can always answer 'Who is speaking?' and 'Can I participate now?'

## E. Flow 3 — Human mid-sentence barge-in (core judge demo)

**Scenario:** The software developer agent is speaking when user says, 'Wait, ask the open-source maintainer about security risks.'

| Step | Human/system | Frontend behavior | Engineering proof requested |
|---|---|---|---|
| 1 | Expert speech in progress | Correct speaker card = Speaking | Active audio turn ID |
| 2 | User starts talking | Live audio stops/pauses; UI indicates input priority | Interrupt timestamp, audio stop timestamp |
| 3 | Utterance captured | Listening / transcript user utterance, if supported | Captured text or routing event |
| 4 | Target resolved | Maintainer becomes addressed expert | Target `agent_id` / route trace |
| 5 | Reply begins | Maintainer's unique voice plays; card highlights | Speaker/audio event |
| 6 | Reply ends | Original panel discussion resumes or follows user's new direction | Context/turn traces |

**Recovery branches:** low mic confidence → clarification; target not found → ask whom to address; user speaks again → invalidate old response/audio; network fails → recovery UI. Button-only interruption is a fallback test mechanism, not full compliance.

## F. Flow 4 — Directed follow-up without losing context

After a disagreement, human says: 'AI Engineer, why did you disagree with the maintainer's point about security?'

- System should route to the named agent.
- Agent response should refer to the actual maintainer argument from earlier in the session, not general off-topic claims.
- After response, roundtable continues with meaningful context.
- If context is unavailable, request clarification rather than fabricate the prior claim.

## G. Flow 5 — Unexpected challenge and topic shift

Human: 'Change direction: what would this mean for students who cannot afford paid tools?'

- UI does **not** reset session or show a full new session unless user explicitly requests it.
- Agent contributions adapt; session topic can show a secondary 'Current angle' label if supported.
- Prior context remains available for relevant references.
- Test with a novel question that was not preloaded as dialogue.

## H. Flow 6 — Permission denied / connection failure

**Permission denied:** Make it explicit: 'Microphone access is blocked. Enable it in your browser to interrupt by voice.' A text entry fallback can assist interaction but cannot be passed off as proof of live spoken barge-in.

**Network failure:** Show 'Connection lost — attempting to reconnect' only while an attempt is actually occurring. Stop fake speaking indicators. If session cannot be restored, offer 'Start new session' and indicate lost context honestly.

## I. Flow 7 — End session

1. User selects End and gets immediate visible response.
2. Audio playback halts; old pending speaker responses are dropped.
3. User sees an ended state (not an ongoing waveform).
4. Offer new session. Only offer transcript/export when actual implementation exists.

## J. Microcopy guidelines

| State | Suggested copy | Avoid |
|---|---|---|
| Connecting | 'Joining the roundtable…' | 'Live' before connected |
| Waiting | 'Preparing the first perspective…' | Random endless 'Thinking…' |
| Agent active | 'Alex is speaking' | 'AI is thinking' over spoken audio |
| Mic active | 'Listening — ask or interrupt' | 'Listening' when mic disabled |
| Understanding | 'Finding the right expert…' | 'Your question is answered' prematurely |
| Target reply | 'Open-Source Maintainer is responding' | Wrong role or placeholder identity |
| Unsure | 'I didn't catch the expert's name. Who would you like?' | Guessing without disclosure |
| Audio error | 'Audio couldn't start. Retry or continue later.' | Fake speaking animation |
| Ended | 'Roundtable ended' | Playing buffered speech |

## K. Responsive and accessibility behaviors

- Mobile: vertically stack role cards and transcript; microphone and End remain reachable without covering essential content.
- Desktop: main speaker cards center/top, transcript side or beneath; no hidden audio controls.
- Controls keyboard-accessible with visible focus and descriptive accessible names.
- Provide text equivalents for audio statuses and user feedback, and reduced-motion behavior.
- Large enough touch targets; do not rely only on color/waveform to identify the speaker.

## L. Handoff checklist

- [ ] Engineer approved state names/meaning or provided replacement mapping.
- [ ] Confirmed voice playback stop/cancel capability and mic permission behavior.
- [ ] Confirmed whether transcript text can be aligned to streaming audio.
- [ ] Selected official topic and voice identities reflected accurately.
- [ ] UI tested for full-screen, narrow viewport and denied microphone.
