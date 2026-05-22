from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult


class UnstructuredParser:
    name = "unstructured"

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from unstructured.partition.pdf import partition_pdf
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency 'unstructured[pdf]'. Install with: uv add \"unstructured[pdf]\""
            ) from exc

        started_at = time.perf_counter()
        elements: list[Any] = partition_pdf(filename=str(pdf_path))
        lines = [getattr(element, "text", "") for element in elements]
        markdown = "\n\n".join(line.strip() for line in lines if line and line.strip())
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        metadata = {"element_count": len(elements)}
        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata=metadata,
        )
