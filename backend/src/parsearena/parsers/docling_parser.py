from __future__ import annotations

import asyncio
import importlib.metadata
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult
from parsearena.parsers.device import detect_best_device


class DoclingParser:
    name = "docling"

    def get_execution_device(self) -> str:
        return detect_best_device()

    def get_config_summary(self) -> dict[str, object]:
        return {
            "accelerator": self.get_execution_device(),
            "pipeline": "default",
        }

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from docling.document_converter import DocumentConverter
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("Missing dependency 'docling'. Install with: uv add docling") from exc

        execution_device = self.get_execution_device()
        gpu_fallback = False
        started_at = time.perf_counter()
        build_started_at = time.perf_counter()
        converter = self._build_converter(
            preferred_device=execution_device,
            converter_cls=DocumentConverter,
        )
        model_load_seconds = time.perf_counter() - build_started_at
        convert_started_at = time.perf_counter()
        try:
            conversion_result = converter.convert(str(pdf_path))
            parse_only_seconds = time.perf_counter() - convert_started_at
        except Exception as exc:
            if execution_device != "cpu" and self._is_meta_tensor_error(exc):
                gpu_fallback = True
                started_at = time.perf_counter()
                cpu_converter = self._build_converter(
                    preferred_device="cpu",
                    converter_cls=DocumentConverter,
                )
                model_load_seconds = time.perf_counter() - started_at
                convert_started_at = time.perf_counter()
                conversion_result = cpu_converter.convert(str(pdf_path))
                parse_only_seconds = time.perf_counter() - convert_started_at
                execution_device = "cpu"
            else:
                raise
        
        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count
        
        # Extract page-aligned markdown
        markdown = self._extract_page_aligned_markdown(conversion_result.document, page_count)
        elapsed_seconds = time.perf_counter() - started_at

        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata={
                "execution_device": execution_device,
                "gpu_fallback": gpu_fallback,
                "model_load_seconds": model_load_seconds,
                "parse_only_seconds": parse_only_seconds,
                "config_summary": self.get_config_summary(),
                "library_version": self._get_library_version(),
            },
        )

    def _extract_page_aligned_markdown(self, document: Any, page_count: int) -> str:
        # Try to get page-level content from docling document
        # Docling documents have pages with items that can be exported
        
        pages = getattr(document, "pages", None)
        
        if pages and hasattr(pages, "__iter__"):
            page_texts: list[str] = []
            
            # pages might be a dict or list
            if isinstance(pages, dict):
                # Dict keyed by page number or page id
                for page_num in range(1, page_count + 1):
                    page = pages.get(page_num) or pages.get(str(page_num)) or pages.get(page_num - 1)
                    if page:
                        page_md = self._render_page(page, document)
                        page_texts.append(page_md)
                    else:
                        page_texts.append("")
            else:
                # List of pages
                page_list = list(pages)
                for i in range(page_count):
                    if i < len(page_list):
                        page_md = self._render_page(page_list[i], document)
                        page_texts.append(page_md)
                    else:
                        page_texts.append("")
            
            if page_texts:
                return "\f".join(page_texts)
        
        # Try iterate_items with page info
        items_method = getattr(document, "iterate_items", None)
        if callable(items_method):
            try:
                return self._build_markdown_from_items(document, page_count)
            except Exception:
                pass
        
        # Fallback: use standard export (no page alignment)
        return str(document.export_to_markdown())

    def _render_page(self, page: Any, document: Any) -> str:
        # Try to get items for this specific page
        items = getattr(page, "items", None) or getattr(page, "children", None)
        
        if items and hasattr(items, "__iter__"):
            parts: list[str] = []
            for item in items:
                item_md = self._render_item(item)
                if item_md:
                    parts.append(item_md)
            return "\n\n".join(parts)
        
        # Try page-level export
        if hasattr(page, "export_to_markdown"):
            try:
                return str(page.export_to_markdown()).strip()
            except Exception:
                pass
        
        return ""

    def _build_markdown_from_items(self, document: Any, page_count: int) -> str:
        from collections import defaultdict
        
        pages_content: dict[int, list[str]] = defaultdict(list)
        
        for item, _ in document.iterate_items():
            # Get page number from item's prov (provenance)
            prov = getattr(item, "prov", None)
            page_no = 1
            
            if prov and hasattr(prov, "__iter__"):
                for p in prov:
                    page_ref = getattr(p, "page_no", None) or getattr(p, "page", None)
                    if isinstance(page_ref, int):
                        page_no = page_ref
                        break
            
            item_md = self._render_item(item)
            if item_md:
                pages_content[page_no].append(item_md)
        
        # Build page-aligned output
        page_texts: list[str] = []
        for page_num in range(1, page_count + 1):
            content = pages_content.get(page_num, [])
            page_texts.append("\n\n".join(content))
        
        return "\f".join(page_texts)

    def _render_item(self, item: Any) -> str:
        item_type = type(item).__name__.lower()
        
        # Try export_to_markdown
        if hasattr(item, "export_to_markdown"):
            try:
                return str(item.export_to_markdown()).strip()
            except Exception:
                pass
        
        # Get text content
        text = getattr(item, "text", "") or getattr(item, "content", "") or ""
        if not isinstance(text, str):
            text = str(text) if text else ""
        text = text.strip()
        
        if not text:
            return ""
        
        # Format based on type
        if "heading" in item_type or "title" in item_type:
            level = getattr(item, "level", 1) or 1
            return f"{'#' * min(level, 6)} {text}"
        
        if "table" in item_type:
            # Try to get table HTML or markdown
            html = getattr(item, "html", "") or getattr(item, "text_as_html", "")
            if html:
                return str(html)
            return text
        
        if "list" in item_type:
            return f"- {text}"
        
        return text

    def _build_converter(self, *, preferred_device: str, converter_cls: type) -> object:
        try:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import (
                AcceleratorDevice,
                AcceleratorOptions,
                PdfPipelineOptions,
            )
            from docling.document_converter import PdfFormatOption
        except Exception:
            return converter_cls()

        pipeline_options = PdfPipelineOptions()
        accelerator_options = AcceleratorOptions()
        resolved_device = self._resolve_accelerator_device(AcceleratorDevice, preferred_device)
        if resolved_device is not None:
            accelerator_options.device = resolved_device
        pipeline_options.accelerator_options = accelerator_options

        return converter_cls(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )

    def _resolve_accelerator_device(self, accelerator_enum: type, requested_device: str) -> object | None:
        requested_normalized = requested_device.lower()
        for candidate in accelerator_enum:
            candidate_name = str(getattr(candidate, "name", "")).lower()
            candidate_value = str(getattr(candidate, "value", "")).lower()
            if requested_normalized in {candidate_name, candidate_value}:
                return candidate
        return None

    def _is_meta_tensor_error(self, exc: Exception) -> bool:
        message = str(exc)
        return "Cannot copy out of meta tensor" in message or "to_empty()" in message

    def _get_library_version(self) -> str:
        try:
            return importlib.metadata.version("docling")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"
