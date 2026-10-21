"""A2 text-only real A2A roundtable. Starts three independent localhost processes."""
import argparse
import asyncio
from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time
import uuid

from dotenv import load_dotenv

from agents.messages import AGENTS, envelope
from gateway.a2a_client import A2AError, AgentPool
from gateway.moderator import Moderator
from gateway.tracing import TraceLogger

ROOT = Path(__file__).resolve().parents[1]


async def discuss(pool, topic, turns=10, opening=None, seed=0, on_turn=None, turn_delay_s=0):
    moderator = Moderator(seed)
    latest = {'speaker': 'organizer_prompt', 'text': opening or topic['opening_prompt'], 'turn_id': 0}
    addressed = None
    transcript, error = [], None
    for turn_id in range(1, turns + 1):
        if turn_id > 1 and turn_delay_s:
            await asyncio.sleep(turn_delay_s)
        bids = await pool.collect_bids(lambda agent: envelope('floor.utterance', pool.session_id,
            latest['turn_id'], latest['speaker'], agent, text=latest['text'], final=True, interrupted=False))
        winner, scores = moderator.choose(bids, addressed=addressed)
        if winner is None:
            error = 'No eligible bids; discussion stopped rather than inventing a speaker'
            break
        begin = time.perf_counter()
        grant = envelope('floor.grant', pool.session_id, turn_id, 'gateway', winner,
                         reason='highest deterministic score', context_version=latest['turn_id'])
        try:
            outputs = await pool.call(winner, grant)
            speech = [e for e in outputs if e.type == 'agent.speech']
            indices = [e.payload.get('sentence_idx') for e in speech]
            if not speech or indices != list(range(len(speech))) or not speech[-1].payload.get('final'):
                raise A2AError('Missing or unordered speech')
            if any(e.to != 'gateway' or not isinstance(e.payload.get('text'), str) for e in speech):
                raise A2AError('Invalid speech recipient or text')
            text = ' '.join(e.payload['text'] for e in speech)
            direct = [e for e in outputs if e.type == 'agent.direct']
            if len(direct) > 1 or any(e.to == winner or e.to not in AGENTS for e in direct):
                raise A2AError('Invalid direct message')
            addressed = None
            for event in direct:
                replies = await pool.call(event.to, event)
                if len(replies) != 1 or replies[0].type != 'agent.ack':
                    raise A2AError('Direct message not acknowledged')
                addressed = event.to
        except Exception as exc:
            reason = str(exc) if isinstance(exc, A2AError) else type(exc).__name__
            await pool.logger.log_event(pool.session_id, turn_id, 'gateway', winner,
                'agent_error', {'reason': reason}, session_id=pool.session_id)
            error = f'Granted expert or direct-message delivery failed ({reason})'
            break
        moderator.record(winner)
        entry = {'turn_id': turn_id, 'speaker': winner, 'text': text,
            'intent': bids[winner].intent, 'target': bids[winner].target,
            'preview': bids[winner].preview, 'scores': scores,
            'grant_to_complete_ms': round((time.perf_counter() - begin) * 1000, 1)}
        transcript.append(entry)
        latest = entry
        if on_turn:
            on_turn(entry)
    return {'transcript': transcript, 'error': error,
            'turns_completed': len(transcript), 'speakers': dict(Counter(moderator.speakers)),
            'challenge_bids_spoken': sum(t['intent'] == 'challenge' for t in transcript),
            'bid_rounds': pool.bid_rounds,
            'bid_round_median_ms': round(statistics.median(r['elapsed_ms'] for r in pool.bid_rounds), 1)
                                   if pool.bid_rounds else None,
            'semantic_quality': 'Requires human review; challenge intent alone is not proof of disagreement'}


