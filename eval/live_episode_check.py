"""Paid real-provider episode test with disclosed synthetic playback acknowledgements.

No audible playback or microphone success is inferred. Public delivered text is retained;
raw audio and credentials are not. Run with --base http://127.0.0.1:8001 for isolation.
"""
import argparse
import asyncio
import base64
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect


async def run(base, output, playback_delay=20):
    report = {'mode': 'real models/A2A/ElevenLabs; SYNTHETIC playback acknowledgements',
              'acoustic_acceptance': False, 'microphone_acceptance': False,
              'bytes': 0, 'completed_experts': [], 'notices': [], 'turn_timings': [],
              'pause_resume': False, 'targeted_question': False, 'concluded': False, 'end_confirmed': False}
    report['synthetic_ack_delay_seconds'] = playback_delay
    started = time.perf_counter()
    turn = None
    indices = set()
    paused = False
    asked = False
    human_reply = False
    session_id = None
    first = True
    invalidated = set()
    try:
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            setup = await client.post(base + '/api/episodes/prepare',
                headers={'X-Roundtable-Client': '1'}, json={'duration_minutes': 3, 'max_turns': 10})
            setup.raise_for_status()
            url = base.replace('http://', 'ws://').replace('https://', 'wss://')
            async with asyncio.timeout(260), connect(url + '/ws?setup_id=' + setup.json()['setup_id'], max_size=4_000_000) as ws:
                async def send(event):
                    await ws.send(json.dumps(event))
                async def control(action):
                    response = await client.post(base + '/api/episodes/' + session_id + '/control',
                        headers={'X-Roundtable-Client': '1'}, json={'action': action})
                    response.raise_for_status()
                    return response.json()
                await send({'type': 'start_session', 'topic_id': 'topic_1'})
                async for raw in ws:
                    event = json.loads(raw)
                    kind = event['type']
                    if event.get('turn_id') in invalidated and kind in ('audio_chunk', 'turn_end'):
                        continue
                    if kind == 'session_state':
                        session_id = event.get('session_id', session_id)
                        if event['state'] == 'ended':
                            report['end_confirmed'] = True
                            break
                        if event['state'] == 'recovery':
                            report['recovery'] = True
                            await send({'type': 'end_session'})
                    elif kind == 'notice':
                        report['notices'].append({'code': event['code'], 'text': event['text']})
                    elif kind == 'routing' and event['kind'] == 'targeted':
                        report['routed_target'] = event['target']
                    elif kind == 'turn_start':
                        turn = event
                        turn['received_at'] = time.perf_counter()
                        indices = set()
                        first = True
                    elif kind == 'audio_chunk':
                        report['bytes'] += len(base64.b64decode(event['data_b64']))
                        indices.add(event['sentence_idx'])
                        if first:
                            first = False
                            report['turn_timings'].append({'turn_id': event['turn_id'], 'agent': turn['agent_id'],
                                'turn_receipt_to_first_bytes_ms': round((time.perf_counter() - turn['received_at']) * 1000, 1)})
                        if event['turn_id'] > 1 and not paused:
                            paused = True
                            invalidated.add(event['turn_id'])
                            began_pause = time.perf_counter()
                            snapshot = await control('pause')
                            report['pause_control_ack_ms'] = round((time.perf_counter() - began_pause) * 1000, 1)
                            assert snapshot['paused'] and not any(t['turn_id'] == event['turn_id'] for t in snapshot['turns'])
                            await control('resume')
                            report['pause_resume'] = True
                        elif len(set(report['completed_experts'])) == 3 and not asked:
                            asked = True
                            invalidated.add(event['turn_id'])
                            await send({'type': 'barge_in', 'turn_id': event['turn_id'], 'epoch': event['epoch'],
                                        'sentence_idx': event['sentence_idx'], 'played_ms': 0})
                            await send({'type': 'user_utterance', 'utterance_id': 'episode-evidence-question',
                                'input_mode': 'text', 'final': True, 'target_hint': 'oss_maintainer',
                                'text': 'Does Reflexion prove an AI can choose the right architecture for any project? Challenge that inference using the supplied passage, explain what it actually supports, and propose one concrete evaluation.'})
                    elif kind == 'turn_end' and event['status'] == 'completed':
                        if turn['turn_id'] != event['turn_id']:
                            continue
                        for idx in sorted(indices):
                            await send({'type': 'playback_started', 'turn_id': event['turn_id'], 'epoch': event['epoch'], 'sentence_idx': idx})
                        # Explicit quota pacing, not decoding or a simulation of acoustic playback.
                        await asyncio.sleep(3 if turn['turn_id'] == 1 else playback_delay)
                        await send({'type': 'playback_stopped', 'turn_id': event['turn_id'], 'epoch': event['epoch'], 'reason': 'finished'})
                        if turn['kind'] == 'human_reply':
                            human_reply = True
                            report['targeted_question'] = turn['agent_id'] == 'oss_maintainer'
                        elif turn['turn_id'] != 1:
                            report['completed_experts'].append(turn['agent_id'])
                        # Allow the worker to commit the synthetic acknowledgement before reading.
                        await asyncio.sleep(.05)
                        snapshot = (await client.get(base + '/api/episodes/' + session_id)).json()
                        if snapshot['concluded']:
                            report['concluded'] = True
                            report['delivered_episode'] = snapshot
                            export = await client.get(base + '/api/episodes/' + session_id + '/export')
                            report['export_ok'] = export.status_code == 200 and export.json()['turns'] == snapshot['turns']
                            await send({'type': 'end_session'})
                        elif human_reply:
                            await control('finish')
                            human_reply = False
    except Exception as exc:
        report['error_type'] = type(exc).__name__
    report['elapsed_ms'] = round((time.perf_counter() - started) * 1000, 1)
    report['protocol_pass'] = (report['pause_resume'] and report['targeted_question'] and report['concluded']
                               and report.get('export_ok', False) and report['end_confirmed'])
    Path(output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'delivered_episode'}, indent=2))
    return report['protocol_pass']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8000')
    parser.add_argument('--output', default='docs/live_episode_results.json')
    parser.add_argument('--playback-delay', type=float, default=20)
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.base, args.output, args.playback_delay)) else 1)
