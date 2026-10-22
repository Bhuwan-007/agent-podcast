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

Browser automation was denied Chrome access. No microphone/audibility pass or semantic quality score is inferred.

## Executed automated gates

### Backend regressions: PASS

```text
......................................................................   [100%]
============================== warnings summary ===============================
.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40
  C:\Dev\Hacks\multiagent podcast\.codex-local\worktrees\a1-b2-integration\.codex-local\a2-clean-venv\Lib\site-packages\starlette\testclient.py:40: DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
    _PortalFactoryType = typing.Callable[[], typing.ContextManager[anyio.abc.BlockingPortal]]

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
70 passed, 1 warning in 6.14s

```

### A1 player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 7.4205
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 0.9037
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 1.3996
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 1.899
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
# duration_ms 172.6493

```

### Panel player lifecycle: PASS

```text
TAP version 13
# Subtest: playback acks follow source start and actual queue completion
ok 1 - playback acks follow source start and actual queue completion
  ---
  duration_ms: 4.4874
  type: 'test'
  ...
# Subtest: End during asynchronous decoding cannot start obsolete audio
ok 2 - End during asynchronous decoding cannot start obsolete audio
  ---
  duration_ms: 1.0332
  type: 'test'
  ...
# Subtest: higher epoch stops old playback and suppresses its finished acknowledgement
ok 3 - higher epoch stops old playback and suppresses its finished acknowledgement
  ---
  duration_ms: 0.9972
  type: 'test'
  ...
# Subtest: three sentence responses play in order without overlap
ok 4 - three sentence responses play in order without overlap
  ---
  duration_ms: 2.1372
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
# duration_ms 110.4305

```
