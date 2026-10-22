"""Parallel A2A SDK transport with bounded bids and real wire-message tracing."""
import asyncio
from contextlib import aclosing
import time
import uuid

from a2a.client import ClientConfig, ClientFactory
from a2a.types import (AgentCard, DataPart, Message, Part, Role, TaskArtifactUpdateEvent,
                       TaskIdParams, TaskState)
import httpx

from agents.messages import Bid, Envelope


class A2AError(RuntimeError):
    pass


class AgentPool:
    def __init__(self, urls, logger, session_id, bid_timeout_ms=400):
        self.urls, self.logger, self.session_id = urls, logger, session_id
        self.bid_timeout_ms = bid_timeout_ms
        self.http = httpx.AsyncClient(timeout=30, trust_env=False)
        self.clients = {}
        self.bid_rounds = []
        self.unavailable = set()
        self.health_task = None

    async def close(self):
        if self.health_task:
            self.health_task.cancel()
            await asyncio.gather(self.health_task, return_exceptions=True)
        await self.http.aclose()

    def start_health(self):
        async def monitor():
            while True:
                async def check(agent, url):
                    try:
                        response = await self.http.get(url.rstrip('/') + '/.well-known/agent-card.json', timeout=.8)
                        if response.status_code == 200:
                            self.unavailable.discard(agent)
                            return
                    except Exception:
                        pass
                    self.unavailable.add(agent)
                await asyncio.gather(*(check(a, u) for a, u in self.urls.items()))
                await asyncio.sleep(3)
        self.health_task = asyncio.create_task(monitor())

    async def connect(self):
        async def one(agent, url):
            response = await self.http.get(url.rstrip('/') + '/.well-known/agent-card.json')
            response.raise_for_status()
            card = AgentCard.model_validate(response.json())
            if card.url.rstrip('/') != url.rstrip('/') or not card.capabilities.streaming:
                raise A2AError('Agent card endpoint or streaming capability mismatch')
            self.clients[agent] = ClientFactory(ClientConfig(httpx_client=self.http,
                streaming=True, accepted_output_modes=['application/json'])).create(card)
        await asyncio.gather(*(one(agent, url) for agent, url in self.urls.items()))

    async def log(self, event):
        await self.logger.log_event(event.trace_id, event.turn_id, event.sender,
            event.to, event.type, event.payload, session_id=self.session_id, ts=event.ts)

    async def call(self, agent, event, timeout=28):
        await self.log(event)
        task_id = None
        outputs = []
        completed = False
        client = self.clients[agent]
        message = Message(message_id=uuid.uuid4().hex, role=Role.user,
            context_id=event.trace_id, parts=[Part(root=DataPart(data=event.wire()))])
        try:
            async with asyncio.timeout(timeout), aclosing(client.send_message(message)) as stream:
                async for item in stream:
                    if isinstance(item, Message):
                        raise A2AError('Expected task artifacts')
                    task, update = item
                    task_id = task.id
                    if isinstance(update, TaskArtifactUpdateEvent):
                        for part in update.artifact.parts:
                            if not isinstance(part.root, DataPart):
                                raise A2AError('Expected a structured data part')
                            output = Envelope.model_validate(part.root.data)
                            if (output.sender != agent or output.trace_id != event.trace_id
                                    or output.turn_id != event.turn_id):
                                raise A2AError('Mismatched agent reply')
                            if output.to not in ('gateway', *self.urls):
                                raise A2AError('Unknown reply recipient')
                            await self.log(output)
                            outputs.append(output)
                    if task.status.state in (TaskState.failed, TaskState.canceled, TaskState.rejected):
                        # Accept only known diagnostic categories, never arbitrary server text.
                        reason = 'expert_failed'
                        if task.status.message:
                            for p in task.status.message.parts:
                                if isinstance(p.root, DataPart):
                                    detail = p.root.data.get('error', '')
                                    if detail.startswith('Model service returned HTTP ') and detail[-3:].isdigit():
                                        reason = 'model_http_' + detail[-3:]
                                    elif p.root.data.get('error_kind') == 'ValidationError':
                                        fields = [f for f in p.root.data.get('invalid_fields', []) if f in Bid.model_fields]
                                        reason = 'invalid_model_bid:' + ','.join(fields)
                        raise A2AError(reason)
                    if task.status.state == TaskState.completed:
                        if not outputs:
                            raise A2AError('Expert returned no output')
                        completed = True
                if completed:
                    return outputs
            raise A2AError('Expert stream ended without completion')
        except BaseException:
            # Explicit A2A cancellation stops the agent's provider call as well.
            # A disconnected SSE reader alone need not cancel work on the server.
            if task_id:
                try:
                    async with asyncio.timeout(1):
                        await client.cancel_task(TaskIdParams(id=task_id))
                except Exception:
                    pass
            raise

    async def collect_bids(self, make_event):
        started = time.perf_counter()
        async def one(agent):
            begin = time.perf_counter()
            event = make_event(agent)
            if agent in self.unavailable:
                return agent, Bid(intent='pass', urgency=0, novelty=0, preview='Unavailable'), {
                    'agent': agent, 'status': 'health_down', 'elapsed_ms': 0.0}
            try:
                outputs = await self.call(agent, event, timeout=self.bid_timeout_ms / 1000)
                if len(outputs) != 1 or outputs[0].type != 'floor.bid' or outputs[0].to != 'gateway':
                    raise A2AError('Expected one bid')
                bid = Bid.model_validate(outputs[0].payload)
                return agent, bid, {'agent': agent, 'status': 'received',
                    'cache_hit': outputs[0].cache_hit,
                    'elapsed_ms': round((time.perf_counter() - begin) * 1000, 1)}
            except Exception as exc:
                status = 'timeout' if isinstance(exc, TimeoutError) else 'error'
                await self.logger.log_event(event.trace_id, event.turn_id, 'gateway', agent,
                    f'bid_{status}', {'treated_as': 'pass',
                        'reason': str(exc) if isinstance(exc, A2AError) else type(exc).__name__},
                        session_id=self.session_id)
                return agent, Bid(intent='pass', urgency=0, novelty=0, preview='Unavailable'), {
                    'agent': agent, 'status': status,
                    'reason': str(exc) if isinstance(exc, A2AError) else type(exc).__name__,
                    'elapsed_ms': round((time.perf_counter() - begin) * 1000, 1)}
        replies = await asyncio.gather(*(one(agent) for agent in self.urls))
        self.bid_rounds.append({'elapsed_ms': round((time.perf_counter() - started) * 1000, 1),
                                'agents': [item[2] for item in replies]})
        return {agent: bid for agent, bid, _ in replies}
