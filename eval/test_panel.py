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

    async def call(self, agent, event):
        self.calls.append(event)
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
