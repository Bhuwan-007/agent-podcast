# 04 — Design System and UI Component Specification

**Status:** [PROPOSAL] Brand direction and Figma implementation brief; no claim UI is built.  
**Design approach:** A restrained live-podcast studio, with clear speaker status and first-class interruption controls. The experience should feel interactive, not like a three-person slideshow.

## 1. Design principles

1. **Voice first, interface second:** the UI clarifies real activity; it never pretends to animate actual sound where none exists.
2. **User in control:** microphone/interruption and End remain clearly available during debate.
3. **Three distinct perspectives:** expert cards communicate unique identities and the actual currently speaking agent.
4. **Legible in 2 seconds:** topic, active voice, session state, user action are immediately obvious.
5. **Trustworthy feedback:** differentiate initializing / ready / speaking / listening / processing / reconnecting / ended.
6. **Accessibility:** roles/states must be understandable without color or animation.

## 2. Provisional visual identity

**Working brand:** AI Roundtable / Roundtable AI — choose one consistent name. A placeholder wordmark is sufficient; do not spend the hackathon on logo exploration.

### Design tokens

| Token | Proposed value | Use |
|---|---|---|
| `color.bg` | `#10131D` | App background |
| `color.surface` | `#202435` | Cards, transcript |
| `color.surfaceElevated` | `#2A2F43` | Controls, modals |
| `color.border` | `#3B4056` | Dividers and card outlines |
| `color.text` | `#F4F5FA` | Main text |
| `color.textMuted` | `#BDC2D3` | Supporting labels |
| `color.accent` | `#B5A0FF` | Active/CTA (check contrast) |
| `color.success` | `#56CC9D` | Confirmed connected status |
| `color.warning` | `#F6C177` | Degraded audio / recovery |
| `color.error` | `#FF7A8A` | Disconnected / failure |
| `radius.card` | `16px` | Cards |
| `radius.control` | `12px` | Inputs/buttons |
| `space.base` | `8px` | Spacing rhythm |
| `font.primary` | Inter (or system sans) | Readable UI |

**Note:** Values are starting tokens, not approved contrast measurements. Verify text, control and state contrast on implemented colors (WCAG AA where practical) before handoff.

### Typography and spacing

- Title / hero: 32–40px desktop, 26–32px mobile.
- Section heading: 20–24px.
- Body: 15–17px, comfortable line-height.
- Metadata/captions: 12–14px where legible.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Motion: short, subtle highlight transitions; follow `prefers-reduced-motion`; waveform if and only if driven by actual audio signal or honestly labeled decorative.

## 3. Screens to create in Figma

### Screen A — Topic selection / lobby (P0)

**Required:** product name, concise promise, organizer Topic 1–3 cards, roles per topic, Start button, mic/audio note. Do not call other topics 'supported' if only one works.

```text
+---------------------------------------------------------------+
| [ROUND TABLE]                                  [Help]           |
|                                                               |
|      Three perspectives. One live conversation.               |
|      Choose a starting topic. Interrupt whenever you want.    |
|                                                               |
|      [ Topic 1: Developers & AI                     SELECT ]   |
|      [ Topic 2: AI decisions & human lives          SELECT ]   |
|      [ Topic 3: AI tutors & teachers                SELECT ]   |
|                                                               |
|      Selected expert roles: [Role A] [Role B] [Role C]         |
|      [ Start live roundtable ]                                 |
|      [Mic permissions and AI-voice disclosure]                 |
+---------------------------------------------------------------+
```

### Screen B — Active session / desktop (P0)

```text
+-----------------------------------------------------------------------+
| [ROUND TABLE]     [LIVE / STATE]           [Connection]       [End]   |
| Topic: Will AI Replace Software Developers?                           |
|                                                                       |
|    [ Expert 1 ]        [ Expert 2 ACTIVE ]        [ Expert 3 ]         |
|    AI Engineer         Software Developer        OSS Maintainer       |
|    listening           speaking                  listening            |
|                                                                       |
|  +-----------------------------+  +--------------------------------+  |
|  | Main audio / speaking       |  | Live transcript (P1)           |  |
|  | visual (optional)           |  | [Role A]: claim                |  |
|  |                             |  | [Role B]: response...          |  |
|  +-----------------------------+  +--------------------------------+  |
|                                                                       |
|              [Mic: speak to interrupt]   [End session]                |
|                  [Address: optional expert selector]                  |
+-----------------------------------------------------------------------+
```

