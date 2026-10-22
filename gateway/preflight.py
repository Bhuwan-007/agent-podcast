"""Opt-in real provider probes. No keys, voice IDs or provider bodies are returned."""
import asyncio
import base64
from contextlib import aclosing
import os
import time

import httpx

from agents.model import ChatModel
from gateway.evidence import SOURCES
from gateway.voice.tts import ElevenLabsTTS, TTSConfig


async def preflight():
    required = ['ELEVENLABS_API_KEY', 'VOICE_ID_AGENT1', 'VOICE_ID_AGENT2', 'VOICE_ID_AGENT3',
                'LLM_BASE_URL', 'LLM_MODEL_SPEAK']
    missing = [k for k in required if not os.getenv(k, '').strip()]
    result = {'mode': 'real_provider_probe', 'missing_variables': missing, 'checks': [],
              'sources': {'available': len(SOURCES), 'scope': 'Three reviewed abstract excerpts; not an organizer-approved evidence pack.'},
              'browser_playback': 'Requires the browser to play the returned real audio sample.',
              'microphone': 'Not tested by server preflight.'}
    if missing:
        result['ready'] = False
        return result
    voices = [os.getenv(f'VOICE_ID_AGENT{i}', '').strip() for i in (1, 2, 3)]
    if len(set(voices)) != 3:
        result['ready'] = False
        result['checks'].append({'name': 'distinct_voices', 'ok': False,
                                 'action': 'Choose three distinct accessible voice IDs in the private .env.'})
        return result

    async def probe(name, operation, action):
        started = time.perf_counter()
        try:
            async with asyncio.timeout(25):
                await operation()
            result['checks'].append({'name': name, 'ok': True,
                'elapsed_ms': round((time.perf_counter() - started) * 1000, 1)})
        except Exception as exc:
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            result['checks'].append({'name': name, 'ok': False, 'http_status': status,
                'elapsed_ms': round((time.perf_counter() - started) * 1000, 1), 'action': action})

    async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
        async def voice(i):
            response = await client.get('https://api.elevenlabs.io/v1/voices/' + voices[i],
                                        headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY']})
            response.raise_for_status()
            result.setdefault('voice_names', {})[str(i)] = str(response.json().get('name', f'Voice {i+1}'))[:100]
        await asyncio.gather(*(probe(f'voice_{i+1}_access', lambda i=i: voice(i),
            'Check that this voice is accessible to the ElevenLabs account used by your API key.') for i in range(3)))
    model = ChatModel()
    try:
        await probe('speech_model', lambda: model.complete('Reply with the single word ready.', 'Connectivity check.'),
                    'Check model access, account quota, network and configured speech model.')
        await probe('bid_model', lambda: model.complete('Return only JSON: {"ready":true}.', 'Connectivity check.', bid=True),
                    'Check bid-model access and account quota. A failed bid model prevents discussion.')
    finally:
        await model.close()
    if all(c['ok'] for c in result['checks']):
        async def synthesize():
            tts = ElevenLabsTTS(TTSConfig.from_env())
            async def text():
                yield 'Your live roundtable audio check is ready. '
            audio = bytearray()
            async with aclosing(tts.stream(text(), voices[0])) as chunks:
                async for chunk in chunks:
                    audio.extend(chunk)
                    if len(audio) > 500_000:
                        raise ValueError('Unexpected preflight audio size')
            if not audio:
                raise ValueError('No real audio returned')
            result['sample_audio_b64'] = base64.b64encode(audio).decode('ascii')
            result['sample_mime'] = 'audio/mpeg'
            result['sample_bytes'] = len(audio)
        await probe('real_speech_synthesis', synthesize,
                    'Voice access alone does not guarantee synthesis. Check credits, subscription and synthesis permission.')
    result['ready'] = all(c['ok'] for c in result['checks'])
    return result
