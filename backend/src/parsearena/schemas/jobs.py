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
    status: Literal["pending", "queued", "running", "completed", "error"]
    elapsed_seconds: float | None = None
    error: str | None = None
    execution_device: Literal["cuda", "mps", "cpu"] | None = None
    queued_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


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


class ParseTriggerResponse(BaseModel):
    job_id: str
    parsers: dict[str, Literal["queued"]]


class ParseRequest(BaseModel):
    parsers: list[str] = Field(default_factory=list)


class ParseResultResponse(BaseModel):
    markdown: str
    elapsed_seconds: float | None = None


class AllResultsResponse(BaseModel):
    job_id: str
    results: dict[str, ParseResultResponse | None]
