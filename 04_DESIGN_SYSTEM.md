# 04 v2 — Design System: "The Table"

**Supersedes** doc 04 sections 2 (identity/tokens), 3 (screens), 4 (component visuals), 5 (speaker
identity) and 6 (micro-interactions). **Keeps** doc 04 sections 1 (principles), 7 (handoff) and 8
(UI copy boundaries), and every honesty rule in docs 01-03 (no fake waveform, no "Live" without
events, no invented state). Owner: lane B. Product name everywhere: **Roundtable AI**.

## 1. Concept

The product *is* a round table. A top-down view of a real table in a dim room, with one chair per
expert and one chair for **you**. Whoever is speaking is lit by a pool of warm light and leans in;
everyone else sits back in the shadow. Agent-to-agent messages are visible as threads pulled
between chairs. Your interruption is you pulling your own chair into the light.

Not allowed: shiny or neon blue / green / orange, purple-blue gradients, glassmorphism, glowing
borders, generic dark-blue dashboards, emoji icons, stock robot imagery, Inter-and-cards layouts.

## 2. Palette (muted, warm, matte)

| Token | Value | Use |
|---|---|---|
| `--room` | `#17120F` | Page background (warm near-black) |
| `--room-edge` | `#0E0A08` | Vignette edge |
| `--wood` | `#5A3F2E` | Table top |
| `--wood-edge` | `#3C2A1F` | Table rim / shadows |
| `--inlay-line` | `#8A6A4B` | Thin engraved lines, thread lines |
| `--inlay` | `#2A1F19` | Table centre (topic inlay) |
| `--paper` | `#EADFC8` | Name plates, slips, Minutes drawer |
| `--paper-shade` | `#CDBF9F` | Paper borders/shadow |
| `--ink` | `#1C1612` | Text on paper |
| `--text` | `#EFE6D2` | Text on the room |
| `--text-muted` | `#B7A98F` | Secondary text |
| `--light` | `rgba(255, 226, 170, 0.16)` | Spotlight pool |
| `--seat-1` | `#9C4A47` | Expert 1 (dusty oxblood) |
| `--seat-2` | `#B8975A` | Expert 2 (antique brass) |
| `--seat-3` | `#7B5C82` | Expert 3 (dusty plum) |
| `--seat-4` | `#8F8A7A` | Optional expert 4 (stone) |
| `--you` | `#EADFC8` | Your seat (ivory) |

Status without green/red/amber: **ok** = paper plate + check glyph; **warn** = brass dashed outline;
**error** = oxblood outline + "!" glyph on a paper slip; **info** = muted text. Never color alone:
each state also has a glyph and text. Check contrast (WCAG AA) for text on every surface.

## 3. Type, texture, icons

- Display / headings: **Fraunces** (soft serif). Body and transcript: **Newsreader**. Controls
  and labels: **Instrument Sans**. Trace/metrics/timestamps: **IBM Plex Mono**. Always provide
  system fallbacks. No Inter.
- Texture: one subtle paper-noise overlay (SVG `feTurbulence`, about 4% opacity) on paper surfaces;
  wood is a flat fill plus a faint two-tone linear gradient. No blur, no glow.
- Icons: line icons, 1.5 px stroke (lucide or custom). Mic, hand, lock, link, clock, check, alert.
- Radius: seats and table are circles; plates 6 px; slips 4 px. Spacing scale 4/8/12/16/24/32/48.

## 4. The table (Screen B, desktop 1440 x 900)

- A full-bleed `--room` with a soft vignette. Table: SVG circle, about 560 px, slightly left of
  centre. Right 380 px: the **Minutes** drawer (paper).
