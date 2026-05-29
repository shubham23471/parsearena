from __future__ import annotations

import asyncio
import importlib.metadata
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult


class MarkItDownParser:
    name = "markitdown"

    def __init__(self) -> None:
        self._last_plugins_enabled = True

    def get_execution_device(self) -> str:
        return "cpu"

    def get_config_summary(self) -> dict[str, Any]:
        return {"plugins_enabled": self._last_plugins_enabled}

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
        
        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count
        
        plugins_enabled = True
        try:
            converter = MarkItDown(enable_plugins=True)
            conversion_result = self._convert(converter, pdf_path)
        except Exception:
            converter = MarkItDown(enable_plugins=False)
            conversion_result = self._convert(converter, pdf_path)
            plugins_enabled = False

        self._last_plugins_enabled = plugins_enabled
        full_markdown = self._extract_markdown(conversion_result)
        
        # MarkItDown doesn't provide page-level output, so we use pymupdf 
        # to extract per-page text and create page-aligned markdown
        markdown = self._create_page_aligned_markdown(pdf_path, full_markdown, page_count)
        
        elapsed_seconds = time.perf_counter() - started_at

        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata={
                "execution_device": "cpu",
                "plugins_enabled": plugins_enabled,
                "config_summary": self.get_config_summary(),
                "library_version": self._get_library_version(),
            },
        )

    def _create_page_aligned_markdown(
        self, 
        pdf_path: Path, 
        full_markdown: str, 
        page_count: int
    ) -> str:
        """
        MarkItDown doesn't support page-level output.
        We extract per-page raw text from pymupdf and use that for page alignment.
        The full markitdown output goes on page 1, with raw text hints for other pages.
        """
        try:
            import pymupdf
        except ImportError:
            # Can't do page alignment without pymupdf
            return full_markdown
        
        page_texts: list[str] = []
        
        with pymupdf.open(pdf_path) as document:
            for page_num in range(page_count):
                page = document[page_num]
                # Get raw text for this page
                raw_text = page.get_text("text").strip()
                
                if page_num == 0:
                    # First page gets the full markitdown output
                    # This ensures we don't lose any formatting
                    page_texts.append(full_markdown.strip())
                else:
                    # Other pages get raw text extraction
                    # This provides page alignment even if formatting is basic
                    if raw_text:
                        page_texts.append(raw_text)
                    else:
                        page_texts.append("")
        
        return "\f".join(page_texts)

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

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("markitdown")
        except importlib.metadata.PackageNotFoundError:
            return None
