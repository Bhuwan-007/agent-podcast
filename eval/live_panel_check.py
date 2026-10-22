"""Opt-in real provider check. No fake playback acks, audio files, or API successes."""
import argparse
import asyncio
import json
from pathlib import Path
import time

from dotenv import load_dotenv
import os
from websockets.asyncio.client import connect

from gateway.voice.tts import ElevenLabsTTS, TTSConfig
from gateway.voice.stt import ElevenLabsSTT


async def run(args):
    load_dotenv(args.env_file, override=True)
    report = {'mode': 'real providers', 'playback': 'not tested; no playback acknowledgements fabricated'}
    tts = ElevenLabsTTS(TTSConfig.from_env())
    voices = []
    spoken_input = b''
    for i in (1, 2, 3):
        text = 'Maya, how can we check the security of generated code?' if i == 2 else 'This is a real voice connection check.'
        async def chunks(): yield text + ' '
        began, first, size, audio = time.perf_counter(), None, 0, []
        try:
            async for data in tts.stream(chunks(), os.environ[f'VOICE_ID_AGENT{i}']):
                if first is None: first = round((time.perf_counter()-began)*1000, 1)
                size += len(data)
                if i == 2: audio.append(data)
            voices.append({'agent': i, 'success': size > 0, 'bytes': size, 'first_bytes_ms': first})
            if i == 2: spoken_input = b''.join(audio)
        except Exception as exc:
            voices.append({'agent': i, 'success': False, 'error_type': type(exc).__name__})
    report['voices'] = voices
    if spoken_input:
        began = time.perf_counter()
        try:
            text = await ElevenLabsSTT().transcribe(spoken_input, 'audio/mpeg')
            report['stt'] = {'success': True, 'text': text, 'elapsed_ms': round((time.perf_counter()-began)*1000, 1),
                             'input': 'synthetic spoken test question, not microphone acceptance'}
        except Exception as exc:
            report['stt'] = {'success': False, 'error_type': type(exc).__name__}
        spoken_input = b''
    began = time.perf_counter()
    result = {'audio_bytes': 0, 'complete_generation': False}
    try:
        async with asyncio.timeout(60), connect(args.ws, max_size=4_000_000) as ws:
            await ws.send(json.dumps({'type': 'start_session', 'topic_id': 'topic_1', 'session_id': None}))
            while True:
                event = json.loads(await ws.recv())
                if event['type'] == 'turn_start':
                    result['speaker'] = event['agent_id']
                if event['type'] == 'audio_chunk':
                    import base64
                    result['audio_bytes'] += len(base64.b64decode(event['data_b64']))
                    result.setdefault('start_to_first_bytes_ms', round((time.perf_counter()-began)*1000, 1))
                if event['type'] == 'notice':
                    result.setdefault('notices', []).append(event['code'])
                if event['type'] == 'turn_end' or event.get('state') == 'recovery':
                    result['complete_generation'] = event.get('status') == 'completed'
                    await ws.send(json.dumps({'type': 'end_session'}))
                if event.get('state') == 'ended':
                    result['end_confirmed'] = True
                    break
    except Exception as exc:
        result['error_type'] = type(exc).__name__
    report['gateway'] = result
    args.report.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--ws', default='ws://127.0.0.1:8000/ws')
    parser.add_argument('--report', type=Path, default=Path('docs/live_voice_results.json'))
    asyncio.run(run(parser.parse_args()))
