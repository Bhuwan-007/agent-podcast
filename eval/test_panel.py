"""Real panel session logic with MOCK-TEST A2A/model/audio transports."""
import asyncio

import pytest

from agents.messages import AGENTS, Bid, envelope
from gateway.panel_session import PanelSession
from eval.test_session import Socket


class Pool:
    def __init__(self):
        self.calls = []
        self.closed = False

    async def collect_bids(self, factory):
        self.calls.extend(factory(agent) for agent in AGENTS)
        return {agent: Bid(intent='build', urgency=.5, novelty=.5, preview='Test point') for agent in AGENTS}

    async def call(self, agent, event, **kwargs):
        self.calls.append(event)
        if event.type in ('floor.resume', 'agent.direct'):
            return [envelope('agent.ack', event.trace_id, event.turn_id, agent, event.sender, received=event.type)]
        return [envelope('agent.speech', event.trace_id, event.turn_id, agent, 'gateway',
                         text='MOCK test contribution.', sentence_idx=0, final=True)]

    async def close(self):
        self.closed = True


class Audio:
    def __init__(self):
        self.voices = []
        self.cleaned = False

    async def stream(self, chunks, voice):
        self.voices.append(voice)
        try:
            async for _ in chunks:
                yield b'MOCK-TEST audio'
        finally:
            self.cleaned = True


@pytest.fixture
def configured(monkeypatch):
    for i in (1, 2, 3):
        monkeypatch.setenv(f'VOICE_ID_AGENT{i}', f'MOCK-VOICE-{i}')


@pytest.mark.asyncio
async def test_three_voices_wait_for_real_client_ack_before_next_grant(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory, max_turns=3)
    try:
        await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
        speakers = []
        for number in range(1, 4):
            start = await socket.until('turn_start')
            speakers.append(start['agent_id'])
            end = await socket.until('turn_end')
            assert end['turn_id'] == number
            assert not any(e['type'] == 'turn_start' and e['turn_id'] > number for e in socket.events)
            await session.handle({'type': 'playback_started', 'turn_id': number, 'epoch': 0, 'sentence_idx': 0})
            await session.handle({'type': 'playback_stopped', 'turn_id': number, 'epoch': 0, 'reason': 'finished'})
        await asyncio.wait_for(session.worker, 2)
        assert set(speakers) == set(AGENTS)
        assert len(set(audio.voices)) == 3
        assert len(session.history) == 3
        assert sum(e['type'] == 'transcript' and e['final'] for e in socket.events) == 3
    finally:
        await session.cancel_turn()


@pytest.mark.asyncio
async def test_end_cancels_panel_and_no_post_end_audio(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    chunk = await socket.until('audio_chunk')
    await session.handle({'type': 'end_session'})
    assert socket.closed and session.ended and session.epoch > chunk['epoch']
    assert socket.events[-1]['state'] == 'ended'
    assert audio.cleaned


@pytest.mark.asyncio
async def test_missing_or_duplicate_voice_configuration_fails_honestly(configured, monkeypatch):
    monkeypatch.setenv('VOICE_ID_AGENT2', 'MOCK-VOICE-1')
    socket = Socket()
    async def unused(*args): raise AssertionError('must not start services')
    session = PanelSession(socket, unused)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    assert session.topic is None
    assert socket.events[-1]['state'] == 'recovery'


@pytest.mark.parametrize('text,hint,kind,target', [
    ('Sam, how would we test it?', None, 'targeted', 'software_developer'),
    ('Maya, is this safe?', None, 'targeted', 'oss_maintainer'),
    ('Taylor, can you explain?', None, 'unknown_target', None),
    ('Alex and Sam, explain.', None, 'unknown_target', None),
    ('continue', None, 'continue', None),
    ('switch to healthcare', None, 'topic_shift', None),
    ('What is the trade-off?', None, 'general', None),
    ('What did Maya say?', 'software_developer', 'targeted', 'software_developer'),
    ('Please explain', 'unknown', 'unknown_target', None),
])
def test_conservative_routing(text, hint, kind, target):
    from gateway.router import route_question
    from gateway.session import load_topic
    topic, _ = load_topic('topic_1')
    result = route_question(text, topic['agents'], hint)
    assert result['kind'] == kind and result['target'] == target


@pytest.mark.asyncio
async def test_typed_target_reply_and_real_resume_messages(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory, max_turns=1)
    try:
        await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
        await session.cancel_turn()
        await session.handle({'type': 'user_utterance', 'input_mode': 'text', 'final': True,
                              'text': 'Maya, how do we check dependencies?'})
        start = await socket.until('turn_start')
        assert start['agent_id'] == 'oss_maintainer' and start['kind'] == 'human_reply'
        await socket.until('turn_end')
        await session.handle({'type': 'playback_started', 'turn_id': start['turn_id'],
                              'epoch': start['epoch'], 'sentence_idx': 0})
        await session.handle({'type': 'playback_stopped', 'turn_id': start['turn_id'],
                              'epoch': start['epoch'], 'reason': 'finished'})
        await socket.until('turn_start')
        assert sum(e.type == 'floor.resume' for e in pool.calls) == 3
        assert any(e.type == 'human.question' and e.to == 'oss_maintainer' for e in pool.calls)
    finally:
        await session.cancel_turn()


@pytest.mark.asyncio
async def test_barge_in_keeps_only_confirmed_complete_sentences(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await session.cancel_turn()
    await session.begin_turn('ai_engineer')
    session.active['sentences'] = {0: 'Actually finished.', 1: 'Still being played.'}
    session.active['played'] = {0, 1}
    old = session.active.copy()
    await session.handle({'type': 'barge_in', 'turn_id': old['id'], 'epoch': old['epoch']})
    assert session.active is None and session.epoch > old['epoch']
    assert session.latest['text'] == 'Actually finished.'
    before = len(socket.events)
    await session.handle({'type': 'playback_started', 'turn_id': old['id'], 'epoch': old['epoch'], 'sentence_idx': 1})
    assert len(socket.events) == before


@pytest.mark.asyncio
async def test_unknown_target_does_not_generate_reply_and_audio_is_bounded(configured):
    socket, pool, audio = Socket(), Pool(), Audio()
    async def factory(*args): return pool, audio
    session = PanelSession(socket, factory)
    await session.handle({'type': 'start_session', 'topic_id': 'topic_1'})
    await session.cancel_turn()
    await session.handle({'type': 'user_utterance', 'input_mode': 'text', 'final': True, 'text': 'Taylor, can you explain?'})
    await asyncio.wait_for(session.worker, 2)
    assert not any(e.type == 'human.question' for e in pool.calls)
    assert any(e['type'] == 'routing' and e['kind'] == 'unknown_target' for e in socket.events)
    await session.handle({'type': 'mic_state', 'state': 'on'})
    await session.handle({'type': 'user_audio', 'seq': 1, 'chunk_b64': 'not base64'})
    assert not session.microphone