async def run(args):
    load_dotenv(args.env_file, override=True)
    if args.bid_model:
        os.environ['LLM_MODEL_BID'] = args.bid_model
    if args.speak_model:
        os.environ['LLM_MODEL_SPEAK'] = args.speak_model
    timeout = args.bid_timeout_ms or int(os.getenv('BID_TIMEOUT_MS', '400'))
    if (timeout < 1 or not 1 <= args.turns <= 100 or not 1 <= args.base_port <= 65533
            or not 0 <= args.turn_delay_s <= 60):
        raise ValueError('Invalid deadline, turn count, port range or pacing')
    session = uuid.uuid4().hex
    urls = {agent: f'http://127.0.0.1:{args.base_port + i}/' for i, agent in enumerate(AGENTS)}
    children = []
    pool = AgentPool(urls, TraceLogger(ROOT / 'logs/traces'), session, timeout)
    try:
        if not args.external:
            # Abort if any port is occupied; never attach to/terminate a teammate's process.
            import socket
            reservations = []
            try:
                for i in range(3):
                    sock = socket.socket()
                    reservations.append(sock)
                    sock.bind(('127.0.0.1', args.base_port + i))
            finally:
                for sock in reservations:
                    sock.close()
            for i, agent in enumerate(AGENTS):
                command = [sys.executable, '-B', '-m', 'agents.agent_server', '--agent', agent,
                           '--port', str(args.base_port + i), '--env-file', str(args.env_file.resolve())]
                if args.bid_model:
                    command += ['--bid-model', args.bid_model]
                if args.speak_model:
                    command += ['--speak-model', args.speak_model]
                children.append(subprocess.Popen(command, cwd=ROOT, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)))
        for attempt in range(80):
            try:
                await pool.connect()
                break
            except Exception:
                if any(p.poll() is not None for p in children):
                    raise A2AError('An expert process exited during startup') from None
                if attempt == 79:
                    raise A2AError('Agent discovery timed out') from None
                await asyncio.sleep(0.1)
        topic = json.loads((ROOT / 'topics/topic_1.json').read_text(encoding='utf-8'))
        print(f'A2 real A2A text discussion; bid timeout {timeout} ms; session {session}', flush=True)
        print(f"Speech model: {os.getenv('LLM_MODEL_SPEAK')}; bid model: "
              f"{os.getenv('LLM_MODEL_BID') or os.getenv('LLM_MODEL_SPEAK')}"
              ' (no voice or browser acceptance in this check)', flush=True)
        def display(turn):
            print(f"{turn['turn_id']:02d} {turn['speaker']} [{turn['intent']}] {turn['text']}", flush=True)
        report = await discuss(pool, topic, turns=args.turns, opening=args.topic, seed=args.seed,
                               on_turn=display, turn_delay_s=args.turn_delay_s)
        report.update({'recorded_at': datetime.now(timezone.utc).isoformat(), 'mode': 'live',
            'session_id': session, 'protocol': 'A2A 0.3.0 / SDK 0.3.26 / JSON-RPC + SSE',
            'speech_model': os.getenv('LLM_MODEL_SPEAK'),
            'speech_model_source': 'CLI override' if args.speak_model else 'LLM_MODEL_SPEAK',
            'bid_model': os.getenv('LLM_MODEL_BID') or os.getenv('LLM_MODEL_SPEAK'),
            'bid_model_source': 'CLI override' if args.bid_model else (
                'LLM_MODEL_BID' if os.getenv('LLM_MODEL_BID') else 'explicitly reported speech-model fallback'),
            'bid_timeout_ms': timeout, 'requested_turns': args.turns,
            'diagnostic_turn_delay_s': args.turn_delay_s,
            'trace_path': f'logs/traces/{session}.jsonl',
            'functional_transport_pass': report['turns_completed'] == args.turns and len(report['speakers']) == 3})
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f"Completed {report['turns_completed']}/{args.turns}; speakers {report['speakers']}; "
              f"median bid round {report['bid_round_median_ms']} ms", flush=True)
        if report['error']:
            print(report['error'], flush=True)
        return 0 if report['functional_transport_pass'] else 1
    finally:
        await pool.close()
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('topic', nargs='?', help='Optional unscripted opening; otherwise exact Topic 1 prompt')
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env')
    parser.add_argument('--turns', type=int, default=10)
    parser.add_argument('--bid-model', help='Explicit model override; does not edit .env')
    parser.add_argument('--speak-model', help='Explicit model override; does not edit .env')
    parser.add_argument('--bid-timeout-ms', type=int, help='Explicit diagnostic override; default env or 400')
    parser.add_argument('--base-port', type=int, default=9101)
    parser.add_argument('--seed', type=int, default=0)
    parser.add_argument('--turn-delay-s', type=float, default=0,
                        help='Explicit pacing for provider quota; reported separately from latency')
    parser.add_argument('--external', action='store_true', help='Use already running agent services')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        code = asyncio.run(run(args))
    except (KeyboardInterrupt, Exception):
        print('A2 run could not complete; check local dependencies, configuration and agent ports.')
        code = 1
    raise SystemExit(code)


if __name__ == '__main__':
    main()
