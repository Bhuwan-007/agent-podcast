"""Episode/evidence acceptance with explicitly MOCKED external providers."""
import asyncio
import json
import time

import pytest
from fastapi.testclient import TestClient

from agents.messages import envelope
from gateway.evidence import SOURCES, validate_annotations
from gateway.episodes import EpisodeStore
from gateway.ledger import Ledger
from gateway.panel_session import PanelSession
from eval.test_panel import Pool, Audio, configured
from eval.test_session import Socket


def test_unknown_sources_replies_and_other_experts_corrections_rejected():
    memory = {'claims': [{'id': 'c1', 'agent_id': 'software_developer'}],
              'delivered_turns': [{'turn_id': 2}]}
    for annotation in ({'source_ids': ['invented']}, {'reply_to': 99}, {'corrects': ['c1']}):
        with pytest.raises(ValueError):
            validate_annotations({'annotations': [{'sentence_idx': 0, **annotation}]}, ['Claim.'], memory, 'ai_engineer')
    result = validate_annotations({'annotations': [{'sentence_idx': 0, 'source_ids': [SOURCES[0]['id']],
        'reply_to': 2, 'act': 'evidence'}]}, ['Bounded source claim.'], memory, 'ai_engineer')
    assert result[0]['verification'] == 'not_independently_verified'


def test_context_versions_cannot_be_mistaken_for_delivered_reply_ids():
    from eval.test_a2 import expert
    from collections import deque
    agent = expert()
    context = json.loads(agent.context({'history': deque([
        {'turn_id': 0, 'speaker': 'organizer_prompt', 'text': 'Opening context.'},
        {'turn_id': 2, 'speaker': 'software_developer', 'text': 'Actually heard.'}]),
        'direct': deque(), 'memory': {'delivered_turns': [
            {'turn_id': 7, 'speaker': 'software_developer', 'text': 'Actually heard.'}]}}))
    assert context['recent_turns'][0]['turn_id'] is None
    assert context['recent_turns'][1]['turn_id'] == 7


def test_delivered_correction_updates_own_claim_and_export_provenance():
    ledger = Ledger('A topic')
    ledger.remember('ai_engineer', 'An overbroad claim.', 1)
    ledger.remember('ai_engineer', 'I qualify that earlier claim.', 2,
        annotations={'0': {'act': 'correction', 'corrects': ['c1'], 'source_ids': []}})
    assert ledger.claims[0]['status'] == 'conceded'
    assert ledger.claims[0]['correction'] == 'I qualify that earlier claim.'
    assert all(not c['verified'] for c in ledger.claims)
    assert ledger.turns[-1]['annotations']['0']['corrects'] == ['c1']


def test_disagreeing_positions_are_not_overwritten_by_one_peer_agreeing():
    ledger = Ledger('Topic')
    ledger.remember('ai_engineer', 'A proposal.', 1)
    ledger.transition('c1', 'software_developer', 'challenge')
    ledger.transition('c1', 'oss_maintainer', 'agree')
    assert ledger.claims[0]['status'] == 'challenged'
    assert ledger.claims[0]['positions'] == {'software_developer': 'challenge', 'oss_maintainer': 'agree'}
    ledger.transition('c1', 'ai_engineer', 'concede')
    assert not ledger.transition('c1', 'software_developer', 'agree')
    assert ledger.claims[0]['status'] == 'conceded'


def test_extractive_closing_fallback_quotes_only_delivered_expert_text():
    session = PanelSession(Socket(), None)
    session.personas = {'software_developer': {'display_name': 'Sam'}}
    session.ledger = Ledger('Topic')
    session.ledger.remember('human', 'Unanswered question?', 1)
    assert 'No complete expert contribution' in session.extractive_recap()[0]
    session.ledger.remember('software_developer', 'A bounded proposal. Its qualification.', 2)
    recap = session.extractive_recap()
    assert 'Sam said: A bounded proposal.' in recap
    assert not any('agreed' in text for text in recap)


