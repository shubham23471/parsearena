from __future__ import annotations

from pydantic import BaseModel


class JobPlaceholder(BaseModel):
    message: str = "Job schemas will be added in Phase 1.2."
