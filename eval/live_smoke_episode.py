"""Short real-provider vertical slice; synthetic playback acks, never acoustic evidence."""
import asyncio
import base64
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect


async def run():
    base = 'http://127.0.0.1:8001'
    report = {'mode': 'real providers / synthetic acknowledgements', 'acoustic_acceptance': False,
              'microphone_acceptance': False, 'bytes': 0, 'notices': [], 'targeted_reply': False,
              'concluded': False, 'end_confirmed': False}
    turns, indices = {}, {}
    session_id = None
    began = time.perf_counter()
    async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
        setup = await client.post(base + '/api/episodes/prepare', headers={'X-Roundtable-Client': '1'},
                                  json={'duration_minutes': .25, 'max_turns': 3})
        setup.raise_for_status()
        try:
            async with asyncio.timeout(90), connect('ws://127.0.0.1:8001/ws?setup_id=' + setup.json()['setup_id']) as ws:
                async def send(e): await ws.send(json.dumps(e))
                await send({'type': 'start_session', 'topic_id': 'topic_1'})
                async for raw in ws:
                    e = json.loads(raw)
                    session_id = e.get('session_id', session_id)
                    if e['type'] == 'turn_start':
                        turns[e['turn_id']] = e
                        indices[e['turn_id']] = set()
                    elif e['type'] == 'audio_chunk':
                        indices[e['turn_id']].add(e['sentence_idx'])
                        report['bytes'] += len(base64.b64decode(e['data_b64']))
                    elif e['type'] == 'notice':
                        report['notices'].append({'code': e['code'], 'text': e['text']})
                    elif e['type'] == 'turn_end' and e['status'] == 'completed':
                        for idx in sorted(indices[e['turn_id']]):
                            await send({'type': 'playback_started', 'turn_id': e['turn_id'], 'epoch': e['epoch'], 'sentence_idx': idx})
                        await asyncio.sleep(2 if e['turn_id'] == 1 else 8)
                        await send({'type': 'playback_stopped', 'turn_id': e['turn_id'], 'epoch': e['epoch'], 'reason': 'finished'})
                        if e['turn_id'] == 1:
                            await send({'type': 'user_utterance', 'utterance_id': 'source-smoke', 'input_mode': 'text',
                                        'final': True, 'target_hint': 'oss_maintainer',
                                        'text': 'What does the Reflexion abstract actually establish, and does it prove general architectural judgment?'})
                        if turns[e['turn_id']]['kind'] == 'human_reply':
                            report['targeted_reply'] = turns[e['turn_id']]['agent_id'] == 'oss_maintainer'
                        await asyncio.sleep(.1)
                        snapshot = (await client.get(base + '/api/episodes/' + session_id)).json()
                        if snapshot['concluded']:
                            report['concluded'] = True
                            report['delivered_episode'] = snapshot
                            report['export_ok'] = (await client.get(base + '/api/episodes/' + session_id + '/export')).status_code == 200
                            await send({'type': 'end_session'})
                    elif e.get('state') == 'recovery':
                        report['recovery'] = True
                        await send({'type': 'end_session'})
                    elif e.get('state') == 'ended':
                        report['end_confirmed'] = True
                        break
        except Exception as exc:
            report['error_type'] = type(exc).__name__
    report['elapsed_ms'] = round((time.perf_counter() - began) * 1000, 1)
    report['protocol_pass'] = all(report.get(k, False) for k in ('targeted_reply', 'concluded', 'export_ok', 'end_confirmed'))
    Path('docs/live_smoke_episode_results.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='delivered_episode'}, indent=2))
    return report['protocol_pass']


if __name__ == '__main__': raise SystemExit(0 if asyncio.run(run()) else 1)
