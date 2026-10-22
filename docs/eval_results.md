# Evaluation results — 2026-10-22

| Check | Result | Evidence boundary |
|---|---|---|
| A0/A1 regressions | PASS | Current automated checks; mocked providers are labeled. |
| A2 real text roundtable | PASS (diagnostic settings) | 10 turns / 3 processes; 400 ms default failed. |
| A3 three real TTS voices | PASS (provider transport) | All three produced actual audio bytes. Acoustic quality unavailable. |
| A3/A4 real protocol | PASS | Synthetic playback client; no acoustic or microphone acceptance. |
| A4 microphone/STT | PARTIAL | Real Scribe transcribed synthesized speech; live microphone unverified. |
| A5 memory/claims | AUTOMATED ONLY | Verbatim bounded recall, unverified ledger, explicit focus shift; semantic recall not scored. |
| A6 recovery | AUTOMATED ONLY | Failed expert failover, guarded chaos, bounded configured fallback; live chaos not certified. |
| A7 drafting | EXPERIMENTAL / DISABLED | Cache tests pass; real timing probe failed; no live speedup claimed. |
| A8 submission | PARTIAL | Eval runner, traces and run guide exist; final UI acceptance, README assembly and demo video remain. |
| Short complete episode | PASS (protocol) | Actual report: docs/live_smoke_episode_results.json; no acoustic/microphone inference. |
| Long panel acceptance | NOT PASSED | Actual report: docs/live_episode_final_results.json; no acoustic/microphone inference. |
| Live reconnect/expert fault | NOT PASSED | Actual report: docs/live_recovery_results.json; no acoustic/microphone inference. |

Browser automation was denied Chrome access. No microphone/audibility pass or semantic quality score is inferred.

## Executed automated gates

### Backend regressions: PASS

```text
........................................................................ [ 86%]
...........                                                              [100%]
============================== warnings summary ===============================
..\a1-b2-integration\.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40
  C:\Dev\Hacks\multiagent podcast\.codex-local\worktrees\a1-b2-integration\.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40: DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
    _PortalFactoryType = typing.Callable[[], typing.ContextManager[anyio.abc.BlockingPortal]]

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
83 passed, 1 warning in 5.34s

```

### A1 player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 2.8852
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 0.7707
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 0.8048
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 1.1568
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 81.1999

```

### Panel player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 3.1395
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 1.055
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 1.053
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 1.6419
  type: 'test'
  ...
# Subtest: typed interruption rejects late chunks before a new epoch arrives
ok 5 - typed interruption rejects late chunks before a new epoch arrives
  ---
  duration_ms: 0.9572
  type: 'test'
  ...
# Subtest: pause during decoding prevents the pending source from starting
ok 6 - pause during decoding prevents the pending source from starting
  ---
  duration_ms: 0.9791
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 90.8088

```

### Actual frontend player lifecycle: PASS

```text
TAP version 13
# Subtest: out-of-order decoding preserves sentence order and never finishes before playback
ok 1 - out-of-order decoding preserves sentence order and never finishes before playback
  ---
  duration_ms: 1.906
  type: 'test'
  ...
# Subtest: End during decode invalidates pending sources and late chunks of that turn
ok 2 - End during decode invalidates pending sources and late chunks of that turn
  ---
  duration_ms: 0.2413
  type: 'test'
  ...
# Subtest: next turn starts sentence zero with clean buffers in the same epoch
ok 3 - next turn starts sentence zero with clean buffers in the same epoch
  ---
  duration_ms: 0.342
  type: 'test'
  ...
# Subtest: epoch advance cancels pending decode and rejects old epoch chunks
ok 4 - epoch advance cancels pending decode and rejects old epoch chunks
  ---
  duration_ms: 0.3451
  type: 'test'
  ...
# Subtest: generation completion after playback drained still reports finished once
ok 5 - generation completion after playback drained still reports finished once
  ---
  duration_ms: 0.2322
  type: 'test'
  ...
# Subtest: a second foreground turn cannot overlap the active turn
ok 6 - a second foreground turn cannot overlap the active turn
  ---
  duration_ms: 0.3164
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 439.9119

```

### Frontend pairing diagnostic: PASS

```text
{"mode":"mocked-browser-APIs / actual B5 AudioPlayer source","premature_finished_before_decode":false,"expected_sentence_starts":[0,1],"observed_sentence_starts":[0,1],"decode_requests":2}

```
