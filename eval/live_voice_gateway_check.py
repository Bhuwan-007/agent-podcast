"""Real TTS -> in-memory synthetic user audio -> gateway STT/routing/TTS.

This is NOT microphone or acoustic evidence. Playback acknowledgements are synthetic.
No raw audio is written to disk or reports. Real calls consume provider quota.
"""
import argparse
import asyncio
import base64
from contextlib import aclosing
import json
import os
from pathlib import Path
import time

from dotenv import load_dotenv
from websockets.asyncio.client import connect

from gateway.voice.tts import ElevenLabsTTS, TTSConfig


async def run(base, env_file):
    load_dotenv(env_file, override=True)
    result = {'mode': 'real providers; synthesized user audio; synthetic playback acknowledgements',
              'microphone_acceptance': False, 'acoustic_acceptance': False,
              'routed_target': None, 'reply_audio_bytes': 0, 'resumed': False, 'end_confirmed': False,
              'notices': [], 'delivered_answer': []}
    began = time.perf_counter()
    try:
        async def text():
            yield 'Maya, what does the Reflexion abstract show, and does it prove general architectural judgment? '
        audio = bytearray()
        async with aclosing(ElevenLabsTTS(TTSConfig.from_env()).stream(text(), os.environ['VOICE_ID_AGENT2'])) as chunks:
            async for chunk in chunks:
                audio.extend(chunk)
        result['synthetic_input_bytes'] = len(audio)
        url = base.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws'
        submitted = False
        replied = False
        turn = None
        indices = set()
        async with asyncio.timeout(90), connect(url, max_size=4_000_000) as ws:
            async def send(event):
                await ws.send(json.dumps(event))
            await send({'type': 'start_session', 'topic_id': 'topic_1'})
            async for raw in ws:
                event = json.loads(raw)
                kind = event['type']
                if kind == 'notice':
                    result['notices'].append({'code': event['code'], 'text': event['text']})
                elif kind == 'turn_start':
                    turn = event
                    indices = set()
                    if replied and event['kind'] == 'agent':
                        result['resumed'] = True
                        await send({'type': 'end_session'})
                elif kind == 'routing':
                    result['routed_target'] = event['target']
                elif kind == 'transcript' and event.get('final'):
                    if event['speaker'] == 'human':
                        result['actual_stt_text'] = event['text']
                    elif turn and turn['kind'] == 'human_reply':
                        result['delivered_answer'].append(event['text'])
                elif kind == 'audio_chunk' and not submitted:
                    submitted = True
                    await send({'type': 'barge_in', 'turn_id': event['turn_id'], 'epoch': event['epoch'],
                                'sentence_idx': event['sentence_idx'], 'played_ms': 0})
                    await send({'type': 'mic_state', 'state': 'on'})
                    await send({'type': 'vad', 'state': 'start'})
                    for seq, at in enumerate(range(0, len(audio), 8192), 1):
                        await send({'type': 'user_audio', 'seq': seq, 'mime': 'audio/mpeg',
                                    'chunk_b64': base64.b64encode(audio[at:at+8192]).decode('ascii')})
                    await send({'type': 'vad', 'state': 'end'})
                    await send({'type': 'mic_state', 'state': 'off'})
                    audio.clear()
                elif kind == 'audio_chunk' and turn and turn['kind'] == 'human_reply':
                    result['reply_audio_bytes'] += len(base64.b64decode(event['data_b64']))
                    indices.add(event['sentence_idx'])
                elif kind == 'turn_end' and event['status'] == 'completed' and turn and turn['kind'] == 'human_reply':
                    for idx in sorted(indices):
                        await send({'type': 'playback_started', 'turn_id': event['turn_id'], 'epoch': event['epoch'], 'sentence_idx': idx})
                    await send({'type': 'playback_stopped', 'turn_id': event['turn_id'], 'epoch': event['epoch'], 'reason': 'finished'})
                    replied = True
                elif event.get('state') == 'recovery':
                    result['recovery'] = True
                    await send({'type': 'end_session'})
                elif event.get('state') == 'ended':
                    result['end_confirmed'] = True
                    break
    except Exception as exc:
        result['error_type'] = type(exc).__name__
    result['elapsed_ms'] = round((time.perf_counter() - began) * 1000, 1)
    result['protocol_pass'] = bool(result.get('actual_stt_text') and result['routed_target'] == 'oss_maintainer'
                                   and result['reply_audio_bytes'] > 0 and result['delivered_answer']
                                   and result['resumed'] and result['end_confirmed'])
    Path('docs/mvp_voice_gateway_results.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2, ensure_ascii=True))
    return result['protocol_pass']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8000')
    parser.add_argument('--env-file', required=True, type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.base, args.env_file)) else 1)
