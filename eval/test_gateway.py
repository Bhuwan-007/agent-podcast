"""Tests for gateway /health endpoint and structured tracing."""

import json
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from gateway.main import app
from gateway.tracing import TraceLogger


@pytest.mark.asyncio
async def test_health_check():
    """Verify /health returns status ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "ai-roundtable-gateway"


@pytest.mark.asyncio
async def test_trace_logger(tmp_path: Path):
    """Verify JSONL trace logger writes valid structured records."""
    logger = TraceLogger(log_dir=tmp_path)
    record = await logger.log_event(
        trace_id="test_tr_1",
        turn_id=1,
        from_entity="gateway",
        to_entity="agent_1",
        msg_type="floor.grant",
        payload={"reason": "highest score"},
        session_id="test_session",
    )

    assert record["trace_id"] == "test_tr_1"
    assert record["turn_id"] == 1
    assert record["from"] == "gateway"

    log_file = tmp_path / "test_session.jsonl"
    assert log_file.exists()

    with open(log_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        assert len(lines) == 1
        parsed = json.loads(lines[0])
        assert parsed["trace_id"] == "test_tr_1"
        assert parsed["type"] == "floor.grant"
        assert parsed["payload"]["reason"] == "highest score"
