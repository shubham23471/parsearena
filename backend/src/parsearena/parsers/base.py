from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from typing import Protocol


@dataclass(slots=True)
class ParseResult:
    markdown: str
    elapsed_seconds: float
    page_count: int
    metadata: dict[str, Any] | None = None


class BaseParser(Protocol):
    name: str

    async def parse(self, pdf_path: Path) -> ParseResult: ...
