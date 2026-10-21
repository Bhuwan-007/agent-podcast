"""Lifecycle for independently running localhost A2A experts."""
import asyncio
import os
from pathlib import Path
import socket
import subprocess
import sys

from agents.messages import AGENTS
from gateway.a2a_client import AgentPool
from gateway.tracing import trace_logger

ROOT = Path(__file__).resolve().parents[1]


class AgentRuntime:
    def __init__(self):
        self.children = []
        self.lock = asyncio.Lock()
        self.started = False
        self.urls = {agent: f'http://127.0.0.1:{9101+i}/' for i, agent in enumerate(AGENTS)}

    async def pool(self, session_id, logger=None):
        async with self.lock:
            if not self.started:
                if os.getenv('A2A_EXTERNAL', '0') != '1':
                    reservations = []
                    try:
                        for i in range(3):
                            sock = socket.socket()
                            reservations.append(sock)
                            sock.bind(('127.0.0.1', 9101 + i))
                    finally:
                        for sock in reservations:
                            sock.close()
                    try:
                        for i, agent in enumerate(AGENTS):
                            self.children.append(subprocess.Popen([
                                sys.executable, '-B', '-m', 'agents.agent_server',
                                '--agent', agent, '--port', str(9101+i)], cwd=ROOT,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)))
                    except Exception:
                        await self.close()
                        raise
                self.started = True
        pool = AgentPool(self.urls, logger or trace_logger, session_id,
                         int(os.getenv('BID_TIMEOUT_MS', '400')))
        try:
            for attempt in range(60):
                try:
                    await pool.connect()
                    return pool
                except Exception:
                    if attempt == 59 or any(child.poll() is not None for child in self.children):
                        raise RuntimeError('A2A expert startup failed') from None
                    await asyncio.sleep(.1)
        except BaseException:
            await pool.close()
            raise

    async def close(self):
        for child in self.children:
            if child.poll() is None:
                child.terminate()
        for child in self.children:
            try:
                await asyncio.to_thread(child.wait, timeout=3)
            except subprocess.TimeoutExpired:
                child.kill()
                await asyncio.to_thread(child.wait, timeout=3)
        self.children.clear()
        self.started = False
