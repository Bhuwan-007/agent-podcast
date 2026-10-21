# workflow/collaboration.md — Two people, two branches, no clashes

Team: 2 people, each running Antigravity on their own machine. Goal: never block each other,
never break `main`, merge early and often.

## 1. Workflow: short-lived feature branches + lane ownership

- **`main` always runs.** It is the demo branch. Nothing half-broken goes in.
- **One branch per task**, named `<lane>/<thing>`, e.g. `agents/floor-protocol`,
  `web/hud-transcript`, `voice/barge-in-client`. Keep branches alive for hours, not days.
- **Lane ownership by folder.** Each person edits only their own folders. Different files means
  no merge conflicts.
- **Contracts first.** The browser-to-gateway events and the A2A messages are the seam between
  lanes. Agree on them before building (section 4).
- **Merge to `main` at least every 2 hours** and at the end of every phase. Big-bang merges at
  the end are how hackathon projects die.
- **No force pushes, no history rewriting.** Merge `main` into your branch rather than rebasing.

## 2. Default lanes (swap if you prefer)

| Area | Owner | Folders / files |
|---|---|---|
| Agents and protocol | A | `agents/**` (incl. `agents/personas/**`), `gateway/{moderator,a2a_client,ledger,router,tracing,chaos}.py` |
| Voice backend and server | A | `gateway/main.py`, `gateway/session.py`, `gateway/voice/tts.py`, `gateway/voice/stt.py` |
| Eval and technical docs | A | `eval/**`, `docs/eval_results.md`, `docs/protocol.md`, `architecture.md`, `prompts.md`, `STATUS-backend.md`, `requirements.txt`, `.env.example` (B adds vars via tiny PR) |
| Frontend app | B | `web/**` except `web/src/audio/**`, `web/dev/mock_gateway.py`, `package.json`, `STATUS-web.md` |
| Client audio (VAD, playback queue, barge-in, acks, metrics) | B, paired with A at the Phase 3/4 checkpoints | `web/src/audio/**` |
| Topic content | B | `topics/topic_N.json` (verbatim organizer text) |
| Product docs and tests | B | numbered docs 01-06, `docs/acceptance_results.md`, demo script, demo video, README assembly (A supplies run steps and `docs/protocol.md`) |
| Contracts and process | joint, `[contract]` PRs | `contracts/*.md`, `workflow/*.md` |

Persona behaviour (`agents/personas/topic_N/*.yaml`, A) and public topic content
(`topics/topic_N.json`, B) are separate files linked by `agent_id`, so nobody edits the same file.

Barge-in spans both lanes: **B** owns the client half (VAD, instant playback stop, progress acks);
**A** owns the gateway half (cancel LLM + TTS, spoken_text, routing). They meet at the
`contracts/ws_events.md` schema.

## 3. Start sequence (first 45 minutes, together)

1. One person (A) creates the repo, pushes Phase 0 scaffold to `main` (folders, `.gitignore`,
   `.env.example`, `requirements.txt`, empty READMEs). **Nobody branches before this lands.**
2. Keep the numbered product docs (01-06) where they are in the repo root. Put `architecture.md`,
   `prompts.md`, `workflow/` and `contracts/` in the repo as delivered.
3. Write `contracts/ws_events.md` and `contracts/a2a_messages.md` together (copy the message
   types from architecture.md section 4; add the browser events below).
4. Both clone, create branches, start.

### Browser <-> gateway events (SUPERSEDED: the canonical list is contracts/ws_events.md; the block below is only a sketch)

```
client -> gateway: start_session{topic} | barge_in{turn_id,sentence_idx,ms} |
                   playback_progress{turn_id,sentence_idx,ms} | mic_audio{chunk} | user_text{text}
gateway -> client: turn_start{turn_id,agent} | audio_chunk{turn_id,sentence_idx,data} |
                   transcript{turn_id,agent,text,final} | claims_update{claims[]} |
                   trace_event{...} | metrics{...} | notice{level,text} | turn_end{turn_id}
```

## 4. Contract changes

- A contract file changes **only through a tiny PR** titled `[contract] ...`, merged to `main`
  within minutes, with a message to the other person.
- Both sides pull `main` right after. Add fields rather than renaming or removing them.
- Until the other side is ready, develop against a stub that sits behind an interface and is
  tagged `MOCK-DEV`. Remove or label it before submission (real-vs-mocked table).

## 5. Parallel development without waiting

- **Frontend (B)** can develop against `web/dev/mock_gateway.py` (or a JSON replay file) that
  emits the events in section 3. She is never blocked by backend progress.
- **Backend (A)** can test with the CLI (`python -m gateway.cli "topic"`) and the eval script
  without any UI.
- Integration checkpoints: end of Phase 3 and end of Phase 4. Both merge to `main`, both run
  the acceptance checks together.

## 6. Conflict hot-spots and how to avoid them

