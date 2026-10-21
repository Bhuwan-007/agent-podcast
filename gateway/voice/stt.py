"""In-memory ElevenLabs batch STT. Raw microphone bytes never go to disk or traces."""
import asyncio
import os

import httpx


class STTError(RuntimeError):
    pass


class ElevenLabsSTT:
    async def transcribe(self, audio, mime):
        if not 100 <= len(audio) <= 4_000_000:
            raise STTError('Audio is empty, too short or too large')
        if mime.split(';')[0] not in ('audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'):
            raise STTError('Unsupported microphone format')
        key = os.getenv('ELEVENLABS_API_KEY', '')
        if not key:
            raise STTError('Speech recognition is not configured')
        try:
            async with asyncio.timeout(20), httpx.AsyncClient(timeout=18, trust_env=False) as client:
                response = await client.post('https://api.elevenlabs.io/v1/speech-to-text',
                    headers={'xi-api-key': key},
                    data={'model_id': os.getenv('ELEVENLABS_STT_MODEL', 'scribe_v2'),
                          'tag_audio_events': 'false', 'diarize': 'false'},
                    files={'file': ('utterance', audio, mime)})
                if response.status_code != 200:
                    raise STTError(f'Speech recognition returned HTTP {response.status_code}')
                text = response.json().get('text', '').strip()
                if not 3 <= len(text) <= 2000:
                    raise STTError('No clear speech was recognized')
                return text
        except STTError:
            raise
        except Exception:
            raise STTError('Speech recognition request failed') from None
