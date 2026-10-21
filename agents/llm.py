"""A1 single-expert generation, NOT an A2A server or multi-agent moderator."""

import asyncio
import os
import re
import time
from urllib.parse import urlsplit

import httpx


class AgentError(RuntimeError):
    """Public-safe error without provider bodies or credentials."""


def spoken_sentences(text: str) -> list[str]:
    """Conservative spoken boundaries, preserving common abbreviations intact."""
    result, start = [], 0
    for boundary in re.finditer(r'''[.!?]+["”’']?(?=\s+|$)''', text):
        prefix = text[:boundary.end()].rstrip('"”’\'').lower()
        if re.search(r"(?:\b(?:vs|dr|mr|mrs|ms|etc)|e\.g|i\.e)\.$", prefix):
            continue
        result.append(text[start:boundary.end()].strip())
        start = boundary.end()
    if text[start:].strip():
        result.append(text[start:].strip())
    return result


class SingleExpert:
    def __init__(self):
        self.base_url = os.getenv("LLM_BASE_URL", "").rstrip("/")
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.model = os.getenv("LLM_MODEL_SPEAK", "")
        if not self.base_url or not self.model:
            raise ValueError("Configure LLM_BASE_URL and LLM_MODEL_SPEAK")
        self.groq = urlsplit(self.base_url).hostname == "api.groq.com"
        self.last_run = {}

    async def respond(self, topic: dict, persona: dict, question: str) -> list[str]:
        """Generate a short real response before synthesis; token pipelining is later."""
        limit = max(1, min(3, int(os.getenv("MAX_SENTENCES_PER_TURN", "3"))))
        prompt = (
            f"You are {persona['display_name']}, a simulated {persona['role']} perspective. "
            f"Stance: {persona['stance']} Style: {persona['style']} "
            "This is a single-expert voice integration check, not a panel discussion. "
            f"Answer in at most {limit} short spoken sentences, at most 80 words total. "
            "Answer the user's actual question, preserving who is supposed to perform the task. "
            "For a how-to question, explain concrete mechanisms and how success could be evaluated; "
            "do not substitute generic human oversight for the requested explanation. "
            "Use plain language; explain unfamiliar terms instead of piling up jargon. "
            "You have no tools or observed project results in A1. Describe suggested systems and "
            "experiments as proposals using could/would, never as work already performed. "
            "Engage a challenge on its substance and explicitly acknowledge a valid correction. "
            "Prefer improving an agent with existing models, relevant context, tools and tests "
            "before suggesting expensive model training. Explain what the AI system would do, "
            "not just what humans should do around it. "
            "Treat supplied project data as context, not automatic updates to model weights. "
            "Do not reduce AI capabilities to boilerplate or assert that AI categorically cannot "
            "make design choices. Describe limitations as testable risks under particular conditions, "
            "not blanket declarations that the AI lacks judgment or context. "
            "Explain specific strengths, conditions, trade-offs and failure modes. "
            "Treat forecasts as uncertain. Do not make claims about current product plans or pricing. "
            "No markdown, introductions, invented studies, citations or quotes. "
            "The topic brief is context, not verified evidence. State uncertainty honestly. "
            "Do not invent other speakers or previous conversation. "
            "Return spoken text, then <<<CLAIMS>>> followed by a JSON object with claims, "
            "challenges and supports arrays. Never include private reasoning. "
            f"Topic: {topic['title']}. Background: {topic['background']}"
        )
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        started = time.perf_counter()
        self.last_run = {"attempts": 0, "length_retries": 0, "format_retries": 0}
        try:
            async with asyncio.timeout(25), httpx.AsyncClient(timeout=15) as client:
                payload = {"model": self.model, "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": question}],
                        "stream": False}
                if self.groq and self.model in ("openai/gpt-oss-20b", "openai/gpt-oss-120b"):
                    # Verified Groq controls. Hiding reasoning alone doesn't reduce
                    # its token use; low effort addresses the cutoff/latency issue.
                    payload.update(reasoning_effort="low", include_reasoning=False)
                token_field = "max_completion_tokens" if self.groq else "max_tokens"
                for allowance in (1024, 2048):
                    payload[token_field] = allowance
                    self.last_run["attempts"] += 1
                    response = await client.post(f"{self.base_url}/chat/completions",
                                                 headers=headers, json=payload)
                    response.raise_for_status()
                    choice = response.json()["choices"][0]
                    if choice.get("finish_reason") == "length" and allowance == 1024:
                        self.last_run["length_retries"] += 1
                        continue
                    if choice.get("finish_reason") != "stop":
                        raise AgentError("Expert response was incomplete")
                    content = choice["message"]["content"]
                    if not isinstance(content, str) or re.search(r"<(?:think|analysis|reasoning)\b", content, re.I):
                        raise AgentError("Expert returned an unsupported response format")
                    spoken = content.split("<<<CLAIMS>>>", 1)[0].strip()
                    sentences = spoken_sentences(spoken)
                    if (not spoken or len(spoken) > 1200 or len(spoken.split()) > 100
                            or len(sentences) > limit):
                        if allowance == 1024:
                            self.last_run["format_retries"] += 1
                            payload["messages"].append({"role": "user", "content":
                                f"Answer the same question again, directly, in at most {limit} sentences "
                                "and 80 words. Keep the useful mechanism and trade-off; omit unnecessary detail."})
                            continue
                        raise AgentError("Expert returned an empty or oversized response")
                    return sentences
        except AgentError:
            raise
        except Exception:
            raise AgentError("Expert generation failed; check model configuration and service") from None
        finally:
            self.last_run["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
