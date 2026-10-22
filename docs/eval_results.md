# Evaluation results — 2026-10-22

| Check | Result | Evidence boundary |
|---|---|---|
| A0/A1 regressions | PASS | Current automated checks; mocked providers are labeled. |
| A2 real text roundtable | PASS (diagnostic settings) | 10 turns / 3 processes; 400 ms default failed. |
| A3 three real TTS voices | PASS (provider transport) | All three produced actual audio bytes. Acoustic quality unavailable. |
| A3/A4 real protocol | PASS | Synthetic playback client; no acoustic or microphone acceptance. |
| A4 voice-question gateway | PASS (transport) | Real synthesized input through gateway VAD/STT, named reply, resume and End; microphone unverified. |
| A5 memory/claims | AUTOMATED ONLY | Verbatim bounded recall, unverified ledger, explicit focus shift; semantic recall not scored. |
| A6 recovery | PASS (transport) | Real disconnect/paused restore, owned expert kill, surviving expert audio and reset; no acoustic claim. |
| A7 drafting | EXPERIMENTAL / DISABLED | Cache tests pass; real timing probe failed; no live speedup claimed. |
| A8 Person A demo | PASS (protocol) | Three experts, pause/resume, Maya question, closing, export and End; final browser listening remains open. |
| mvp_episode_results | PASS (protocol) | Actual report: docs/mvp_episode_results.json; synthetic playback acknowledgements, not microphone acceptance. |
| mvp_recovery_results | PASS (protocol) | Actual report: docs/mvp_recovery_results.json; synthetic playback acknowledgements, not microphone acceptance. |
| mvp_voice_gateway_results | PASS (protocol) | Actual report: docs/mvp_voice_gateway_results.json; synthetic playback acknowledgements, not microphone acceptance. |
| Historical baseline: Short complete episode | PASS (protocol) | Actual report: docs/live_smoke_episode_results.json; no acoustic/microphone inference. |
| Historical baseline: Long panel acceptance | NOT PASSED | Actual report: docs/live_episode_final_results.json; no acoustic/microphone inference. |
| Historical baseline: Live reconnect/expert fault | NOT PASSED | Actual report: docs/live_recovery_results.json; no acoustic/microphone inference. |

Browser automation was denied Chrome access. No microphone/audibility pass or semantic quality score is inferred.

## Executed automated gates

### Backend regressions: PASS

```text
........................................................................ [ 80%]
.................                                                        [100%]
============================== warnings summary ===============================
..\a1-b2-integration\.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40
  C:\Dev\Hacks\multiagent podcast\.codex-local\worktrees\a1-b2-integration\.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40: DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
    _PortalFactoryType = typing.Callable[[], typing.ContextManager[anyio.abc.BlockingPortal]]

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
89 passed, 1 warning in 7.03s

```

### A1 player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 3.7247
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 1.1864
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 1.2882
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 1.1956
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
# duration_ms 121.1573

```

### Panel player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 5.4769
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 1.4236
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 2.039
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 2.3262
  type: 'test'
  ...
# Subtest: new episode plays turn 1 after the previous episode paused turn 1
ok 5 - new episode plays turn 1 after the previous episode paused turn 1
  ---
  duration_ms: 1.525
  type: 'test'
  ...
# Subtest: retired socket callbacks cannot stop a new episode
ok 6 - retired socket callbacks cannot stop a new episode
  ---
  duration_ms: 1.1082
  type: 'test'
  ...
# Subtest: typed interruption rejects late chunks before a new epoch arrives
ok 7 - typed interruption rejects late chunks before a new epoch arrives
  ---
  duration_ms: 1.6591
  type: 'test'
  ...
# Subtest: pause during decoding prevents the pending source from starting
ok 8 - pause during decoding prevents the pending source from starting
  ---
  duration_ms: 1.3833
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 141.8516

```

### Actual frontend player lifecycle: PASS

```text
TAP version 13
# Subtest: out-of-order decoding preserves sentence order and never finishes before playback
ok 1 - out-of-order decoding preserves sentence order and never finishes before playback
  ---
  duration_ms: 2.1666
  type: 'test'
  ...
# Subtest: End during decode invalidates pending sources and late chunks of that turn
ok 2 - End during decode invalidates pending sources and late chunks of that turn
  ---
  duration_ms: 0.2962
  type: 'test'
  ...
# Subtest: next turn starts sentence zero with clean buffers in the same epoch
ok 3 - next turn starts sentence zero with clean buffers in the same epoch
  ---
  duration_ms: 0.41
  type: 'test'
  ...
# Subtest: epoch advance cancels pending decode and rejects old epoch chunks
ok 4 - epoch advance cancels pending decode and rejects old epoch chunks
  ---
  duration_ms: 0.54
  type: 'test'
  ...
# Subtest: generation completion after playback drained still reports finished once
ok 5 - generation completion after playback drained still reports finished once
  ---
  duration_ms: 0.4349
  type: 'test'
  ...
# Subtest: a second foreground turn cannot overlap the active turn
ok 6 - a second foreground turn cannot overlap the active turn
  ---
  duration_ms: 0.4591
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
# duration_ms 573.979

```

### Frontend pairing diagnostic: PASS

```text
{"mode":"mocked-browser-APIs / actual B5 AudioPlayer source","premature_finished_before_decode":false,"expected_sentence_starts":[0,1],"observed_sentence_starts":[0,1],"decode_requests":2}

```
