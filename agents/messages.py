"""Internal A2 floor payload validation; does not replace a shared contract.

These application messages travel in standard A2A DataParts (protocol 0.3.0).
Browser events remain unchanged. See architecture.md sections 4 and 5.
"""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AGENTS = ('ai_engineer', 'software_developer', 'oss_maintainer')


class Envelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='forbid')
    type: Literal['floor.utterance', 'floor.bid', 'floor.grant', 'agent.direct',
                  'agent.speech', 'agent.ack', 'human.question', 'floor.resume']
    trace_id: str = Field(min_length=1, max_length=100)
    turn_id: int = Field(ge=0)
    sender: str = Field(alias='from', min_length=1, max_length=60)
    to: str = Field(min_length=1, max_length=60)
    ts: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    payload: dict = Field(default_factory=dict)

    def wire(self):
        return self.model_dump(by_alias=True)


class Bid(BaseModel):
    model_config = ConfigDict(extra='forbid')
    intent: Literal['agree', 'challenge', 'build', 'clarify', 'pass']
    target: str | None = None
    claim_id: str | None = None
    urgency: float = Field(ge=0, le=1, allow_inf_nan=False)
    novelty: float = Field(ge=0, le=1, allow_inf_nan=False)
    preview: str = Field(max_length=180)

    @field_validator('preview')
    @classmethod
    def short_preview(cls, value):
        if len(value.split()) > 12:
            raise ValueError('preview exceeds 12 words')
        return value

    @field_validator('target')
    @classmethod
    def known_target(cls, value):
        if value is not None and value not in AGENTS:
            raise ValueError('unknown target')
        return value


def envelope(kind, trace_id, turn_id, sender, to, **payload):
    return Envelope(type=kind, trace_id=trace_id, turn_id=turn_id,
                    sender=sender, to=to, payload=payload)
