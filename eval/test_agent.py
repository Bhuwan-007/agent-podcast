"""MOCK HTTP provider tests: generated content selection and safety boundaries."""

import json

import httpx
import pytest

from agents import llm
from gateway.session import load_topic


@pytest.fixture
def mock_http(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("LLM_MODEL_SPEAK", "test-open-weight-model")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    original = httpx.AsyncClient

    def install(payload, status=200):
        requests = []
        def handle(request):
            requests.append(request)
            data = payload[min(len(requests) - 1, len(payload) - 1)] if isinstance(payload, list) else payload
            return httpx.Response(status, json=data)
        monkeypatch.setattr(llm.httpx, "AsyncClient", lambda **kwargs: original(
            transport=httpx.MockTransport(handle), **kwargs))
        return requests
    return install


@pytest.mark.asyncio
async def test_real_generation_interface_strips_claims_and_ignores_reasoning(mock_http):
    requests = mock_http({"choices": [{"finish_reason": "stop", "message": {
        "content": 'Review matters. Tests help.<<<CLAIMS>>>{"claims":[{"text":"not spoken"}]}',
        "reasoning": "private provider field"}}]})
    topic, persona = load_topic("topic_1")
    sentences = await llm.SingleExpert().respond(topic, persona, topic["opening_prompt"])
    assert sentences == ["Review matters.", "Tests help."]
    body = json.loads(requests[0].content)
    assert body["messages"][1]["content"] == topic["opening_prompt"]
    assert requests[0].url.path == "/v1/chat/completions"
    assert body["stream"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("payload,status", [
    ({"choices": [{"finish_reason": "length", "message": {"content": "Cut off"}}]}, 200),
    ({"choices": [{"finish_reason": "stop", "message": {"content": "<think>private</think>text"}}]}, 200),
    ({"error": "private provider details"}, 401),
    ({"choices": []}, 200),
])
async def test_provider_errors_do_not_become_spoken_content(mock_http, payload, status):
    mock_http(payload, status)
    topic, persona = load_topic("topic_1")
    with pytest.raises(llm.AgentError) as error:
        await llm.SingleExpert().respond(topic, persona, "Question")
    assert "private" not in str(error.value)
    assert "test-key" not in str(error.value)


@pytest.mark.asyncio
async def test_groq_truncation_retries_once_with_supported_controls(mock_http, monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setenv("LLM_MODEL_SPEAK", "openai/gpt-oss-20b")
    requests = mock_http([
        {"choices": [{"finish_reason": "length", "message": {"content": "Partial"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "Review still matters."}}]},
    ])
    topic, persona = load_topic("topic_1")
    expert = llm.SingleExpert()
    assert await expert.respond(topic, persona, "Question") == ["Review still matters."]
    assert len(requests) == 2
    bodies = [json.loads(r.content) for r in requests]
    assert [b["max_completion_tokens"] for b in bodies] == [1024, 2048]
    assert all(b["reasoning_effort"] == "low" and b["include_reasoning"] is False for b in bodies)
    assert expert.last_run["length_retries"] == 1


@pytest.mark.asyncio
async def test_repeated_truncation_stops_after_one_retry(mock_http):
    requests = mock_http({"choices": [{"finish_reason": "length", "message": {"content": "Partial"}}]})
    topic, persona = load_topic("topic_1")
    with pytest.raises(llm.AgentError, match="incomplete"):
        await llm.SingleExpert().respond(topic, persona, "Question")
    assert len(requests) == 2


@pytest.mark.asyncio
async def test_auth_failure_is_not_retried(mock_http):
    requests = mock_http({"error": "private provider detail"}, 401)
    topic, persona = load_topic("topic_1")
    with pytest.raises(llm.AgentError):
        await llm.SingleExpert().respond(topic, persona, "Question")
    assert len(requests) == 1


def test_spoken_sentence_boundaries_preserve_abbreviations_and_decimals():
    text = "Compare modularity vs. speed. Try e.g. a small prototype. Measure 3.5 seconds."
    assert llm.spoken_sentences(text) == [
        "Compare modularity vs. speed.", "Try e.g. a small prototype.", "Measure 3.5 seconds."]


@pytest.mark.asyncio
async def test_oversized_answer_gets_one_shorter_repair(mock_http):
    requests = mock_http([
        {"choices": [{"finish_reason": "stop", "message": {"content": "word " * 110}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "Compare options with a prototype."}}]},
    ])
    topic, persona = load_topic("topic_1")
    expert = llm.SingleExpert()
    assert await expert.respond(topic, persona, "Question") == ["Compare options with a prototype."]
    assert len(requests) == 2 and expert.last_run["format_retries"] == 1


@pytest.mark.asyncio
async def test_excess_sentences_are_not_silently_cut_mid_answer(mock_http, monkeypatch):
    monkeypatch.setenv("MAX_SENTENCES_PER_TURN", "1")
    requests = mock_http({"choices": [{"finish_reason": "stop", "message": {"content": "First. Second."}}]})
    topic, persona = load_topic("topic_1")
    with pytest.raises(llm.AgentError, match="oversized"):
        await llm.SingleExpert().respond(topic, persona, "Question")
    assert len(requests) == 2
