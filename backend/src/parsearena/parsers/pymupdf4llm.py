from __future__ import annotations

import asyncio
import importlib.metadata
import time
from pathlib import Path

from parsearena.parsers.base import ParseResult


class PyMuPDF4LLMParser:
    name = "pymupdf4llm"

    def get_execution_device(self) -> str:
        return "cpu"

    def get_config_summary(self) -> dict[str, object]:
        return {"page_chunks": True}

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
        
        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        # Use page_chunks=True to get per-page markdown
        page_chunks = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=True)
        
        # Build page-aligned markdown with form feed separators
        if isinstance(page_chunks, list):
            # page_chunks is a list of dicts with 'text' key per page
            page_texts: list[str] = []
            for i in range(page_count):
                if i < len(page_chunks):
                    chunk = page_chunks[i]
                    text = chunk.get("text", "") if isinstance(chunk, dict) else str(chunk)
                    page_texts.append(text.strip())
                else:
                    page_texts.append("")
            markdown = "\f".join(page_texts)
        else:
            # Fallback: single string without page info
            markdown = str(page_chunks)
        
        elapsed_seconds = time.perf_counter() - started_at

        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata={
                "execution_device": "cpu",
                "config_summary": self.get_config_summary(),
                "library_version": self._get_library_version(),
            },
        )

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("pymupdf4llm")
        except importlib.metadata.PackageNotFoundError:
            return None
