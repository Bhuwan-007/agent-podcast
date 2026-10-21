"""A3: real A2A discussion -> one configured ElevenLabs voice -> confirmed playback."""
import asyncio
import base64
import binascii
from contextlib import aclosing
import os
import time

import yaml

from agents.messages import AGENTS, envelope
from gateway.moderator import Moderator
from gateway.session import ROOT, VoiceSession, load_topic
from gateway.tracing import trace_logger
from gateway.router import route_question
from gateway.voice.stt import ElevenLabsSTT, STTError


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
        self.context_version = -1
        self.addressed = None
        self.max_turns = max_turns
        self.history = []
        self.microphone = bytearray()
        self.microphone_mime = 'audio/webm'
        self.audio_seq = -1
        self.mic_enabled = False
        self.stt = ElevenLabsSTT()

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
            if not self.topic:
                await self.notice('no_speech', 'Start the roundtable first.')
                return
            if event.get('final') is not True:
                return
            text = event.get('text')
            confidence = event.get('confidence')
            if (event.get('input_mode') not in ('voice', 'text') or not isinstance(text, str)
                    or not 1 <= len(text.strip()) <= 2000
                    or (type(confidence) in (int, float) and confidence < .5)):
                await self.notice('no_speech', 'No clear question was received. Please repeat or type it.')
                return
            self.capture_heard()
            await self.cancel_turn()
            self.worker = asyncio.create_task(self.answer(text.strip(), event.get('target_hint') or self.target,
                                                        event.get('utterance_id')))
        elif kind == 'address_agent':
            if event.get('agent_id') in (*AGENTS, None):
                self.target = event.get('agent_id')
            else:
                await self.notice('topic_unavailable', 'Choose an available Topic 1 expert.')
        elif kind == 'barge_in':
            if self.matches(event):
                old = self.active.copy()
                self.capture_heard()
                await self.cancel_turn()
                await self.emit('turn_end', turn_id=old['id'], epoch=old['epoch'], status='interrupted')
                await self.state('processing_user')
        elif kind == 'mic_state':
            self.mic_enabled = event.get('state') == 'on'
            if not self.mic_enabled:
                self.microphone.clear()
            if event.get('state') == 'denied':
                await self.notice('mic_denied', 'Microphone permission denied. Typed questions remain available.')
        elif kind == 'vad':
            if event.get('state') == 'start':
                self.microphone.clear()
                self.audio_seq = -1
            elif event.get('state') == 'end' and self.microphone:
                audio, mime = bytes(self.microphone), self.microphone_mime
                self.microphone.clear()
                self.capture_heard()
                await self.cancel_turn()
                self.worker = asyncio.create_task(self.transcribe_and_answer(audio, mime))
        elif kind == 'user_audio':
            if not self.mic_enabled:
                return
            try:
                seq = event.get('seq')
                if type(seq) is not int or seq <= self.audio_seq:
                    raise ValueError('Invalid audio sequence')
                data = base64.b64decode(event.get('chunk_b64', ''), validate=True)
                if len(self.microphone) + len(data) > 4_000_000:
                    raise ValueError('Audio buffer full')
                self.microphone.extend(data)
                self.microphone_mime = event.get('mime', 'audio/webm')
                self.audio_seq = seq
            except (ValueError, TypeError, binascii.Error):
                self.microphone.clear()
                await self.notice('no_speech', 'Microphone audio was invalid or too large. Please repeat.')
        elif kind == 'playback_progress' and self.matches(event):
            idx, played = event.get('sentence_idx'), event.get('played_ms')
            if type(idx) is int and type(played) in (int, float) and played >= 0:
                self.active['last_progress'] = (idx, played)
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
                bids = await self.broadcast(self.latest)
                winner, scores = self.moderator.choose(bids, addressed=self.addressed)
                if winner is None:
                    await self.notice('agent_timeout', 'No eligible expert bid arrived. Check the bid deadline, provider quota and expert availability.')
                    await self.state('recovery')
                    return
                await self.begin_turn(winner)
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
                self.latest = {'speaker': winner, 'text': ' '.join(sentences)}
                self.remember(self.latest | {'turn_id': self.turn_id})
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

    async def broadcast(self, utterance):
        self.context_version += 1
        return await self.pool.collect_bids(lambda agent: envelope('floor.utterance',
            self.session_id, self.context_version, utterance['speaker'], agent,
            text=utterance['text'], final=True, interrupted=utterance.get('interrupted', False)))

    def remember(self, turn):
        self.history.append(turn)
        self.history = self.history[-20:]

    def capture_heard(self):
        turn = self.active
        if not turn or not turn['played']:
            return
        # Only complete sentences are retained. The incomplete current sentence is
        # deliberately omitted rather than treating generated words as heard.
        indices = sorted(turn['played'])
        if not turn['finished'].is_set():
            indices = indices[:-1]
        text = ' '.join(turn['sentences'][idx] for idx in indices)
        if text:
            self.latest = {'speaker': self.persona['id'], 'text': text, 'interrupted': True}
            self.remember(self.latest | {'turn_id': turn['id']})

    async def transcribe_and_answer(self, audio, mime):
        await self.state('processing_user')
        try:
            text = await self.stt.transcribe(audio, mime)
        except STTError:
            await self.notice('no_speech', 'Speech recognition failed or was unclear. Please repeat or type your question.')
            return
        finally:
            audio = b''
        await self.answer(text, self.target)

    async def answer(self, text, hint=None, utterance_id=None):
        await self.state('processing_user')
        routing = route_question(text, self.topic['agents'], hint)
        await self.emit('routing', utterance_id=utterance_id, **routing)
        if routing['kind'] in ('unknown_target', 'unclear'):
            return
        if routing['kind'] == 'continue':
            await self.debate()
            return
        try:
            if self.latest:
                await self.broadcast(self.latest)
            await self.emit('transcript', turn_id=self.turn_id + 1, epoch=self.epoch,
                            speaker='human', text=text, final=True, sentence_idx=0)
            self.remember({'speaker': 'human', 'text': text, 'turn_id': self.turn_id + 1})
            bids = await self.broadcast({'speaker': 'human', 'text': text})
            winner = routing['target']
            if winner is None:
                winner, _ = self.moderator.choose(bids)
            if winner is None:
                await self.notice('agent_timeout', 'No expert was available to answer. Please retry.')
                return
            await self.begin_turn(winner, kind='human_reply')
            outputs = await self.pool.call(winner, envelope('human.question', self.session_id,
                self.context_version + 1, 'gateway', winner, text=text))
            sentences = self.speech(outputs)
            await self.play_turn(winner, sentences, kind='human_reply')
            self.moderator.record(winner)
            self.latest = {'speaker': winner, 'text': ' '.join(sentences)}
            self.remember(self.latest | {'turn_id': self.turn_id})
            await asyncio.gather(*(self.pool.call(agent, envelope('floor.resume', self.session_id,
                self.context_version, 'gateway', agent, human_exchange_summary=text[:300])) for agent in AGENTS))
            await self.debate()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.epoch += 1
            self.active = None
            await self.notice('agent_timeout', 'The question could not be completed. Check provider access and quota, then retry.')
            await self.state('recovery')

    @staticmethod
    def speech(outputs):
        speech = [e for e in outputs if e.type == 'agent.speech']
        if not speech or [e.payload.get('sentence_idx') for e in speech] != list(range(len(speech))):
            raise ValueError('Invalid expert sentence order')
        if not speech[-1].payload.get('final'):
            raise ValueError('Incomplete expert speech')
        return [e.payload['text'] for e in speech]

    async def begin_turn(self, speaker, kind='agent'):
        self.persona = self.personas[speaker]
        self.voice_id = self.voices[speaker]
        self.turn_id += 1
        self.active = {'id': self.turn_id, 'epoch': self.epoch, 'started_at': time.perf_counter(),
            'sentences': {}, 'audio_sent': set(), 'played': set(),
            'generated': False, 'finished': asyncio.Event()}
        await self.emit('turn_start', turn_id=self.turn_id, epoch=self.epoch, agent_id=speaker, kind=kind)
        await self.state('agent_generating')
    async def play_turn(self, speaker, sentences, kind='agent'):
        if not self.active:
            await self.begin_turn(speaker, kind)
        turn = self.active
        turn['sentences'] = dict(enumerate(sentences))
        started, first = turn['started_at'], True
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
