"""Connection-local episode control and bounded snapshots, without new WS events."""
import asyncio
import time
from collections import OrderedDict

from agents.messages import envelope
from gateway.evidence import SOURCES


class EpisodeStore:
    def __init__(self):
        self.sessions = OrderedDict()
        self.prepared = OrderedDict()

    def clean(self):
        now = time.monotonic()
        for key, session in list(self.sessions.items()):
            if not session.connected and now - session.detached_at > 60:
                del self.sessions[key]
        for key, value in list(self.prepared.items()):
            if now - value['created'] > 300:
                del self.prepared[key]

    def register(self, session):
        self.clean()
        if len(self.sessions) >= 64:
            # Never evict a running conversation to silently make space.
            removable = next((k for k, s in self.sessions.items() if not s.connected), None)
            if removable is None:
                raise ValueError('Too many active episodes')
            del self.sessions[removable]
        self.sessions[session.session_id] = session


class EpisodeMixin:
    def episode_init(self, options=None):
        self.options = options
        self.connected = True
        self.detached_at = 0
        self.paused = False
        self.introduced = False
        self.concluded = False
        self.closing = False
        self.episode_started = None
        self.paused_at = None
        self.paused_seconds = 0
        self.control_lock = asyncio.Lock()
        self.metrics = []
        self.pending_annotations = {}
        self.committed_turns = set()

    def elapsed(self):
        if self.episode_started is None:
            return 0
        end = self.paused_at if self.paused_at is not None else time.monotonic()
        return max(0, end - self.episode_started - self.paused_seconds)

    def episode_context(self):
        duration = (self.options or {}).get('duration_minutes', 3) * 60
        remaining = max(0, duration - self.elapsed())
        ratio = self.elapsed() / duration
        phase = ('closing' if self.closing else 'opening perspectives' if ratio < .2 else
                 'evidence and questions' if ratio < .5 else 'challenges and rebuttals' if ratio < .8 else 'synthesis')
        return {'phase': phase, 'remaining_seconds': round(remaining),
                'agenda': ['opening perspectives', 'evidence and questions', 'challenges and rebuttals', 'synthesis'],
                'instruction': 'Advance this phase dynamically. Do not manufacture disagreement or consensus.'}

    def report(self):
        ledger = self.ledger
        turns = ledger.turns if ledger else []
        return {'session_id': self.session_id, 'epoch': self.epoch, 'mode': 'live', 'connected': self.connected,
                'paused': self.paused, 'concluded': self.concluded, 'ended': self.ended,
                'topic': self.topic['title'] if self.topic else None,
                'elapsed_seconds': round(self.elapsed(), 1), 'episode': self.episode_context(),
                'turns': turns, 'claims': ledger.claims if ledger else [],
                'open_questions': [t for t in turns if '?' in t['text']][-10:],
                'sources': SOURCES, 'metrics': self.metrics[-100:],
                'limits': ['Only complete playback-confirmed sentences are committed; a cut-off sentence is omitted.',
                           'Source IDs are validated, but model citation entailment is not automatically certified.',
                           'No recorded audio export; no raw microphone audio is stored.',
                           'Extracted questions may already have been answered; unresolved status requires review.']}

    async def control(self, action):
        async with self.control_lock:
            if not self.topic or self.ended or not self.connected:
                raise ValueError('No connected running episode')
            if action == 'pause':
                if self.paused:
                    return
                self.capture_heard()
                await self.cancel_turn()
                self.paused = True
                self.paused_at = time.monotonic()
                await self.state('waiting_first_speaker')
                await self.trace('episode.paused', {'resume_requires_explicit_action': True})
            elif action == 'resume':
                if not self.paused or self.concluded:
                    return
                self.paused_seconds += time.monotonic() - self.paused_at
                self.paused_at = None
                self.paused = False
                self.worker = asyncio.create_task(self.debate())
            elif action == 'finish':
                if self.concluded:
                    return
                self.capture_heard()
                await self.cancel_turn()
                if self.paused_at is not None:
                    self.paused_seconds += time.monotonic() - self.paused_at
                self.paused_at = None
                self.paused = False
                self.worker = asyncio.create_task(self.close_episode())
            else:
                raise ValueError('Unknown episode control')

    async def introduce(self):
        self.introduced = True
        self.episode_started = time.monotonic()
        names = ', '.join(a['display_name'] for a in self.topic['agents'])
        # Navigation copy, not scripted debate content or a fabricated finding.
        await self.begin_turn('ai_engineer', 'agent')
        self.persona = self.persona | {'id': 'system'}
        text = f"Welcome to AI Roundtable with {names}. Our question is: {self.topic['title']} We will compare perspectives, inspect available evidence, challenge assumptions, and finish with takeaways; you can interrupt at any time."
        await self.play_turn('ai_engineer', [text])
        self.remember({'speaker': 'system', 'text': text, 'turn_id': self.turn_id})

    async def close_episode(self):
        if self.concluded or self.ended:
            return
        self.closing = True
        try:
            # Only committed delivered material is supplied for the closing synthesis.
            memory = self.shared_context('closing summary')
            memory['delivered_turns'] = self.ledger.turns
            memory['episode'] = self.episode_context()
            question = ('Close this episode from the delivered conversation only. State the central takeaway, '
                        'points of agreement only where explicit, remaining disagreements or uncertainty, '
                        'and one open question. Preserve any corrections. Separate proposals from established facts. '
                        'An agreed claim records a peer position, not unanimous agreement. '
                        'Silence is not agreement. Attribute only to experts with delivered turns; never name absent experts. '
                        'Scope any missing evidence to this conversation, not all research. '
                        'If little discussion was delivered, say so. Do not invent a consensus or evidence.')
            await self.begin_turn('ai_engineer', 'agent')
            outputs = await self.pool.call('ai_engineer', envelope('human.question', self.session_id,
                self.context_version + 1, 'gateway', 'ai_engineer', text=question, memory=memory, closing=True))
            sentences = self.speech(outputs)
            self.set_annotations(outputs)
            await self.play_turn('ai_engineer', sentences)
            self.remember({'speaker': 'ai_engineer', 'text': ' '.join(sentences),
                           'turn_id': self.turn_id, 'kind': 'closing_summary'})
            self.concluded = True
            self.paused = True
            self.paused_at = time.monotonic()
            await self.state('waiting_first_speaker')
            await self.trace('episode.concluded', {'delivered_turns': len(self.ledger.turns)})
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            from gateway.a2a_client import A2AError
            await self.trace('episode.closing_failed', {'reason': str(exc) if isinstance(exc, A2AError) else type(exc).__name__})
            self.capture_heard()
            self.epoch += 1
            self.active = None
            await self.notice('agent_timeout', 'Closing audio failed. The delivered transcript is preserved; retry Finish or download it.')
            await self.state('recovery')
        finally:
            self.closing = False

    def set_annotations(self, outputs):
        self.pending_annotations = {e.payload['sentence_idx']: e.payload.get('annotation', {})
                                    for e in outputs if e.type == 'agent.speech'}

    def commit_annotations(self, speaker, indices):
        return {str(i): self.pending_annotations[i] for i in indices if self.pending_annotations.get(i)}
