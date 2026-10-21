"""Structured JSONL tracing for A2A messages and gateway events."""

from __future__ import annotations

import asyncio
import datetime
import json
from pathlib import Path
from typing import Any, Dict, Optional


class TraceLogger:
    """Async-safe JSONL logger writing structured traces to logs/traces/."""

    def __init__(self, log_dir: Optional[Path] = None):
        self.log_dir = log_dir or Path("logs/traces")
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    def _get_file_path(self, session_id: str) -> Path:
        safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_")) or "default"
        return self.log_dir / f"{safe_session_id}.jsonl"

    async def log_event(
        self,
        trace_id: str,
        turn_id: Optional[int],
        from_entity: str,
        to_entity: str,
        msg_type: str,
        payload: Dict[str, Any],
        session_id: str = "default",
        ts: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Log a structured A2A message or gateway trace event."""
        record = {
            "trace_id": trace_id,
            "turn_id": turn_id,
            "ts": ts or datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "from": from_entity,
            "to": to_entity,
            "type": msg_type,
            "payload": payload,
        }

        line = json.dumps(record, ensure_ascii=False) + "\n"
        file_path = self._get_file_path(session_id)

        async with self._lock:
            # Run file write in executor to keep event loop non-blocking
            await asyncio.to_thread(self._write_line, file_path, line)

        return record

    def _write_line(self, file_path: Path, line: str) -> None:
        with open(file_path, "a", encoding="utf-8") as f:
            f.write(line)


# Global default trace logger
trace_logger = TraceLogger()
