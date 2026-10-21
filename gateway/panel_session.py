"""A3: real A2A discussion -> one configured ElevenLabs voice -> confirmed playback."""
import asyncio
import base64
from contextlib import aclosing
import os
import time

import yaml

from agents.messages import AGENTS, envelope
from gateway.moderator import Moderator
from gateway.session import ROOT, VoiceSession, load_topic
from gateway.tracing import trace_logger


class PublicTrace:
    def __init__(self, session):
        self.session = session

    async def log_event(self, *args, **kwargs):
        result = await trace_logger.log_event(*args, **kwargs)
        if not self.session.ended:
            payload = result['payload']
            summary = payload.get('preview') or result['type']
            await self.session.emit('trace_event', ts=result['ts'], **{
                'from': result['from'], 'to': result['to'], 'msg_type': result['type'],
                'summary': str(summary)[:160]})
        return result


class PanelSession(VoiceSession):
    def __init__(self, socket, services_factory, max_turns=20):
        super().__init__(socket, services_factory)
        self.pool = None
        self.moderator = Moderator()
        self.latest = None
        self.context_version = 0
        self.addressed = None
        self.max_turns = max_turns
        self.history = []

    async def run(self):
        try:
            await super().run()
        finally:
            if self.pool:
                await self.pool.close()

    async def handle(self, event):
        kind = event['type']
        if kind == 'start_session':
            if self.topic:
                await self.notice('collision', 'End the existing session before starting another.')
                return
            try:
                topic, _ = load_topic(event.get('topic_id'))
                personas = {agent: yaml.safe_load((ROOT / f'agents/personas/topic_1/{agent}.yaml').read_text(encoding='utf-8'))
                            for agent in AGENTS}
                voices = {agent: os.getenv(persona['voice_id_env'], '').strip()
                          for agent, persona in personas.items()}
                if not all(voices.values()) or len(set(voices.values())) != 3:
                    raise ValueError('Three distinct configured voices required')
                self.pool, self.tts = await self.services_factory(self.session_id, PublicTrace(self))
            except Exception:
                await self.notice('topic_unavailable', 'Panel startup failed. Check Topic 1, three distinct voice IDs, model configuration and expert ports.')
                await self.state('recovery')
                return
            self.topic, self.personas, self.voices = topic, personas, voices
            self.latest = {'speaker': 'organizer_prompt', 'text': topic['opening_prompt']}
            await self.state('connecting')
            await self.emit('topic_config', **{k: topic[k] for k in
                ('topic_id', 'title', 'background', 'opening_prompt')},
                agents=[{k: a[k] for k in ('agent_id', 'display_name', 'role', 'voice_label', 'aliases', 'available')}
                        for a in topic['agents']])
            await self.state('waiting_first_speaker')
            for metric in ('interrupt_to_silence_ms', 'user_question_to_first_audio_ms', 'grant_to_first_audio_ms'):
                await self.emit('metrics', name=metric, value=None, available=False)
            self.worker = asyncio.create_task(self.debate())
        elif kind == 'user_utterance':
            await self.notice('no_speech', 'A3 panel questions are not enabled yet. Use End to stop the discussion.')
        elif kind == 'address_agent':
            if event.get('agent_id') in (*AGENTS, None):
                self.target = event.get('agent_id')
            else:
                await self.notice('topic_unavailable', 'Choose an available Topic 1 expert.')
        elif kind == 'barge_in':
            if self.matches(event):
                old = self.active.copy()
                await self.cancel_turn()
                await self.emit('turn_end', turn_id=old['id'], epoch=old['epoch'], status='interrupted')
                await self.state('processing_user')
                await self.notice('no_speech', 'Speech cancelled. Human question routing is not enabled in this A3 increment.')
        elif kind == 'metrics':
            # Timing values remain client observations, never server estimates.
            if event.get('name') in ('interrupt_to_silence_ms', 'user_question_to_first_audio_ms', 'grant_to_first_audio_ms'):
                value = event.get('value')
                if event.get('available') is True and type(value) in (int, float) and 0 <= value < 300000:
                    await self.trace('client.metric', {'name': event['name'], 'value': value})
        else:
            await super().handle(event)

    async def debate(self):
        try:
            for _ in range(self.max_turns):
                await self.state('waiting_first_speaker')
                bids = await self.pool.collect_bids(lambda agent: envelope('floor.utterance',
                    self.session_id, self.context_version, self.latest['speaker'], agent,
                    text=self.latest['text'], final=True, interrupted=False))
                winner, scores = self.moderator.choose(bids, addressed=self.addressed)
                if winner is None:
                    await self.notice('agent_timeout', 'No eligible expert bid arrived. Check the bid deadline, provider quota and expert availability.')
                    await self.state('recovery')
                    return
                outputs = await self.pool.call(winner, envelope('floor.grant', self.session_id,
                    self.context_version + 1, 'gateway', winner,
                    context_version=self.context_version, reason='highest deterministic score'))
                sentences = self.speech(outputs)
                self.addressed = None
                for direct in (output for output in outputs if output.type == 'agent.direct'):
                    await self.pool.call(direct.to, direct)
                    self.addressed = direct.to
                await self.play_turn(winner, sentences)
                self.moderator.record(winner)
                self.context_version += 1
                self.latest = {'speaker': winner, 'text': ' '.join(sentences)}
                self.history.append(self.latest | {'turn_id': self.turn_id})
            await self.notice('agent_timeout', 'Development session turn limit reached. End and start a fresh session.')
            await self.state('waiting_first_speaker')
        except asyncio.CancelledError:
            raise
        except Exception:
            turn = self.active
            self.epoch += 1
            self.active = None
            if turn and not turn['generated']:
                await self.emit('turn_end', turn_id=turn['id'], epoch=turn['epoch'], status='failed')
            await self.notice('tts_failed' if turn else 'agent_timeout',
                'The live turn failed. Check provider access, quota and playback acknowledgement; no successful audio is assumed.')
            await self.state('recovery')

    @staticmethod
    def speech(outputs):
        speech = [e for e in outputs if e.type == 'agent.speech']
        if not speech or [e.payload.get('sentence_idx') for e in speech] != list(range(len(speech))):
            raise ValueError('Invalid expert sentence order')
        if not speech[-1].payload.get('final'):
            raise ValueError('Incomplete expert speech')
        return [e.payload['text'] for e in speech]

    async def play_turn(self, speaker, sentences, kind='agent'):
        self.persona = self.personas[speaker]
        self.voice_id = self.voices[speaker]
        self.turn_id += 1
        turn = self.active = {'id': self.turn_id, 'epoch': self.epoch,
            'sentences': dict(enumerate(sentences)), 'audio_sent': set(), 'played': set(),
            'generated': False, 'finished': asyncio.Event()}
        await self.emit('turn_start', turn_id=self.turn_id, epoch=self.epoch, agent_id=speaker, kind=kind)
        await self.state('agent_generating')
        started, first = time.perf_counter(), True
        async with asyncio.timeout(90):
            for idx, sentence in enumerate(sentences):
                await self.emit('transcript', turn_id=self.turn_id, epoch=self.epoch,
                    speaker=speaker, text=sentence, final=False, sentence_idx=idx)
                async def chunks():
                    yield sentence + ' '
                async with aclosing(self.tts.stream(chunks(), self.voice_id)) as audio:
                    async for data in audio:
                        if self.ended or self.active is not turn:
                            return
                        if first:
                            await self.trace('panel.first_audio_received', {
                                'turn_to_first_audio_received_ms': round((time.perf_counter()-started)*1000, 1),
                                'audible_latency': 'unavailable'})
                            first = False
                        self.sequence += 1
                        turn['audio_sent'].add(idx)
                        await self.emit('audio_chunk', turn_id=self.turn_id, epoch=self.epoch,
                            sentence_idx=idx, seq=self.sequence, mime='audio/mpeg',
                            data_b64=base64.b64encode(data).decode('ascii'))
            turn['generated'] = True
            await self.emit('turn_end', turn_id=self.turn_id, epoch=self.epoch, status='completed')
        await asyncio.wait_for(turn['finished'].wait(), 90)
        self.active = None
