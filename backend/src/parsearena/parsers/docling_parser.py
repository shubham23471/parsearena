from __future__ import annotations

import asyncio
import time
from pathlib import Path

from parsearena.parsers.base import ParseResult


class DoclingParser:
    name = "docling"

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from docling.document_converter import DocumentConverter
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("Missing dependency 'docling'. Install with: uv add docling") from exc

        started_at = time.perf_counter()
        converter = DocumentConverter()
        conversion_result = converter.convert(str(pdf_path))
        markdown = conversion_result.document.export_to_markdown()
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        return ParseResult(
            markdown=str(markdown),
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
        )