@pytest.mark.asyncio
async def test_targeted_question_context_sync_does_not_spend_model_bid_calls():
    from eval.test_a2 import expert, MockModel
    model = MockModel()
    agent = expert(model)
    reply = await agent.handle(envelope('floor.utterance', 'sync-only', 0, 'human', agent.id,
        text='A directed question.', request_bid=False))
    assert not model.calls and reply[0].payload['intent'] == 'pass'
    assert agent.state('sync-only')['history'][-1]['text'] == 'A directed question.'


@pytest.mark.asyncio
async def test_closing_rejects_silence_as_agreement_with_bounded_repair():
    from eval.test_a2 import expert
    from agents.messages import Bid
    from agents.llm import AgentError
    from collections import deque
    class ClosingModel:
        calls = 0
        async def complete(self, *args, **kwargs):
            self.calls += 1
            return 'Everyone agreed that the problem is solved.<<<CLAIMS>>>{"annotations":[]}'
    model = ClosingModel()
    agent = expert(model)
    state = {'closing': True, 'history': deque(), 'direct': deque(),
             'memory': {'delivered_turns': [{'speaker': 'oss_maintainer', 'text': 'A bounded proposal.', 'turn_id': 2}]}}
    with pytest.raises(AgentError):
        await agent.speak(state, Bid(intent='clarify', urgency=1, novelty=1, preview='Close episode'))
    assert model.calls == 2


