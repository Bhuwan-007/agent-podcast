"""Structured speech uses MOCK model/HTTP responses; no external API success implied."""
from collections import deque
import json

import httpx
import pytest

from agents.messages import Bid
from agents.model import ChatModel
from agents.speech_output import speech_schema, unpack_speech
from eval.test_a2 import expert
from agents.llm import AgentError


def test_schema_constrains_replies_to_delivered_and_retrieved_ids():
    schema = speech_schema({'delivered_turns': [{'turn_id': 9}], 'earlier_references': [{'turn_id': 2}],
                            'claims': [{'id': 'c1', 'agent_id': 'ai_engineer'}]}, 'ai_engineer')
    fields = schema['properties']['sentences']['items']['properties']
    assert fields['reply_to']['enum'] == [None, 2, 9]
    assert fields['corrects']['items']['enum'] == ['c1']
    assert schema['additionalProperties'] is False
    with pytest.raises(ValueError):
        unpack_speech('{"sentences":[{"text":"Missing metadata."}]}')


@pytest.mark.asyncio
async def test_structured_speech_still_validates_references_and_never_returns_json_to_tts():
    class StructuredModel:
        supports_structured_speech = True
        calls = 0
        invalid = False
        async def complete(self, system, data, **kwargs):
            self.calls += 1
            assert kwargs['response_schema']['additionalProperties'] is False
            return json.dumps({'sentences': [{'text': 'This is a bounded proposal.', 'act': 'interpretation',
                'source_ids': ['invented'] if self.invalid else [], 'reply_to': 9, 'corrects': []}]})
    model = StructuredModel()
    agent = expert(model)
    state = {'history': deque(), 'direct': deque(), 'memory': {'delivered_turns': [
        {'turn_id': 9, 'speaker': 'software_developer', 'text': 'A preceding point.'}]}}
    bid = Bid(intent='build', urgency=.5, novelty=.5, preview='A bounded proposal')
    assert await agent.speak(state, bid) == ['This is a bounded proposal.']
    assert state['speech_metadata'][0]['reply_to'] == 9
    model.invalid = True
    with pytest.raises(AgentError):
        await agent.speak(state, bid)
    assert model.calls == 3  # One successful call, then two bounded invalid attempts.


@pytest.mark.asyncio
async def test_configured_provider_fallback_keeps_structured_schema(monkeypatch):
    monkeypatch.setenv('LLM_BASE_URL', 'https://api.groq.com/openai/v1')
    monkeypatch.setenv('LLM_MODEL_SPEAK', 'openai/gpt-oss-120b')
    monkeypatch.setenv('LLM_MODEL_FALLBACK', 'openai/gpt-oss-20b')
    bodies = []
    schema = speech_schema({}, 'ai_engineer')
    def handle(request):
        body = json.loads(request.content)
        bodies.append(body)
        assert body['response_format']['json_schema'] == {'name': 'roundtable_speech', 'strict': True, 'schema': schema}
        if len(bodies) == 1:
            return httpx.Response(429)
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': '{"sentences":[]}'}}]})
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    try:
        await model.complete('system', 'context', response_schema=schema)
        assert [b['model'] for b in bodies] == ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
    finally:
        await model.close()