| File | Risk | Rule |
|---|---|---|
| `requirements.txt` | Both add deps | Add deps in their own tiny commit, merge to `main` right away, tell the other |
| `package.json` / lockfile | Lockfile conflicts | Only B touches it. On conflict, take either side and re-run `npm install` |
| `.env.example` | Both add variables | One line per variable, alphabetical within sections, tiny PR |
| `README.md` | Both edit | Write sections in separate files under `docs/`; A assembles README at the end |
| `STATUS.md` | Both update | Use `STATUS-agents.md` and `STATUS-web.md`, merge into one at the end |
| Formatting / refactors | Touch everything | No repo-wide formatting or file moves outside your lane |
| `main` itself | Direct pushes | Merge only via PR (even a self-merge after a 2-minute look) |

## 7. Git cheat sheet

```bash
# start a task
git switch main && git pull
git switch -c agents/floor-protocol

# work: commit small, often
git add agents/ gateway/            # stage only your lane, never `git add -A` blindly
git commit -m "[agents] bid timeout handling"

# sync with main at least before every PR (and whenever the other person merged something)
git fetch origin
git merge origin/main               # fix conflicts if any, run the app, commit

# publish and open PR
git push -u origin agents/floor-protocol
# on GitHub: PR -> quick look by the other person -> Squash and merge -> delete branch

# after merge
git switch main && git pull
```

If a merge conflict looks scary: stop, do not let the coding agent "resolve" it blindly.
Look at the conflicting files together, keep both sides' intent, run the app, then commit.

## 8. Rhythm

- 5-minute sync at the start of every phase: who takes what, any contract changes.
- Merge checkpoint at least every 2 hours. Say "merged X to main" in your chat.
- Last 2-3 hours: **freeze**. Only bug-fix branches. A (or whoever is on the demo machine)
  does the final merge, tags `submission-candidate`, and runs the demo from a clean clone.
- Before submitting: scan git history for secrets, confirm `.env` is not tracked, confirm the
  repo is public.

## 9. Document precedence (when documents disagree)

**Superseded: use `workflow/reconciliation.md` section 4.** In short: brief and organizer topic pack
first; for technical design `contracts/` > `reconciliation.md` > `architecture.md` > `prompts.md`;
for product behaviour and copy docs 02 > 03 > 01; doc 04 for `web/` visuals only.

If two documents conflict and it is not obvious which wins, **do not guess**: record the
question in `DECISIONS.md` and ask the human. Things that must never be overridden by any
document: real A2A between agents, ElevenLabs for voice, open-source stack otherwise, dynamic
(non-scripted) dialogue, working interruption.

Review checklist for `prd.md` / `rules.md` / `design.md` (do this together once):
- Does anything imply a central controller writing all turns, scripted dialogue, or a non-ElevenLabs voice?
- Does the scope fit 2 days? Cut anything not in the brief's scoring table.
- Does the folder layout implied by docs 01-06 match architecture.md section 3? Differences are
  already resolved in `workflow/reconciliation.md`; add anything new there.

---

# Antigravity addendum (paste at the start of every session, after the global preamble)

```
COLLABORATION RULES (two humans, two agents, shared repo)
- Branch: <your-branch>. Lane: <agents|gateway|web|docs>. Edit ONLY files in your lane's folders:
  <list folders>. Do not modify other lanes' files, contracts/, or shared config except as below.
- Before starting any task: `git fetch && git merge origin/main`, then run the app/tests.
- Need something from the other lane (a new event, field, endpoint)? Do NOT edit their files.
  Write the request in HANDOFF.md, stub it locally behind an interface tagged MOCK-DEV, and
  tell the human so a [contract] PR can be raised.
- Contract files (contracts/*.md) change only via a tiny PR, and only additively.
- If you add a dependency, put it in an isolated commit and tell the human to merge it to main
  immediately. Do not run repo-wide formatters, renames or file moves.
- Commit after each working step with `[lane] short message`. Stage specific paths, never
  blindly stage everything. Never commit .env, API keys, logs/, audio files, node_modules,
  __pycache__.
- Never force-push, never `git reset --hard` or rebase shared branches, never delete files you
  did not create. If git state looks wrong, stop and ask the human.
- Do not resolve merge conflicts silently. Show the human the conflicting hunks and your
  proposed resolution first.
- When a task is done: run its acceptance check from workflow/overview.md, update
  STATUS-<lane>.md, push the branch, and tell the human to open a PR.
- Document precedence: see workflow/reconciliation.md section 4 (brief and topic pack; then
  contracts > reconciliation > architecture > prompts for technical design; docs 02 > 03 > 01 for
  product behaviour; doc 04 for web/ visuals). If unclear, write the question to DECISIONS.md
  and ask instead of guessing.
- Keep main demoable. Never leave a branch in a state you would not merge without saying so.
```