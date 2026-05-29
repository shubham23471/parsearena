from __future__ import annotations

import asyncio
import importlib.metadata
import inspect
import threading
import time
from pathlib import Path
from typing import Any

from parsearena.parsers.base import ParseResult
from parsearena.parsers.device import detect_best_device


class MarkerParser:
    name = "marker"

    def __init__(self) -> None:
        self._converters_by_device: dict[str, Any] = {}
        self._converter_lock = threading.Lock()

    def get_execution_device(self) -> str:
        return detect_best_device()

    def get_config_summary(self) -> dict[str, object]:
        return {
            "device": self.get_execution_device(),
            "model_cache": "in_memory_by_device",
        }

    async def parse(self, pdf_path: Path) -> ParseResult:
        return await asyncio.to_thread(self._parse_sync, pdf_path)

    def _get_converter(self, execution_device: str) -> Any:
        converter = self._converters_by_device.get(execution_device)
        if converter is not None:
            return converter

        with self._converter_lock:
            converter = self._converters_by_device.get(execution_device)
            if converter is not None:
                return converter

            try:
                from marker.converters.pdf import PdfConverter
                from marker.models import create_model_dict
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "Missing dependency 'marker-pdf'. Install with: uv add marker-pdf"
                ) from exc

            model_kwargs: dict[str, Any] = {}
            try:
                model_signature = inspect.signature(create_model_dict)
                if "device" in model_signature.parameters:
                    model_kwargs["device"] = execution_device
            except (TypeError, ValueError):
                pass

            artifact_dict = create_model_dict(**model_kwargs)

            converter_kwargs: dict[str, Any] = {}
            try:
                converter_signature = inspect.signature(PdfConverter)
                if "device" in converter_signature.parameters:
                    converter_kwargs["device"] = execution_device
            except (TypeError, ValueError):
                pass

            converter = PdfConverter(artifact_dict=artifact_dict, **converter_kwargs)
            self._converters_by_device[execution_device] = converter
            return converter

    def _parse_sync(self, pdf_path: Path) -> ParseResult:
        try:
            import pymupdf
            from marker.output import text_from_rendered
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency 'marker-pdf'. Install with: uv add marker-pdf"
            ) from exc

        execution_device = self.get_execution_device()
        converter = self._get_converter(execution_device)
        started_at = time.perf_counter()
        rendered = converter(str(pdf_path))
        
        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count
        
        # Try to extract page-aligned markdown from rendered output
        markdown = self._extract_page_aligned_markdown(rendered, text_from_rendered, page_count)
        elapsed_seconds = time.perf_counter() - started_at

        text, _, images = text_from_rendered(rendered)
        metadata = {
            "image_count": len(images) if images is not None else 0,
            "execution_device": execution_device,
            "config_summary": self.get_config_summary(),
            "library_version": self._get_library_version(),
        }
        return ParseResult(
            markdown=markdown,
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata=metadata,
        )

    def _extract_page_aligned_markdown(
        self, 
        rendered: Any, 
        text_from_rendered: Any,
        page_count: int
    ) -> str:
        # Try to get per-page content from rendered.children (pages)
        children = getattr(rendered, "children", None)
        
        if children and hasattr(children, "__iter__"):
            page_texts: list[str] = []
            for i, child in enumerate(children):
                if i >= page_count:
                    break
                # Each child is a page, try to get its markdown
                child_md = self._render_page_block(child)
                page_texts.append(child_md)
            
            # Pad with empty pages if needed
            while len(page_texts) < page_count:
                page_texts.append("")
            
            if page_texts:
                return "\f".join(page_texts)
        
        # Fallback: use text_from_rendered (no page alignment)
        text, _, _ = text_from_rendered(rendered)
        return str(text)

    def _render_page_block(self, block: Any) -> str:
        # Try to render a single page block to markdown
        # Marker blocks have render_children() or similar methods
        
        # Try block.render() first
        if hasattr(block, "render"):
            try:
                result = block.render()
                if isinstance(result, str):
                    return result.strip()
            except Exception:
                pass
        
        # Try to get markdown attribute
        if hasattr(block, "markdown"):
            md = getattr(block, "markdown", "")
            if isinstance(md, str):
                return md.strip()
        
        # Try to recursively render children
        children = getattr(block, "children", None)
        if children and hasattr(children, "__iter__"):
            parts: list[str] = []
            for child in children:
                child_text = self._render_block_to_text(child)
                if child_text:
                    parts.append(child_text)
            return "\n\n".join(parts)
        
        # Try to get raw text
        if hasattr(block, "raw_text"):
            raw = getattr(block, "raw_text", "")
            if callable(raw):
                try:
                    return str(raw()).strip()
                except Exception:
                    pass
            elif isinstance(raw, str):
                return raw.strip()
        
        return ""

    def _render_block_to_text(self, block: Any) -> str:
        # Get text content from a block
        block_type = type(block).__name__
        
        # Try markdown attribute
        if hasattr(block, "markdown"):
            md = getattr(block, "markdown", "")
            if isinstance(md, str) and md.strip():
                return md.strip()
        
        # Try raw_text
        if hasattr(block, "raw_text"):
            raw = getattr(block, "raw_text", "")
            if callable(raw):
                try:
                    text = str(raw())
                except Exception:
                    text = ""
            else:
                text = str(raw) if raw else ""
            
            if text.strip():
                # Format based on block type
                if "heading" in block_type.lower() or "title" in block_type.lower():
                    return f"## {text.strip()}"
                if "list" in block_type.lower():
                    return f"- {text.strip()}"
                return text.strip()
        
        # Recurse into children
        children = getattr(block, "children", None)
        if children and hasattr(children, "__iter__"):
            parts = [self._render_block_to_text(c) for c in children]
            return "\n\n".join(p for p in parts if p)
        
        return ""

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("marker-pdf")
        except importlib.metadata.PackageNotFoundError:
            return None
