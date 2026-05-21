from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    job_id: str
    filename: str
    page_count: int
    size_bytes: int
    created_at: datetime


class ParserStatus(BaseModel):
    name: str
    status: Literal["pending", "parsing", "completed", "error"]
    elapsed_seconds: float | None = None
    error: str | None = None


class JobMetadata(BaseModel):
    job_id: str
    filename: str
    page_count: int
    size_bytes: int
    created_at: datetime
    status: Literal["uploaded", "parsing", "completed", "error"]
    parsers: dict[str, ParserStatus] = Field(default_factory=dict)


class JobStatus(BaseModel):
    job_id: str
    status: Literal["uploaded", "parsing", "completed", "error"]
    parsers: dict[str, ParserStatus] = Field(default_factory=dict)
