"""One independently running A2A expert service; bind localhost, not public internet."""
import argparse
import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path

from a2a.server.agent_execution import AgentExecutor
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCard, AgentCapabilities, AgentSkill, DataPart, Part
from a2a.utils import new_agent_parts_message
from dotenv import load_dotenv
import uvicorn
import yaml
from pydantic import ValidationError

from agents.base_agent import ExpertAgent
from agents.llm import AgentError
from agents.messages import AGENTS, Envelope
from agents.model import ChatModel

ROOT = Path(__file__).resolve().parents[1]


class ExpertExecutor(AgentExecutor):
    def __init__(self, expert):
        self.expert = expert
        self.running = {}

    async def execute(self, context, event_queue):
        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        self.running[context.task_id] = asyncio.current_task()
        await updater.start_work()
        try:
            parts = [p.root for p in context.message.parts if isinstance(p.root, DataPart)]
            if len(parts) != 1:
                raise ValueError('Exactly one data part required')
            request = Envelope.model_validate(parts[0].data)
            if context.context_id != request.trace_id:
                raise ValueError('Context does not match trace')
            if getattr(self.expert, 'chaos', None) == 'stall':
                await asyncio.sleep(60)
            if getattr(self.expert, 'chaos', None) == 'error':
                raise AgentError('Demo injected expert failure')
            outputs = await self.expert.handle(request)
            # Model output is validated before emission. This is sentence SSE,
            # not token pipelining; each sentence is a distinct A2A artifact.
            for output in outputs:
                await updater.add_artifact([Part(root=DataPart(data=output.wire()))],
                                           name=output.type, last_chunk=True)
            await updater.complete()
        except asyncio.CancelledError:
            await updater.cancel()
            raise
        except Exception as exc:
            # Never let SDK exception logging include raw provider responses.
            await updater.failed(new_agent_parts_message([Part(root=DataPart(
                data={'error': str(exc) if isinstance(exc, AgentError) else 'Invalid expert payload',
                      'error_kind': type(exc).__name__,
                      'invalid_fields': [str(e['loc'][0]) for e in exc.errors(include_input=False)
                                         if e['loc']] if isinstance(exc, ValidationError) else []}))],
                context_id=context.context_id, task_id=context.task_id))
        finally:
            self.running.pop(context.task_id, None)

    async def cancel(self, context, event_queue):
        task = self.running.get(context.task_id)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        else:
            await TaskUpdater(event_queue, context.task_id, context.context_id).cancel()


def create_app(agent_id, port, model=None):
    if agent_id not in AGENTS:
        raise ValueError('Unknown agent')
    topic = json.loads((ROOT / 'topics/topic_1.json').read_text(encoding='utf-8'))
    persona = yaml.safe_load((ROOT / f'agents/personas/topic_1/{agent_id}.yaml').read_text(encoding='utf-8'))
    model = model or ChatModel()
    expert = ExpertAgent(persona, topic, model)
    card = AgentCard(name=persona['display_name'], description=persona['role'],
        url=f'http://127.0.0.1:{port}/', version='0.2.0', protocol_version='0.3.0',
        capabilities=AgentCapabilities(streaming=True),
        default_input_modes=['application/json'], default_output_modes=['application/json'],
        skills=[AgentSkill(id=skill, name=skill, description=description, tags=['roundtable'])
                for skill, description in (
                    ('bid', 'Decide whether to contribute after an utterance'),
                    ('speak', 'Respond to a granted floor with public speech'),
                    ('react', 'Receive an expert direct message'),
                    ('respond_to_human', 'Answer a supplied human question'))])

    @asynccontextmanager
    async def lifespan(app):
        yield
        await model.close()

    handler = DefaultRequestHandler(agent_executor=ExpertExecutor(expert), task_store=InMemoryTaskStore())
    app = A2AStarletteApplication(card, handler).build(lifespan=lifespan)
    from starlette.routing import Route
    from starlette.responses import JSONResponse
    async def chaos(request):
        if (os.getenv('ENABLE_CHAOS') != '1' or request.headers.get('x-demo-chaos') != '1'
                or request.client.host not in ('127.0.0.1', '::1', 'testclient')):
            return JSONResponse({'error': 'disabled'}, status_code=403)
        action = (await request.json()).get('action')
        if action not in ('stall', 'error', 'reset'):
            return JSONResponse({'error': 'invalid action'}, status_code=400)
        expert.chaos = None if action == 'reset' else action
        return JSONResponse({'status': 'set', 'action': action})
    app.routes.append(Route('/admin/chaos', chaos, methods=['POST']))
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--agent', choices=AGENTS, required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env')
    parser.add_argument('--bid-model', help='Explicit override for this process only')
    parser.add_argument('--speak-model', help='Explicit override for this process only')
    args = parser.parse_args()
    load_dotenv(args.env_file, override=True)
    if args.bid_model:
        import os
        os.environ['LLM_MODEL_BID'] = args.bid_model
    if args.speak_model:
        import os
        os.environ['LLM_MODEL_SPEAK'] = args.speak_model
    uvicorn.run(create_app(args.agent, args.port), host='127.0.0.1', port=args.port,
                log_level='warning', access_log=False)


if __name__ == '__main__':
    main()
