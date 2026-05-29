from __future__ import annotations

import asyncio
import importlib.metadata
import time
from collections import Counter, defaultdict
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
        
        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count
        
        # Group elements by page number
        markdown = self._elements_to_page_aligned_markdown(elements, page_count)
        elapsed_seconds = time.perf_counter() - started_at

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

    def _elements_to_page_aligned_markdown(self, elements: list[Any], page_count: int) -> str:
        # Group elements by page number
        pages: dict[int, list[str]] = defaultdict(list)
        
        for element in elements:
            rendered = self._render_element(element)
            if not rendered:
                continue
            
            # Get page number from element metadata (1-indexed)
            metadata = getattr(element, "metadata", None)
            page_number = getattr(metadata, "page_number", None) if metadata else None
            
            if isinstance(page_number, int) and page_number >= 1:
                pages[page_number].append(rendered)
            else:
                # If no page number, put in page 1
                pages[1].append(rendered)
        
        # Build page-aligned markdown with form feed separators
        page_texts: list[str] = []
        for page_num in range(1, page_count + 1):
            page_content = pages.get(page_num, [])
            page_texts.append("\n\n".join(page_content))
        
        return "\f".join(page_texts)

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
            return table_html or text

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

    def _get_library_version(self) -> str:
        try:
            return importlib.metadata.version("unstructured")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"
