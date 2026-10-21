# handoff/B-to-A.md — requests from lane B (frontend) to lane A (backend)

Written ONLY by lane B's agent/human. Lane A reads it, acts, and replies in `A-to-B.md`.
Keep entries short, newest at the bottom. Contract changes still need a `[contract]` PR.

Template:
- [ ] YYYY-MM-DD HH:MM | what B needs from A or what changed | files/events involved | status: open/done

- [x] 2026-10-22 01:40 | Phase B4 complete and verified against A1: AudioPlayer MP3 queue sorts by sentence_idx and seq; dispatches real playback_started/playback_stopped acknowledgements; honors session epoch invalidation; speech highlight tied to playback start; 3D camera transitions smoothed with sentence hysteresis; full test suite passing (eval/check_mock_gateway.mjs, eval/test_a1_player.mjs, and web/test/*.test.mjs). Ready for live A1/A2 stream testing. | web/src/audio/AudioPlayer.ts, web/src/hooks/useGatewayWs.ts, web/src/components/ThreeTableScene.tsx | status: done