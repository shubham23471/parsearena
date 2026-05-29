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
        text, _, images = text_from_rendered(rendered)
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        metadata = {
            "image_count": len(images) if images is not None else 0,
            "execution_device": execution_device,
            "config_summary": self.get_config_summary(),
            "library_version": self._get_library_version(),
        }
        return ParseResult(
            markdown=str(text),
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata=metadata,
        )

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("marker-pdf")
        except importlib.metadata.PackageNotFoundError:
            return None
