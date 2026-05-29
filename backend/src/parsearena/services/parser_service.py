from __future__ import annotations

import asyncio
from dataclasses import asdict

from parsearena.metrics import compute_structural_metrics, simulate_chunks
from parsearena.parsers import (
    DoclingParser,
    MarkItDownParser,
    MarkerParser,
    PyMuPDF4LLMParser,
    UnstructuredParser,
)
from parsearena.parsers.base import BaseParser, ParseResult
from parsearena.parsers.registry import get_parser_registry
from parsearena.services.storage import StorageService


class ParserService:
    def __init__(self, storage: StorageService):
        self.storage = storage
        parser_instances: dict[str, BaseParser] = {
            "pymupdf4llm": PyMuPDF4LLMParser(),
            "docling": DoclingParser(),
            "marker": MarkerParser(),
            "unstructured": UnstructuredParser(),
            "markitdown": MarkItDownParser(),
        }
        available_names = {item.name for item in get_parser_registry() if item.is_available}
        self._parsers = {
            parser_name: parser
            for parser_name, parser in parser_instances.items()
            if parser_name in available_names
        }

    def get_available_parsers(self) -> list[str]:
        return sorted(self._parsers.keys())

    def validate_parser_selection(self, parsers: list[str]) -> list[str]:
        selected = parsers if parsers else self.get_available_parsers()
        # Preserve order while dropping accidental duplicates from client payload.
        selected = list(dict.fromkeys(selected))
        if not selected:
            raise ValueError("No parsers are currently available.")

        available = set(self.get_available_parsers())
        unavailable = sorted({parser for parser in selected if parser not in available})
        if unavailable:
            invalid = ", ".join(unavailable)
            raise ValueError(f"Requested parser(s) are not available: {invalid}.")
        return selected

    async def start_multi_parse(self, job_id: str, parser_names: list[str]) -> dict[str, str]:
        await self.storage.get_pdf_path(job_id)
        metadata = await self.storage.get_metadata(job_id)
        parser_states = metadata.get("parsers", {})
        for parser_name in parser_names:
            existing_status = parser_states.get(parser_name, {}).get("status")
            if existing_status in {"queued", "running"}:
                raise ValueError(f"Parser '{parser_name}' is already running for this job.")

        queued_statuses: dict[str, str] = {}
        for parser_name in parser_names:
            await self.storage.update_parser_status(
                job_id=job_id,
                parser_name=parser_name,
                status="queued",
                elapsed_seconds=None,
                error=None,
            )
            queued_statuses[parser_name] = "queued"
        return queued_statuses

    async def run_parsers(self, job_id: str, parser_names: list[str]) -> None:
        semaphore = asyncio.Semaphore(min(len(parser_names), 3))
        tasks = [self._run_single_parser(job_id, parser_name, semaphore) for parser_name in parser_names]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_single_parser(
        self,
        job_id: str,
        parser_name: str,
        semaphore: asyncio.Semaphore,
    ) -> None:
        parser = self._get_parser(parser_name)
        execution_device = self._get_execution_device(parser)
        await self.storage.update_parser_status(
            job_id=job_id,
            parser_name=parser_name,
            status="running",
            elapsed_seconds=None,
            error=None,
            execution_device=execution_device,
        )
        async with semaphore:
            try:
                pdf_path = await self.storage.get_pdf_path(job_id)
                parse_result = await parser.parse(pdf_path)
                await self._save_parse_result(job_id, parser_name, parse_result)
            except Exception as exc:
                await self.storage.update_parser_status(
                    job_id,
                    parser_name,
                    status="error",
                    elapsed_seconds=None,
                    error=str(exc),
                    execution_device=execution_device,
                )

    async def _save_parse_result(self, job_id: str, parser_name: str, parse_result: ParseResult) -> None:
        parser = self._get_parser(parser_name)
        metadata = parse_result.metadata or {}
        metadata["config_summary"] = self._get_config_summary(parser, metadata)
        parse_result.metadata = metadata
        execution_device = self._extract_execution_device(parse_result)
        library_version = self._extract_library_version(parse_result)
        await self.storage.save_result(
            job_id=job_id,
            parser_name=parser_name,
            markdown=parse_result.markdown,
            timing=parse_result.elapsed_seconds,
            metadata=metadata,
            execution_device=execution_device,
            library_version=library_version,
        )
        structural_metrics = compute_structural_metrics(
            parse_result.markdown,
            parse_result.page_count,
        )
        chunk_simulation = simulate_chunks(parse_result.markdown)
        await self.storage.save_metrics(
            job_id=job_id,
            parser_name=parser_name,
            metrics={
                "structural_metrics": asdict(structural_metrics),
                "chunk_simulation": asdict(chunk_simulation),
            },
        )

    def _get_parser(self, parser_name: str) -> BaseParser:
        parser = self._parsers.get(parser_name)
        if parser is None:
            raise ValueError(f"Unsupported parser '{parser_name}'.")
        return parser

    def _get_execution_device(self, parser: BaseParser) -> str | None:
        method = getattr(parser, "get_execution_device", None)
        if callable(method):
            value = method()
            if value in {"cuda", "mps", "cpu"}:
                return value
        return None

    def _extract_execution_device(self, parse_result: ParseResult) -> str | None:
        metadata = parse_result.metadata
        if metadata is None:
            return None
        value = metadata.get("execution_device")
        if value in {"cuda", "mps", "cpu"}:
            return value
        return None

    def _extract_library_version(self, parse_result: ParseResult) -> str | None:
        metadata = parse_result.metadata
        if metadata is None:
            return None
        value = metadata.get("library_version")
        if isinstance(value, str):
            return value
        return None

    def _get_config_summary(
        self,
        parser: BaseParser,
        metadata: dict[str, object],
    ) -> dict[str, object]:
        existing = metadata.get("config_summary")
        if isinstance(existing, dict):
            return existing
        method = getattr(parser, "get_config_summary", None)
        if callable(method):
            config_summary = method()
            if isinstance(config_summary, dict):
                return config_summary
        return {}