@pytest.mark.asyncio
async def test_pause_cancels_generation_preserves_delivered_and_drops_stale_acks(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await session.cancel_turn()
    await session.begin_turn('ai_engineer')
    session.active['sentences'] = {0: 'A complete delivered sentence.', 1: 'Unheard ending.'}
    session.active['played'] = {0, 1}
    old = session.active.copy()
    await session.control('pause')
    assert session.paused and session.active is None and session.epoch > old['epoch']
    report = session.report()
    assert report['turns'][-1]['text'] == 'A complete delivered sentence.'
    assert 'Unheard ending.' not in json.dumps(report)
    before = len(socket.events)
    await session.handle({'type': 'playback_stopped', 'turn_id': old['id'], 'epoch': old['epoch'], 'reason': 'finished'})
    assert len(socket.events) == before
    await session.control('resume')
    assert not session.paused and session.worker
    await session.cancel_turn()


@pytest.mark.asyncio
async def test_closing_uses_only_committed_text_and_waits_for_playback(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await session.cancel_turn()
    session.ledger.remember('software_developer', 'Actually heard.', 1)
    await session.control('finish')
    start = await socket.until('turn_start')
    await socket.until('turn_end')
    assert not session.concluded
    request = next(e for e in pool.calls if e.type == 'human.question')
    assert request.payload['closing'] is True
    assert request.payload['memory']['delivered_turns'][0]['text'] == 'Actually heard.'
    await session.handle({'type': 'playback_started', 'turn_id': start['turn_id'], 'epoch': start['epoch'], 'sentence_idx': 0})
    await session.handle({'type': 'playback_stopped', 'turn_id': start['turn_id'], 'epoch': start['epoch'], 'reason': 'finished'})
    await asyncio.wait_for(session.worker, 2)
    assert session.concluded and session.paused
    assert session.report()['turns'][-1]['kind'] == 'closing_summary'


@pytest.mark.asyncio
async def test_restore_keeps_memory_and_never_automatically_replays(configured):
    async def factory(*args): return Pool(), Audio()
    old = PanelSession(Socket(), factory)
    await old.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await old.cancel_turn()
    old.ledger.remember('software_developer', 'Previously heard.', 1)
    old.connected = False
    old.detached_at = time.monotonic()
    old.paused_at = old.detached_at
    store = EpisodeStore()
    store.register(old)
    new = PanelSession(Socket(), factory)
    new.store = store
    store.register(new)
    await new.handle({'type': 'resume_session', 'session_id': old.session_id})
    assert new.session_id == old.session_id and new.paused and new.active is None and new.worker is None
    assert new.ledger.turns[0]['text'] == 'Previously heard.'
    assert not any(e['type'] == 'audio_chunk' for e in new.socket.events)
    await old.pool.close()
    await new.pool.close()


def test_expired_snapshots_and_pending_setups_are_bounded():
    store = EpisodeStore()
    session = PanelSession(Socket(), None)
    session.connected = False
    session.detached_at = time.monotonic() - 61
    store.register(session)
    store.prepared['expired'] = {'created': time.monotonic() - 301}
    store.clean()
    assert not store.sessions and not store.prepared


def test_http_setup_controls_and_source_passage_integrity():
    from gateway.main import app
    with TestClient(app) as client:
        assert client.post('/api/episodes/prepare', json={}).status_code == 403
        headers = {'X-Roundtable-Client': '1'}
        assert client.post('/api/episodes/prepare', json={'voice_order': [0, 0, 1]}, headers=headers).status_code == 422
        assert client.post('/api/episodes/prepare', json={'duration_minutes': 1}, headers=headers).status_code == 200
        assert client.post('/api/episodes/prepare', json={}, headers=headers | {'Origin': 'https://foreign.example'}).status_code == 403
        source = SOURCES[0]
        page = client.get('/api/sources/' + source['id'])
        assert page.status_code == 200 and source['excerpt'] in page.text and source['url'] in page.text
        assert client.get('/api/sources/invented').status_code == 404
        assert client.get('/api/episodes/unknown/export').status_code == 404


@pytest.mark.asyncio
async def test_preflight_missing_configuration_is_actionable_and_key_safe(monkeypatch):
    from gateway.preflight import preflight
    monkeypatch.delenv('ELEVENLABS_API_KEY', raising=False)
    result = await preflight()
    assert result['ready'] is False and 'ELEVENLABS_API_KEY' in result['missing_variables']
    assert 'sample_audio_b64' not in result


@pytest.mark.asyncio
async def test_bid_failure_retries_once_and_then_uses_a_real_received_bid(configured):
    from agents.messages import AGENTS, Bid
    class TimedOutPool(Pool):
        bid_rounds = []
        count = 0
        async def collect_bids(self, factory):
            self.count += 1
            if self.count == 1:
                self.bid_rounds = [{'agents': [{'status': 'timeout'}]}]
                return {a: Bid(intent='pass', urgency=0, novelty=0, preview='Unavailable') for a in AGENTS}
            self.bid_rounds.append({'agents': [{'status': 'received'}]})
            return await super().collect_bids(factory)
    pool, socket = TimedOutPool(), Socket()
    async def factory(*args): return pool, Audio()
    session = PanelSession(socket, factory, max_turns=1)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await socket.until('turn_start')
    assert pool.count == 2 and session.active is not None
    await session.cancel_turn()


@pytest.mark.asyncio
async def test_deliberate_pass_is_respected_and_recovery_resume_is_effective(configured):
    from agents.messages import AGENTS, Bid
    class PassingPool(Pool):
        count = 0
        bid_rounds = []
        async def collect_bids(self, factory):
            self.count += 1
            self.bid_rounds.append({'agents': [{'status': 'received'}]})
            return {a: Bid(intent='pass', urgency=0, novelty=0, preview='No new point') for a in AGENTS}
    pool, socket = PassingPool(), Socket()
    async def factory(*args): return pool, Audio()
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await asyncio.wait_for(session.worker, 2)
    assert pool.count == 1 and session.paused
    assert socket.events[-1]['state'] == 'recovery'
    assert not any(e['type'] == 'turn_start' for e in socket.events)
    await session.control('resume')
    await asyncio.wait_for(session.worker, 2)
    assert pool.count == 2 and session.paused


@pytest.mark.asyncio
async def test_qwen_bid_uses_documented_instruct_mode_without_reasoning_output(monkeypatch):
    import httpx
    from agents.model import ChatModel
    monkeypatch.setenv('LLM_BASE_URL', 'https://api.groq.com/openai/v1')
    monkeypatch.setenv('LLM_MODEL_SPEAK', 'qwen/qwen3.8-27b')
    monkeypatch.setenv('LLM_MODEL_BID', 'qwen/qwen3.8-27b')
    def handle(request):
        body = json.loads(request.content)
        assert body['reasoning_effort'] == 'none' and body['include_reasoning'] is False
        assert body['response_format'] == {'type': 'json_object'}
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': '{"ready":true}'}}]})
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    try:
        assert await model.complete('system', 'data', bid=True) == '{"ready":true}'
    finally:
        await model.close()
