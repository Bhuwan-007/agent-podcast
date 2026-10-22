"""Bounded memory and failure recovery; external services are MOCK-TEST."""
import asyncio

import pytest

from agents.messages import AGENTS
from gateway.ledger import Ledger
from gateway.panel_session import PanelSession
from eval.test_panel import Pool, Audio, configured
from eval.test_session import Socket


def test_verbatim_memory_earlier_callback_and_bounded_storage():
    ledger = Ledger('AI and developers')
    ledger.remember('software_developer', 'Architecture needs explicit requirements.', 1)
    for i in range(2, 25):
        ledger.remember('ai_engineer', f'Test contribution number {i}.', i)
    refs = ledger.context('What did Sam say about architecture requirements?')['earlier_references']
    assert any(t['turn_id'] == 1 and t['text'] == 'Architecture needs explicit requirements.' for t in refs)
    assert all(c['verified'] is False for c in ledger.claims)
    for i in range(25, 150):
        ledger.remember('ai_engineer', f'Further contribution {i}.', i)
    assert len(ledger.turns) == 60 and len(ledger.claims) == 120
    assert len(ledger.context()['summary'].split()) <= 120


def test_claim_transitions_have_actor_constraints_and_shift_preserves_archive():
    ledger = Ledger('Topic 1')
    ledger.remember('ai_engineer', 'Verification costs matter.', 1)
    claim = ledger.claims[0]['id']
    assert not ledger.transition(claim, 'ai_engineer', 'challenge')
    assert ledger.transition(claim, 'oss_maintainer', 'challenge')
    assert ledger.claims[0]['status'] == 'challenged'
    assert not ledger.transition(claim, 'oss_maintainer', 'concede')
    assert ledger.transition(claim, 'ai_engineer', 'concede')
    assert not ledger.claims[0]['verified']
    ledger.shift('A different focus')
    assert ledger.public_claims() == []
    assert ledger.context('verification costs')['earlier_references'][0]['text'] == 'Verification costs matter.'


@pytest.mark.asyncio
async def test_failed_speaker_does_not_take_down_remaining_experts(configured):
    class FailingPool(Pool):
        failed = False
        async def call(self, agent, event, **kwargs):
            if event.type == 'floor.grant' and not self.failed:
                self.failed = True
                raise RuntimeError('MOCK expert unavailable')
            return await super().call(agent, event, **kwargs)
    socket, pool, audio = Socket(), FailingPool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory, max_turns=1)
    try:
        await session.handle({'type':'start_session', 'topic_id':'topic_1'})
        while True:
            end = await socket.until('turn_end')
            if end['status'] == 'completed': break
        assert any(e['type'] == 'notice' and e['code'] == 'agent_timeout' for e in socket.events)
        assert session.active is not None and session.turn_id == 2
        await session.handle({'type':'playback_started', 'turn_id':end['turn_id'], 'epoch':end['epoch'], 'sentence_idx':0})
        await session.handle({'type':'playback_stopped', 'turn_id':end['turn_id'], 'epoch':end['epoch'], 'reason':'finished'})
        await asyncio.wait_for(session.worker, 2)
        assert len(session.history) == 1
    finally:
        await session.cancel_turn()


def test_chaos_disabled_by_default(monkeypatch):
    from fastapi.testclient import TestClient
    from gateway.main import app
    monkeypatch.delenv('ENABLE_CHAOS', raising=False)
    with TestClient(app) as client:
        assert client.post('/admin/chaos/ai_engineer/kill').status_code == 403


@pytest.mark.asyncio
async def test_configured_model_fallback_is_bounded_and_auth_is_not_retried(monkeypatch):
    import httpx
    import json
    from agents.model import ChatModel
    from agents.llm import AgentError
    monkeypatch.setenv('LLM_BASE_URL', 'https://provider.example/v1')
    monkeypatch.setenv('LLM_MODEL_SPEAK', 'primary')
    monkeypatch.setenv('LLM_MODEL_FALLBACK', 'configured-fallback')
    models = []
    def handle(request):
        models.append(json.loads(request.content)['model'])
        if len(models) == 1: return httpx.Response(429)
        return httpx.Response(200, json={'choices':[{'finish_reason':'stop','message':{'content':'A public answer.'}}]})
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    try:
        assert await model.complete('system','data') == 'A public answer.'
        assert models == ['primary','configured-fallback']
    finally: await model.close()
    models.clear()
    def unauthorized(request):
        models.append('request')
        return httpx.Response(401)
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(unauthorized)))
    try:
        with pytest.raises(AgentError): await model.complete('system','data')
        assert len(models) == 1
    finally: await model.close()


@pytest.mark.asyncio
async def test_preparation_reused_only_for_exact_context_and_consumed_once():
    from eval.test_a2 import expert, MockModel
    from agents.messages import envelope
    model=MockModel()
    agent=expert(model)
    await agent.handle(envelope('floor.utterance','draft',0,'organizer_prompt',agent.id,text='Opening'))
    await agent.handle(envelope('floor.prepare','draft',1,'gateway',agent.id,
        speaker='software_developer',text='A public point.',memory={}))
    count=len(model.calls)
    reply=await agent.handle(envelope('floor.utterance','draft',1,'software_developer',agent.id,
        text='A public point.',memory={}))
    assert reply[0].cache_hit and len(model.calls)==count
    await agent.handle(envelope('floor.grant','draft',2,'gateway',agent.id,context_version=1))
    assert len(model.calls)==count
    await agent.handle(envelope('floor.prepare','draft',2,'gateway',agent.id,
        speaker='software_developer',text='Expected point.',memory={}))
    reply=await agent.handle(envelope('floor.utterance','draft',2,'software_developer',agent.id,
        text='Changed after interruption.',memory={}))
    assert not reply[0].cache_hit
