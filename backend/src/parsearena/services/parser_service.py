from __future__ import annotations

import asyncio

from parsearena.parsers import DoclingParser, MarkerParser, PyMuPDF4LLMParser, UnstructuredParser
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
        await self.storage.update_parser_status(
            job_id=job_id,
            parser_name=parser_name,
            status="running",
            elapsed_seconds=None,
            error=None,
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
                )

    async def _save_parse_result(self, job_id: str, parser_name: str, parse_result: ParseResult) -> None:
        await self.storage.save_result(
            job_id=job_id,
            parser_name=parser_name,
            markdown=parse_result.markdown,
            timing=parse_result.elapsed_seconds,
        )

    def _get_parser(self, parser_name: str) -> BaseParser:
        parser = self._parsers.get(parser_name)
        if parser is None:
            raise ValueError(f"Unsupported parser '{parser_name}'.")
        return parser
