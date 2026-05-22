from __future__ import annotations

import asyncio
import threading
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult


class MarkerParser:
    name = "marker"

    def __init__(self) -> None:
        self._converter: Any = None
        self._converter_lock = threading.Lock()

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _get_converter(self) -> Any:
        if self._converter is not None:
            return self._converter

        with self._converter_lock:
            if self._converter is not None:
                return self._converter

            try:
                from marker.converters.pdf import PdfConverter
                from marker.models import create_model_dict
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "Missing dependency 'marker-pdf'. Install with: uv add marker-pdf"
                ) from exc

            self._converter = PdfConverter(artifact_dict=create_model_dict())
            return self._converter

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from marker.output import text_from_rendered
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency 'marker-pdf'. Install with: uv add marker-pdf"
            ) from exc

        converter = self._get_converter()
        started_at = time.perf_counter()
        rendered = converter(str(pdf_path))
        text, _, images = text_from_rendered(rendered)
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        metadata = {"image_count": len(images) if images is not None else 0}
        return ParseResult(
            markdown=str(text),
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata=metadata,
        )
