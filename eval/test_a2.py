"""A2 regressions. Model responses are explicitly mocked; protocol uses the real SDK."""
import ast
import asyncio
import json
from pathlib import Path

import httpx
import pytest
import yaml

from agents.agent_server import ROOT, create_app
from agents.base_agent import ExpertAgent
from agents.messages import AGENTS, Bid, Envelope, envelope
from agents.model import ChatModel
from gateway.a2a_client import AgentPool
from gateway.cli import discuss
from gateway.moderator import Moderator
from gateway.tracing import TraceLogger


class MockModel:
    """MOCK-TEST only: never used by CLI or live evidence."""
    def __init__(self, index=0):
        self.index, self.calls = index, []

    async def complete(self, system, data, **kwargs):
        self.calls.append((system, data, kwargs))
        if kwargs.get('bid'):
            context = json.loads(data)
            latest = context['latest']
            target = latest['speaker'] if latest['speaker'] in AGENTS else None
            return json.dumps({'intent': 'challenge' if target else 'build', 'target': target,
                'claim_id': None, 'urgency': 0.5 + self.index * 0.1, 'novelty': 0.8,
                'preview': 'Test contribution'})
        return 'This is mocked test speech. A second test sentence.<<<CLAIMS>>>{"claims":[]}'

    async def close(self):
        pass


def expert(model=None):
    persona = yaml.safe_load((ROOT / 'agents/personas/topic_1/ai_engineer.yaml').read_text())
    topic = json.loads((ROOT / 'topics/topic_1.json').read_text())
    return ExpertAgent(persona, topic, model or MockModel())


def bid(**kwargs):
    return Bid(intent='build', urgency=kwargs.get('urgency', .5), novelty=kwargs.get('novelty', .5), preview='New point')


def test_moderator_fairness_determinism_and_content_independence():
    bids = {agent: bid() for agent in AGENTS}
    a, b = Moderator(7), Moderator(7)
    for _ in range(10):
        winner, scores = a.choose(bids)
        other, _ = b.choose(bids)
        assert winner == other
        assert winner not in a.speakers[-1:]
        a.record(winner)
        b.record(winner)
    assert set(a.speakers) == set(AGENTS)
    assert max(a.speakers.count(s) for s in AGENTS) - min(a.speakers.count(s) for s in AGENTS) <= 1
    tree = ast.parse((ROOT / 'gateway/moderator.py').read_text())
    imports = [n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)]
    assert all(not any(word in (module or '') for word in ('model', 'llm', 'httpx')) for module in imports)


def test_bids_change_selection_and_all_pass_is_honest():
    moderator = Moderator()
    winner, _ = moderator.choose({'a': bid(urgency=1, novelty=1), 'b': bid(urgency=0, novelty=0)})
    assert winner == 'a'
    winner, _ = moderator.choose({'a': bid(urgency=0, novelty=0), 'b': bid(urgency=1, novelty=1)})
    assert winner == 'b'
    assert moderator.choose({'a': Bid(intent='pass', urgency=1, novelty=1, preview='pass')}) == (None, {})


@pytest.mark.parametrize('patch', [{'urgency': float('nan')}, {'novelty': 2}, {'target': 'unknown'},
                                  {'preview': 'word ' * 13}, {'intent': 'forced'}])
def test_invalid_bids_rejected(patch):
    with pytest.raises(ValueError):
        Bid.model_validate(bid().model_dump() | patch)


