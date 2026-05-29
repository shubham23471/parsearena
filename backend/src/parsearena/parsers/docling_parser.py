from __future__ import annotations

import asyncio
import importlib.metadata
import time
from pathlib import Path

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

        started_at = time.perf_counter()
        execution_device = self.get_execution_device()
        converter = self._build_converter(preferred_device=execution_device, converter_cls=DocumentConverter)
        try:
            conversion_result = converter.convert(str(pdf_path))
        except Exception as exc:
            if execution_device != "cpu" and self._is_meta_tensor_error(exc):
                cpu_converter = self._build_converter(
                    preferred_device="cpu",
                    converter_cls=DocumentConverter,
                )
                conversion_result = cpu_converter.convert(str(pdf_path))
                execution_device = "cpu"
            else:
                raise
        markdown = conversion_result.document.export_to_markdown()
        elapsed_seconds = time.perf_counter() - started_at

        with pymupdf.open(pdf_path) as document:
            page_count = document.page_count

        return ParseResult(
            markdown=str(markdown),
            elapsed_seconds=elapsed_seconds,
            page_count=page_count,
            metadata={
                "execution_device": execution_device,
                "config_summary": self.get_config_summary(),
                "library_version": self._get_library_version(),
            },
        )

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

    def _get_library_version(self) -> str | None:
        try:
            return importlib.metadata.version("docling")
        except importlib.metadata.PackageNotFoundError:
            return None
