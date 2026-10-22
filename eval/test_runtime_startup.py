import asyncio
from unittest.mock import AsyncMock
import pytest
from gateway.runtime import AgentRuntime


@pytest.mark.asyncio
async def test_cold_imports_can_exceed_old_retry_count(monkeypatch):
    class Pool:
        attempts = 0
        healthy = False
        closed = False
        async def connect(self):
            self.attempts += 1
            if self.attempts <= 75:
                raise ConnectionError('Still importing')
        def start_health(self): self.healthy = True
        async def close(self): self.closed = True
    monkeypatch.setattr(asyncio, 'sleep', AsyncMock())
    pool = Pool()
    assert await AgentRuntime().wait_for_agents(pool) is pool
    assert pool.healthy and not pool.closed and pool.attempts == 76


@pytest.mark.asyncio
async def test_startup_has_hard_deadline_and_closes_failed_pool():
    class Pool:
        closed = False
        async def connect(self): await asyncio.Event().wait()
        async def close(self): self.closed = True
    pool = Pool()
    with pytest.raises(TimeoutError):
        await AgentRuntime().wait_for_agents(pool, timeout=.02)
    assert pool.closed
