"""Real model diagnostic: capture status/counts only, never content or config values."""

import asyncio
import json
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

from agents import llm
from gateway.session import load_topic


async def main():
    load_dotenv(override=True)
    metadata = {"mocked": False}
    original = httpx.AsyncClient

    async def observe(response):
        await response.aread()
        metadata["http_status"] = response.status_code
        try:
            data = response.json()
            choice = data.get("choices", [{}])[0]
            reason = choice.get("finish_reason")
            metadata["finish_reason"] = reason if reason in ("stop", "length", "content_filter", "tool_calls") else "other"
            message = choice.get("message", {})
            metadata["content_characters"] = len(message.get("content") or "")
            metadata["reasoning_characters"] = len(message.get("reasoning_content") or message.get("reasoning") or "")
            usage = data.get("usage", {})
            metadata["token_counts"] = {k: usage[k] for k in ("prompt_tokens", "completion_tokens", "total_tokens")
                                        if type(usage.get(k)) is int}
        except (ValueError, TypeError, IndexError):
            metadata["metadata_parse_failed"] = True

    def observed_client(**kwargs):
        return original(**kwargs, event_hooks={"response": [observe]})

    # Only a response observer is added; real requests and response bodies are unchanged.
    llm.httpx.AsyncClient = observed_client
    started = time.perf_counter()
    try:
        topic, persona = load_topic("topic_1")
        await llm.SingleExpert().respond(topic, persona, topic["opening_prompt"])
        metadata["accepted_by_existing_implementation"] = True
    except llm.AgentError as error:
        metadata["accepted_by_existing_implementation"] = False
        metadata["public_error"] = str(error)
    finally:
        llm.httpx.AsyncClient = original
    metadata["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
    Path("docs/a1_model_diagnostic.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
