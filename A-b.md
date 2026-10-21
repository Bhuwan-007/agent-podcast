# handoff/A-to-B.md — requests from lane A (backend) to lane B (frontend)

Written ONLY by lane A's agent/human. Lane B reads it, acts, and replies in `B-to-A.md`.
Keep entries short, newest at the bottom. Contract changes still need a `[contract]` PR.

Template:
- [ ] YYYY-MM-DD HH:MM | what A needs from B or what changed | files/events involved | status: open/done

- [x] 2026-10-21 17:05 | Phase A0 scaffold ready for B: requirements.txt, .env.example, Makefile, gateway /health on 8000 (CORS allows 5173), logs/traces/ | requirements.txt, .env.example, gateway/main.py, Makefile | status: done