@pytest.mark.asyncio
async def test_agent_memory_direct_messages_stale_grants_and_speech():
    agent = expert()
    response = await agent.handle(envelope('floor.utterance', 'session', 0, 'organizer_prompt', agent.id, text='Question'))
    assert response[0].type == 'floor.bid'
    with pytest.raises(ValueError):
        await agent.handle(envelope('floor.grant', 'session', 1, 'gateway', agent.id, context_version=99))
    await agent.handle(envelope('agent.direct', 'session', 0, 'software_developer', agent.id,
                                text='How would that be tested?', act='clarify'))
    output = await agent.handle(envelope('floor.grant', 'session', 1, 'gateway', agent.id, context_version=0))
    assert [x.payload['sentence_idx'] for x in output] == [0, 1]
    assert output[-1].payload['final']
    assert 'How would that be tested?' in agent.model.calls[-1][1]
    with pytest.raises(ValueError):
        await agent.handle(envelope('floor.grant', 'session', 1, 'gateway', agent.id, context_version=0))
    with pytest.raises(ValueError):
        await agent.handle(envelope('floor.utterance', 'session', 0, 'organizer_prompt', agent.id, text='Question'))
    assert not agent.state('another')['history']
    for i in range(70):
        agent.state(f'new-{i}')
    assert len(agent.sessions) == 64


@pytest.mark.asyncio
async def test_speech_retry_does_not_drop_sentences():
    class Oversized(MockModel):
        async def complete(self, *args, **kwargs):
            self.calls.append(kwargs)
            return ('One. Two. Three. Four.<<<CLAIMS>>>{}' if len(self.calls) == 1
                    else 'Short corrected answer.<<<CLAIMS>>>{}')
    model = Oversized()
    agent = expert(model)
    assert await agent.speak(agent.state('session'), bid()) == ['Short corrected answer.']
    assert len(model.calls) == 2 and model.calls[1]['repair']


@pytest.mark.asyncio
async def test_concurrent_duplicate_grants_cannot_generate_two_answers():
    started, release = asyncio.Event(), asyncio.Event()
    class Paused(MockModel):
        async def complete(self, *args, **kwargs):
            if not kwargs.get('bid'):
                started.set()
                await release.wait()
            return await super().complete(*args, **kwargs)
    agent = expert(Paused())
    await agent.handle(envelope('floor.utterance', 'race', 0, 'organizer_prompt', agent.id, text='Question'))
    grant = envelope('floor.grant', 'race', 1, 'gateway', agent.id, context_version=0)
    first = asyncio.create_task(agent.handle(grant))
    await started.wait()
    try:
        with pytest.raises(ValueError):
            await agent.handle(grant)
    finally:
        release.set()
        await first


@pytest.mark.asyncio
async def test_malformed_metadata_and_unsupported_research_are_not_spoken():
    from agents.llm import AgentError
    for bad in ('Spoken text. <<<CLAIMS>><<JSON>>{}',
                'Recent research shows this works.<<<CLAIMS>>>{}',
                'Unmarked speech. {"claims":[]}'):
        class Invalid(MockModel):
            async def complete(self, *args, **kwargs):
                return bad
        agent = expert(Invalid())
        with pytest.raises(AgentError):
            await agent.speak(agent.state('session'), bid())


@pytest.mark.asyncio
async def test_model_uses_own_config_and_never_surfaces_provider_body(monkeypatch):
    monkeypatch.setenv('LLM_BASE_URL', 'https://api.groq.com/openai/v1')
    monkeypatch.setenv('LLM_MODEL_SPEAK', 'openai/gpt-oss-20b')
    monkeypatch.setenv('LLM_MODEL_BID', 'llama-3.1-8b-instant')
    payloads = []
    def handler(request):
        payloads.append(json.loads(request.content))
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': '{}'}}]})
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    await model.complete('system', 'data', bid=True)
    await model.complete('system', 'data')
    assert payloads[0]['model'] == 'llama-3.1-8b-instant'
    assert 'reasoning_effort' not in payloads[0]
    assert payloads[1]['reasoning_effort'] == 'low' and payloads[1]['include_reasoning'] is False
    await model.close()
    from agents.llm import AgentError
    model = ChatModel(httpx.AsyncClient(transport=httpx.MockTransport(
        lambda request: httpx.Response(401, json={'error': 'PRIVATE_PROVIDER_BODY'}))))
    try:
        with pytest.raises(AgentError, match='HTTP 401') as error:
            await model.complete('system', 'data')
        assert 'PRIVATE_PROVIDER_BODY' not in str(error.value)
    finally:
        await model.close()


