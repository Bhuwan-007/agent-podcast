# AI Roundtable: live demo and reproduction

This guide is for the backend-owned complete-episode demo. The teammate's cinematic React UI remains a separate client. Only its explicitly authorized AudioPlayer.ts repair was changed, in PR #8. The root WebSocket contract and organizer topic files are unchanged.

## Run

From a fresh checkout, create a virtual environment and install `requirements.txt`. Configure the private `.env` using `.env.example`: ElevenLabs key, three distinct accessible voice IDs, model base URL/key and speech/bid models. Neither `.env` nor `.codex-local/` belongs in Git.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -B -m gateway.launch --env-file .env --bid-model qwen/qwen3.8-27b --speak-model openai/gpt-oss-120b --fallback-model openai/gpt-oss-20b --bid-timeout-ms 2500
```

The named models were accessible during this session; availability and account quotas can change. These are explicit runtime settings, not edits to your private configuration. The bid deadline is a diagnostic 2,500 ms; the original 400 ms goal has not passed. Drafting is disabled. Use `--chaos` only for the deliberate localhost expert-failure demonstration.

Open `http://localhost:8000/dev/roundtable`. An existing gateway is running on port 8000 in this workspace, so final-development checks used the explicitly isolated `--port 8001` and `http://localhost:8001/`. Do not start the mock gateway for a real demo. `--port` also allows the matching local browser origin.

## Five-minute walkthrough

1. Review the source passages. The library contains three manually reviewed primary-paper abstract excerpts, with stable source IDs, exact passages, original links and limitations. These are not an organizer-approved source pack or a general web search tool.
2. Run **real preflight**. It checks voice metadata, distinct voice configuration, both model paths and actual ElevenLabs synthesis. Play the returned sample. Server synthesis success alone does not confirm your speakers work.
3. Set a three-minute episode and a permutation of the three configured voices. The tested Topic 1 participants remain Alex, Sam and Maya; other topics and arbitrary rosters are unavailable. Start the episode.
4. The short host introduction explains the question and agenda. Experts independently bid through A2A; the deterministic moderator allocates the floor. The phase progresses with elapsed time. It does not script who speaks or what they argue.
5. Ask Maya: “Does Reflexion prove an AI can choose the right architecture for any project? What does the passage actually support?” Inspect the citation against the original passage. A defensible answer distinguishes evaluated feedback-based improvement from a general architecture guarantee.
6. Pause during speech, then Resume. The local source stops; server work is cancelled and stale chunks are invalidated. The cut-off sentence is deliberately omitted from committed memory. Resume continues from committed context instead of replaying it.
7. With headphones and explicit mic permission, try a spoken question. Audio is transcribed by real ElevenLabs Scribe. This manual microphone/audibility step has not been certified by browser automation.
8. Use **Finish with takeaways**, or let the episode reach its duration/turn boundary. The closing model sees the committed conversation and corrections. Inspect the generated conclusion; do not assume an AI summary is infallible.
9. Download the delivered transcript JSON, including claims, source annotations, corrections and available client measurements. End stops current speech and generation immediately. No recorded audio export is implemented.

## How the components connect

`gateway/launch.py` loads configuration and starts FastAPI. `main.py` serves the demo, validates episode options and exposes preflight, control, source and export HTTP endpoints. Browser audio and existing session events still use `/ws`.

`panel_session.py` coordinates A2A requests, the deterministic moderator, TTS, playback acknowledgements and human routing. Three separate `agents.agent_server` processes each own their persona and model calls. Targeted questions synchronize context without buying unnecessary model bids. Internal A2A context-version IDs are kept separate from delivered-turn IDs used by reply references.

`episodes.py` manages pause/resume, the introduction, bounded snapshots and closing. A disconnected episode can be restored within 60 seconds in the same running gateway; it comes back paused, with no automatic audio replay. A process restart loses in-memory state honestly.

`ledger.py` commits complete delivered sentences and records claims, per-expert positions and explicit own-claim corrections. One peer agreeing does not erase another peer's challenge or establish consensus. Claims remain `verified:false`.

`evidence.py` provides the reviewed passages and rejects unknown source/reply/correction references. Reference integrity is automated; semantic entailment is not. A model-selected citation can still be inappropriate, so the user can inspect the actual passage. Source limitations are editorial scope notes, not quotations from the papers.

## Verification commands

```powershell
npm ci --prefix web
python -B -m eval.run_eval
node --test eval/test_web_player.mjs
node eval/check_b5_player.mjs
npm test --prefix web
npm run build --prefix web
```

Paid opt-in tests: `python -B -m eval.live_episode_check --base http://127.0.0.1:8001` and `python -B -m eval.live_recovery_check --base http://127.0.0.1:8001`. They disclose synthetic playback acknowledgements; neither certifies actual browser decoding, acoustic latency or microphone interruption. The long test deliberately waits between acknowledgements to reduce unrealistic quota pressure.

## Honest limits

- Read `docs/eval_results.md` and the actual JSON reports. Failed baselines are retained. A provider error is not turned into a success or substituted with mock audio.
- No browser acoustic/microphone pass is claimed. The earlier automation tool denied Chrome access.
- The episode duration is a target checked at turn boundaries, with an 18-turn default safety cap. The closing adds time. Pause freezes elapsed episode time.
- Memory and exports retain at most 60 turns and 120 claims; they are not durable recordings. Download promptly: disconnected reports expire after 60 seconds.
- Only Topic 1 and the three configured voices are enabled. No upload UI, arbitrary roster, comprehensive research search or complete audio recording exists.
- Model rate limits and malformed output can still cause recovery. Bounded validation/repair and configured fallback help; they cannot guarantee a provider's availability. Use Pause/Resume or retry Finish after quota recovers. Never describe a received-byte timing as audible latency.
- The exact organizer brief, scoring weights and organizer-assigned paper versions have not been verified. The paper abstracts themselves were checked against primary arXiv pages on 2026-10-22.