### Screen C — Active session / mobile (P0)

```text
+-------------------------------+
| [LIVE / STATUS]       [End]    |
| Topic heading                 |
| [A]    [B speaking]    [C]   |
| Current voice / argument     |
| [Transcript, scrollable]     |
| ---------------------------  |
| [Pick expert] [MIC]           |
| [Mic status: listening...]    |
+-------------------------------+
```

### Screen D — Interrupted / listening (P0)

Freeze outdated speaker highlight, show foreground *'Listening to you…'* only if microphone captured successfully, and visually mark existing agent turn as interrupted. When processing starts, show *'Routing your question…'* rather than implying mic still active. The addressing UI should show the chosen expert if one is resolved.

### Screen E — Error and recovery (P0)

Provide distinct states for blocked microphone, connection loss, no recognizable speech, audio generation failure, and failed expert reply. Show recovery action only when supported. Never show fake waveforms/audio.

### Screen F — Session ended (P0)

Show a clear finished state and Start Again. Transcript/export is P1/P2 only if implemented.

## 4. Components and variants

| Component | Important variants / props | Notes |
|---|---|---|
| `TopicCard` | selected, available, description, role previews | Opening prompt is a separate, exact content field. |
| `ExpertCard` | idle, listening, speaking, addressed, unavailable; `agentId`, `voiceLabel` | State must follow live backend events. |
| `SessionStatus` | connecting, live, reconnecting, error, ended | Avoid a universal green 'LIVE' badge when disconnected. |
| `MicrophoneControl` | permission-needed, off, listening, processing, disabled | Clear text label; large touch area; keyboard operable. |
| `TranscriptPanel` | awaiting, partial, final, unavailable | P1; use actual audio/text events with speaker attribution. |
| `AudioStatus` | loading, speaking, paused, muted, failed | Real playback status, not timer-based simulation. |
| `TargetSelector` | none, selected, missing | Useful fallback; spoken targeting remains mandatory. |
| `EndSessionButton` | active, stopping, ended | Always visible, prevents stale playback. |
| `RecoveryNotice` | mic denied, disconnected, timed out, bad audio | Explicit next step, no fabricated success. |
| `EvidencePanel` | collapsed/expanded trace summary | P1 for judges: show a user-safe argument/message trace, not secret model reasoning. |

## 5. Visual speaker identity

Assign each expert a consistent icon/shape plus voice label. Roles must be driven from the **selected topic** (see Topic 1–3). Do not use three generic personas for all topics without explicit confirmation. Use at least a text label, consistent avatar and optional accent tint for each; never distinguish by color alone.

## 6. Micro-interactions

- New voice turn: visible role highlight when audio actually starts.
- Interruption: switch status promptly, stop old highlight, enable live input display.
- Handoff: crossfade/slide role highlight subtly **only after confirmed turn change**.
- Tool use (optional): concise status such as 'Checking a source…', and the result/outcome; no fabricated search animation.
- Reduced motion: static role labels and status text provide identical meaning.

## 7. Frontend developer handoff

Design component props and exact event-to-state mapping jointly; sample event names in `09_TEAM_HANDOFF_AND_CONTRACT.md` are illustrative. Provide desktop (1440px or equivalent), laptop and mobile (~390px) frames and all key error states. Export token values and SVG icons, not screenshot-only page layouts.

## 8. UI copy boundaries

Do **not** display 'Experts are independently researching', 'AI has learned from the debate', 'Conversation saved', or 'Live' unless the system actually supports the claim. **Do** display 'AI-generated expert perspectives' and the real permissions/processing state.
