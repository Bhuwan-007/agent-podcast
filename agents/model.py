"""Bounded provider calls owned by each agent process, never by the moderator."""
import asyncio
import os
import re
from urllib.parse import urlsplit

import httpx

from agents.llm import AgentError


class ChatModel:
    def __init__(self, client=None):
        self.base = os.getenv('LLM_BASE_URL', '').rstrip('/')
        self.key = os.getenv('LLM_API_KEY', '')
        self.speak_model = os.getenv('LLM_MODEL_SPEAK', '')
        # Explicit in CLI/report when this fallback is used; never change .env.
        self.bid_model = os.getenv('LLM_MODEL_BID') or self.speak_model
        if not self.base or not self.speak_model:
            raise ValueError('Configure LLM_BASE_URL and LLM_MODEL_SPEAK')
        self.client = client or httpx.AsyncClient(timeout=15, trust_env=False)

    async def close(self):
        await self.client.aclose()

    async def complete(self, system, data, *, bid=False, repair=False, _fallback=False):
        model = os.getenv('LLM_MODEL_FALLBACK', '') if _fallback else (self.bid_model if bid else self.speak_model)
        payload = {'model': model, 'messages': [
            {'role': 'system', 'content': system}, {'role': 'user', 'content': data}],
            'stream': False}
        groq = urlsplit(self.base).hostname == 'api.groq.com'
        if groq and model in ('openai/gpt-oss-20b', 'openai/gpt-oss-120b'):
            payload.update(reasoning_effort='low', include_reasoning=False)
        token_field = 'max_completion_tokens' if groq else 'max_tokens'
        payload[token_field] = (1536 if repair else 1024) if bid else (2048 if repair else 1024)
        if bid:
            payload['response_format'] = {'type': 'json_object'}
        headers = {'Authorization': f'Bearer {self.key}'} if self.key else {}
        try:
            async with asyncio.timeout(20):
                response = await self.client.post(f'{self.base}/chat/completions',
                                                  json=payload, headers=headers)
                fallback = os.getenv('LLM_MODEL_FALLBACK', '')
                if (not bid and not _fallback and fallback and fallback != model
                        and (response.status_code == 429 or response.status_code >= 500)):
                    # One configured fallback, inside the original total deadline.
                    return await self.complete(system, data, repair=repair, _fallback=True)
                response.raise_for_status()
                choice = response.json()['choices'][0]
                text = choice['message']['content']
                if choice.get('finish_reason') != 'stop':
                    raise AgentError('Model output incomplete')
                if not isinstance(text, str) or not text.strip() or re.search(
                        r'<(?:think|analysis|reasoning)\b', text, re.I):
                    raise AgentError('Invalid public model output')
                return text.strip()
        except AgentError:
            raise
        except httpx.HTTPStatusError as exc:
            # Status is public-safe; provider response body and keys are excluded.
            raise AgentError(f'Model service returned HTTP {exc.response.status_code}') from None
        except Exception:
            raise AgentError('Model request failed') from None
