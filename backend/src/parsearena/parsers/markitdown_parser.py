from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult


class MarkItDownParser:
    name = "markitdown"

    def get_execution_device(self) -> str:
        return "cpu"

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from markitdown import MarkItDown
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency 'markitdown'. Install with: uv add \"markitdown[pdf]\""
            ) from exc

        started_at = time.perf_counter()
        converter = MarkItDown(enable_plugins=False)
        conversion_result = self._convert(converter, pdf_path)
        markdown = self._extract_markdown(conversion_result)
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata={"execution_device": "cpu"},
        )

    def _convert(self, converter: Any, pdf_path: Path) -> Any:
        convert_local = getattr(converter, "convert_local", None)
        if callable(convert_local):
            return convert_local(str(pdf_path))
        return converter.convert(str(pdf_path))

    def _extract_markdown(self, conversion_result: Any) -> str:
        for attribute in ("text_content", "markdown"):
            value = getattr(conversion_result, attribute, None)
            if isinstance(value, str):
                return value
        if isinstance(conversion_result, str):
            return conversion_result
        raise ValueError("MarkItDown returned an unexpected conversion result payload.")
