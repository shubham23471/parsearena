from __future__ import annotations

import asyncio
import importlib.metadata
import time
from collections import Counter
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult
from parsearena.parsers.device import detect_best_device


class UnstructuredParser:
    name = "unstructured"
    STRATEGY = "auto"

    def get_execution_device(self) -> str:
        return detect_best_device()

    def get_config_summary(self) -> dict[str, Any]:
        return {"strategy": self.STRATEGY}

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
        execution_device = self.get_execution_device()
        elements: list[Any] = partition_pdf(filename=str(pdf_path), strategy=self.STRATEGY)
        markdown = self._elements_to_markdown(elements)
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        metadata = {
            "element_count": len(elements),
            "element_types": dict(Counter(type(element).__name__ for element in elements)),
            "execution_device": execution_device,
            "strategy": self.STRATEGY,
            "config_summary": self.get_config_summary(),
            "library_version": self._get_library_version(),
        }
        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata=metadata,
        )

    def _elements_to_markdown(self, elements: list[Any]) -> str:
        blocks: list[str] = []
        for element in elements:
            rendered = self._render_element(element)
            if rendered:
                blocks.append(rendered)
        return "\n\n".join(blocks)

    def _render_element(self, element: Any) -> str:
        element_type = type(element).__name__
        text = self._clean_text(getattr(element, "text", ""))
        metadata = getattr(element, "metadata", None)

        if element_type in {"Title", "Header"}:
            heading_depth = self._resolve_heading_depth(element_type, metadata)
            if not text:
                return ""
            return f"{'#' * heading_depth} {text}"

        if element_type == "Table":
            table_html = self._clean_text(getattr(metadata, "text_as_html", "") if metadata else "")
            # Keep markdown/plain-text table content first because the UI renderer
            # consumes Markdown; HTML tables can degrade readability when not rendered.
            if text:
                return text
            return table_html

        if element_type == "ListItem":
            if not text:
                return ""
            return f"- {text}"

        if element_type == "NarrativeText":
            return text

        return text

    def _resolve_heading_depth(self, element_type: str, metadata: Any) -> int:
        if element_type == "Header":
            return 2
        depth_value = getattr(metadata, "category_depth", None) if metadata is not None else None
        if isinstance(depth_value, int):
            return max(1, min(6, depth_value + 1))
        return 1

    def _clean_text(self, value: Any) -> str:
        if not isinstance(value, str):
            return ""
        return value.strip()

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("unstructured")
        except importlib.metadata.PackageNotFoundError:
            return None
