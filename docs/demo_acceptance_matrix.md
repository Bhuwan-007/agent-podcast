# Proposed demonstration matrix

These are engineering checks derived from the user's product requirements. They are not verified official scoring weights or guarantees of judging outcomes.

| Proposed factor | Implemented behavior | Observable evidence | Boundary |
|---|---|---|---|
| Technical correctness | Independent A2A experts, validated floor permission, playback gating | SDK integration tests and real-provider reports | Does not certify every possible conversation |
| Collaboration | Dynamic bids, direct peer challenges, addressed replies, shared delivered memory | Public traces and delivered transcript | Inspect substance; message delivery alone is not discussion quality |
| Evidence discipline | Stable source/claim IDs, exact excerpt viewer, reference validation, own-claim correction | `test_episode.py`, source HTTP pages and exported annotations | Citation entailment is not automatically verified |
| Human participation | Typed/voice routes, cancellation epochs, pause/resume | Unit/player tests, real WS tests; manual mic demo | Real microphone and acoustic stop remain unverified |
| Completeness | Topic 1 introduction, timed phases, closing path, delivered-text export | Short episode and full-episode JSON results | Only mark a live scenario passed if its report actually passed |
| Recovery | Guarded owned-expert faults, health monitor, bounded configured fallback, paused restore | `live_recovery_results.json` when executed and passed | In-memory restore only, 60-second lifetime |
| Engineering practices | Secret exclusion, separate branches/PRs, preserved teammate ownership, regression gates | Git PRs and reproducible commands in DEMO.md | One audio source file was edited with explicit user permission |

Must remain visible: unsupported claims are unverified; missing evidence is a limitation; a peer's agreement is not consensus. Model-derived closing takeaways require review against delivered turns. No test result should be inferred from UI animation.
