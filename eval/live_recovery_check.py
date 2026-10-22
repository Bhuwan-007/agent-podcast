"""Real reconnect and owned-expert kill/reset check. No playback/acoustic claims."""
import argparse
import asyncio
import base64
import json
from pathlib import Path
import time

import httpx
from websockets.asyncio.client import connect


async def run(base, output='docs/mvp_recovery_results.json'):
    result = {'mode': 'real models/A2A/TTS; deliberate owned-expert fault',
              'acoustic_acceptance': False, 'restored_paused': False,
              'no_automatic_replay': False, 'surviving_expert_audio': False, 'reset_ok': False}
    result['notices'] = []
    url = base.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws'
    session_id = None
    killed = False
    began = time.perf_counter()
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        try:
            async with asyncio.timeout(70):
                async with connect(url) as ws:
                    await ws.send(json.dumps({'type': 'start_session', 'topic_id': 'topic_1'}))
                    async for raw in ws:
                        event = json.loads(raw)
                        session_id = event.get('session_id', session_id)
                        if event['type'] == 'turn_start':
                            result['session_id'] = session_id
                            break  # Disconnect during generation, before any confirmed speech.
                for _ in range(20):
                    snapshot = (await client.get(base + '/api/episodes/' + session_id)).json()
                    if not snapshot['connected']:
                        break
                    await asyncio.sleep(.1)
                async with connect(url) as ws:
                    await ws.send(json.dumps({'type': 'resume_session', 'session_id': session_id, 'last_seq': 0}))
                    async for raw in ws:
                        event = json.loads(raw)
                        if event['type'] == 'notice':
                            result['notices'].append({'code': event['code'], 'text': event['text']})
                        if event['type'] == 'session_state':
                            break
                    snapshot = (await client.get(base + '/api/episodes/' + session_id)).json()
                    result['restored_paused'] = snapshot['paused'] and snapshot['session_id'] == session_id
                    # No replay should be emitted while the restored episode awaits explicit Resume.
                    replay = False
                    try:
                        async with asyncio.timeout(.3):
                            while True:
                                if json.loads(await ws.recv())['type'] == 'audio_chunk':
                                    replay = True
                    except TimeoutError:
                        pass
                    result['no_automatic_replay'] = not replay
                    response = await client.post(base + '/admin/chaos/software_developer/kill',
                                                 headers={'X-Demo-Chaos': '1'})
                    response.raise_for_status()
                    killed = True
                    await asyncio.sleep(3.2)  # Let the real health monitor observe the stopped child.
                    response = await client.post(base + '/api/episodes/' + session_id + '/control',
                        headers={'X-Roundtable-Client': '1'}, json={'action': 'resume'})
                    response.raise_for_status()
                    speaker = None
                    async for raw in ws:
                        event = json.loads(raw)
                        if event['type'] == 'notice':
                            result['notices'].append({'code': event['code'], 'text': event['text']})
                        if event['type'] == 'turn_start':
                            speaker = event['agent_id']
                        if event['type'] == 'audio_chunk':
                            result['surviving_expert_audio'] = speaker in ('ai_engineer', 'oss_maintainer')
                            result['speaker_after_kill'] = speaker
                            result['received_bytes'] = len(base64.b64decode(event['data_b64']))
                            await ws.send(json.dumps({'type': 'end_session'}))
                        if event.get('state') == 'ended':
                            result['end_confirmed'] = True
                            break
                        if event.get('state') == 'recovery':
                            result['recovery'] = True
                            await ws.send(json.dumps({'type': 'end_session'}))
        except Exception as exc:
            result['error_type'] = type(exc).__name__
        finally:
            if killed:
                try:
                    response = await client.post(base + '/admin/chaos/software_developer/reset',
                                                 headers={'X-Demo-Chaos': '1'})
                    result['reset_ok'] = response.status_code == 200
                except Exception:
                    pass
    result['elapsed_ms'] = round((time.perf_counter() - began) * 1000, 1)
    result['protocol_pass'] = all(result.get(k, False) for k in
        ('restored_paused', 'no_automatic_replay', 'surviving_expert_audio', 'reset_ok', 'end_confirmed'))
    Path(output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return result['protocol_pass']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8000')
    parser.add_argument('--output', default='docs/mvp_recovery_results.json')
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.base, args.output)) else 1)
