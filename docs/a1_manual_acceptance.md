# A1 manual playback check — 2026-10-22

Tester: user, through the live backend-owned page at `http://localhost:8000/dev/a1`.
Method: user-reported observations in this development session. No audio/video was captured.

| Check | Observed result | Status |
|---|---|---|
| Start Topic 1 and hear the generated Alex response | Speech played clearly | Pass, user confirmed |
| Type a question after the response | Typed reply worked | Pass, user confirmed |
| Press End while speech is playing | Audio stopped immediately to the listener | Pass, user confirmed |

The user's report was: "Speech played clearly, typed reply worked, and End stopped audio immediately".

This verifies perceived playback and End behavior for this check. It does not establish
an exact acoustic stop time, live microphone interruption, routing, A2A or discussion memory.

## Latency limitation

The latest independent transport check received the first audio bytes 1,620.5 ms after
turn_start. Browser playback begins after buffering/decoding, so that run cannot demonstrate
the under-1.5-second audible-start goal. A browser timing reading was requested separately;
until recorded, that measurement remains unavailable. The functional result and performance
goal are reported separately. Do not mark the latency target passed.