class AppTransport(httpx.AsyncBaseTransport):
    def __init__(self, apps):
        self.apps = {port: httpx.ASGITransport(app=app) for port, app in apps.items()}

    async def handle_async_request(self, request):
        return await self.apps[request.url.port].handle_async_request(request)


@pytest.mark.asyncio
async def test_real_sdk_cards_sse_ten_turns_and_direct_relay(tmp_path):
    apps = {9201 + i: create_app(agent, 9201 + i, MockModel(i)) for i, agent in enumerate(AGENTS)}
    pool = AgentPool({agent: f'http://127.0.0.1:{9201+i}/' for i, agent in enumerate(AGENTS)},
                     TraceLogger(tmp_path), 'sdk-test', bid_timeout_ms=2000)
    await pool.http.aclose()
    pool.http = httpx.AsyncClient(transport=AppTransport(apps), timeout=5)
    try:
        await pool.connect()
        topic = json.loads((ROOT / 'topics/topic_1.json').read_text())
        result = await discuss(pool, topic, turns=10)
        assert result['error'] is None, result
        assert result['turns_completed'] == 10 and len(result['speakers']) == 3
        assert result['challenge_bids_spoken'] > 0  # mocked intent; NOT live disagreement evidence
        events = [json.loads(line) for line in (tmp_path / 'sdk-test.jsonl').read_text().splitlines()]
        assert {'floor.utterance', 'floor.bid', 'floor.grant', 'agent.speech', 'agent.direct', 'agent.ack'} <= {e['type'] for e in events}
        assert all('<<<CLAIMS>>>' not in e['payload'].get('text', '') for e in events)
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_parallel_timeout_is_pass_not_fabricated_bid(tmp_path):
    pool = AgentPool({agent: 'unused' for agent in AGENTS}, TraceLogger(tmp_path), 'timeout', 30)
    active = 0
    maximum = 0
    async def slow(*args, **kwargs):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        try:
            async with asyncio.timeout(kwargs['timeout']):
                await asyncio.sleep(1)
        finally:
            active -= 1
    pool.call = slow
    try:
        bids = await pool.collect_bids(lambda agent: envelope('floor.utterance', 'timeout', 0,
            'organizer_prompt', agent, text='Question'))
        assert maximum == 3 and active == 0
        assert all(b.intent == 'pass' for b in bids.values())
        events = [json.loads(line) for line in (tmp_path / 'timeout.jsonl').read_text().splitlines()]
        assert all(e['type'] == 'bid_timeout' for e in events)
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_real_socket_timeout_cancels_agent_model_work(tmp_path):
    """Actual localhost JSON-RPC/SSE and task cancellation, mocked slow provider."""
    import socket
    import uvicorn
    canceled = asyncio.Event()
    class SlowModel(MockModel):
        async def complete(self, *args, **kwargs):
            try:
                await asyncio.sleep(20)
            except asyncio.CancelledError:
                canceled.set()
                raise
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    sock.listen()
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(AGENTS[0], port, SlowModel()),
        log_level='critical', access_log=False, lifespan='off', ws='none'))
    running = asyncio.create_task(server.serve(sockets=[sock]))
    pool = AgentPool({AGENTS[0]: f'http://127.0.0.1:{port}/'}, TraceLogger(tmp_path), 'cancel', 150)
    try:
        async with asyncio.timeout(5):
            while not server.started:
                await asyncio.sleep(.01)
        await pool.connect()
        bids = await pool.collect_bids(lambda agent: envelope('floor.utterance', 'cancel', 0,
            'organizer_prompt', agent, text='Question'))
        await asyncio.wait_for(canceled.wait(), 2)
        assert bids[AGENTS[0]].intent == 'pass'
        assert pool.bid_rounds[0]['agents'][0]['status'] == 'timeout'
    finally:
        await pool.close()
        server.should_exit = True
        await asyncio.wait_for(running, 5)
        sock.close()