- **Seats** sit on a circle of radius about 330 px. Experts are spread evenly across the top
  200 degrees; **You** is at the bottom (6 o'clock). Compute with `seatPosition(index, total)`.
  Supports 3 or 4 experts.
- A seat = a top-down chair (rounded backrest arc in the expert's color) + a **monogram** in the
  serif + a **distinct shape** (circle / square / diamond / hexagon) so identity never depends on
  color alone + a **name plate** (paper card: role, display name, voice label).
- **Table centre** (inlay): the topic title in serif and, behind a "Read the question" toggle, the
  verbatim opening prompt.
- **Speaking:** on `speaker_active` (which follows real playback), the room dims to about 55% except
  the speaker, a `--light` radial pool fades onto their seat and plate, the seat shifts about 10 px
  toward the table centre, and a **speech slip** (paper strip with the current sentence) appears
  beside the plate. Draft text is italic and muted; final text is upright. A ring around the seat
  is static until B4, then amplitude-driven from a real `AnalyserNode`. No fake pulsing.
- **Threads:** when a `trace_event` arrives (`from` -> `to`), draw a thin `--inlay-line` thread
  between the two seats for about 1.5 s with a tiny mono label (e.g. `bid · challenge c7`).
  Data-driven only. Never decorative.
- **Addressing:** clicking or pressing Enter on an expert's name plate sets the addressee
  (`address_agent`); the selected plate gets a ring and "Addressed" label. This replaces the
  separate TargetSelector chips on desktop (keep chips on mobile).
- **Your seat:** a small desk-mic glyph with an explicit text state (Mic off / Mic on / Mic blocked).
  Controls row below the table: **Mic toggle** (primary) and **End session** (outlined, always visible).

## 5. Other screens

- **A. Lobby, "Choose a table".** Three top-down round tables in a row, each with its seat marks
  and the roles listed under it. Unavailable topics are covered by a cloth (muted overlay) with
  a plain "Closed, in development" slip. Selecting a table shows its background and the exact
  opening prompt as an inscription. Primary action: "Join this roundtable". Mic and AI-voice
  disclosure sits below as a paper slip.
- **D. Interrupted / listening.** The light moves to **your** seat (`user_speaking`, set locally
  on the first VAD frame). The previous speaker's plate gets an "Interrupted" slip and the
  room dims further. After `routing`, a thread is drawn from your seat to the addressed expert
  with the slip "Passing the floor to {role}". Until then: "Finding the right expert". Show
  "Listening to you" only when the mic is actually capturing.
- **E. Error / recovery** (always a paper slip pinned to the table rim, with a glyph, a plain
  sentence and one action):
  - `agent_timeout`: that expert's chair shows dashed outline and the plate says "Away".
  - `mic_denied`: your seat shows a lock glyph and the slip explains how to re-enable the mic.
  - `disconnected`: the whole table dims to about 40% with "Reconnecting" only while retrying.
  - `tts_failed`: the speaker's slip carries a "Text only" tag.
  - `no_speech`: "Didn't catch that" slip near your seat.
- **F. Ended.** Lights down: chairs pushed back about 12 px, table dimmed, centre reads
  "Roundtable ended". Minutes stay readable. Action: "New roundtable".
- **C. Mobile (390 px).** The table collapses to a 340 px arc at the top (3 experts on the arc,
  you as the bottom bar). Below it: the large speech slip, then the transcript. Bottom bar:
  Mic, address chips, End. Minutes open as a bottom sheet.

## 6. Minutes drawer (replaces the dashboard panels)

Paper surface, ink text, serif body. Tabs: **Transcript**, **Claims**, **Trace**, **Metrics**.
- Transcript: speaker monogram + text; partial vs final styled differently; interrupted turns
  struck with an "Interrupted" tag.
- Claims: the word "Claimed", never "Verified" unless `verified:true`.
- Trace: mono, user-safe summaries only (`from -> to · type · summary`).
- Metrics: mono table; `null`/unavailable shows "Unavailable", never 0.

## 7. Motion (and reduced motion)

Spotlight crossfade 350 ms ease-out; seat lean 250 ms; thread draw 600 ms via stroke-dashoffset;
dim 300 ms. With `prefers-reduced-motion`: no movement or drawing, instant opacity changes, a
static ring and the text label "Speaking". Meaning must be identical with and without motion.

## 8. Event to visual mapping (all from `contracts/ws_events.md`)

| Event | Visual |
|---|---|
| `topic_config` | Seats, plates, centre inlay |
| `session_state` | Header status plate; ended -> lights down |
| `speaker_active` | Spotlight, lean, speech slip |
| `transcript` (partial/final) | Speech slip + Minutes |
| `turn_end{interrupted}` | "Interrupted" slip on that plate |
| `routing` | Thread from your seat to target; `unknown_target` -> clarification slip |
| `trace_event` | Thread between seats |
| `claims_update` | Minutes -> Claims |
| `metrics` | Minutes -> Metrics |
| `notice` | Slip by code (section 5, E) |
| `session_state.mode = mock` | Persistent "Mock data" strip (ink on brass), never dismissible |

## 9. Implementation notes for the coding agent

- Build the table as one inline SVG plus absolutely positioned HTML plates (so plates are real
  `<button>`s: focusable, labelled, keyboard operable). No canvas, no heavy animation library.
- New components: `RoundTable`, `Seat`, `NamePlate`, `Spotlight`, `ThreadLayer`, `SpeechSlip`,
  `MinutesDrawer` (wraps TranscriptPanel, ClaimsLedger, TracePanel, MetricsPanel), `TableCard`
  (lobby), `Slip` (replaces RecoveryNotice styling). Keep the existing event/state code.
- Replace the old color tokens entirely. Remove the blue/green/amber role colors and any glow.
- Focus order: header, expert plates, your mic, End, Minutes. Visible focus ring in `--paper`.
- Acceptance: all six screens at 1440 px and 390 px; every state readable with colors removed
  (grayscale check) and with reduced motion; no color outside this palette.