from __future__ import annotations

import asyncio
import time
from pathlib import Path

from parsearena.parsers.base import ParseResult


class PyMuPDF4LLMParser:
    name = "pymupdf4llm"

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            import pymupdf4llm
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency 'pymupdf4llm'. Install with: uv add pymupdf4llm"
            ) from exc

        started_at = time.perf_counter()
        markdown = pymupdf4llm.to_markdown(str(pdf_path))
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        return ParseResult(
            markdown=str(markdown),
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
        )
