"""Explicit live panel launcher; never edits or copies the environment file."""
import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
import uvicorn


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--bid-timeout-ms', type=int)
    parser.add_argument('--bid-model')
    parser.add_argument('--speak-model')
    parser.add_argument('--fallback-model')
    parser.add_argument('--chaos', action='store_true', help='Enable guarded localhost demo fault controls')
    parser.add_argument('--drafts', action='store_true', help='Optional bounded speculative text preparation')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    load_dotenv(args.env_file, override=True)
    # Keep the canonical default port, while allowing an explicitly isolated local demo.
    allowed = [v.strip() for v in os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',') if v.strip()]
    os.environ['CORS_ORIGINS'] = ','.join(dict.fromkeys(allowed + [
        f'http://localhost:{args.port}', f'http://127.0.0.1:{args.port}']))
    os.environ['ROUNDTABLE_MODE'] = 'panel'
    if args.chaos:
        os.environ['ENABLE_CHAOS'] = '1'
    if args.drafts:
        os.environ['ENABLE_DRAFTS'] = '1'
    for key, value in (('BID_TIMEOUT_MS', args.bid_timeout_ms), ('LLM_MODEL_BID', args.bid_model),
                       ('LLM_MODEL_SPEAK', args.speak_model), ('LLM_MODEL_FALLBACK', args.fallback_model)):
        if value is not None:
            os.environ[key] = str(value)
    uvicorn.run('gateway.main:app', host='127.0.0.1', port=args.port, access_log=False)


if __name__ == '__main__':
    main()
