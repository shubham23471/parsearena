from __future__ import annotations

from parsearena.parsers.base import BaseParser, ParseResult
from parsearena.parsers.pymupdf4llm import PyMuPDF4LLMParser
from parsearena.services.storage import StorageService


class ParserService:
    def __init__(self, storage: StorageService):
        self.storage = storage
        self._parsers: dict[str, BaseParser] = {
            "pymupdf4llm": PyMuPDF4LLMParser(),
        }

    async def mark_parsing(self, job_id: str, parser_name: str) -> dict:
        await self.storage.get_pdf_path(job_id)
        parser_state = (await self.storage.get_metadata(job_id)).get("parsers", {}).get(parser_name, {})
        existing_status = parser_state.get("status")
        if existing_status == "parsing":
            raise ValueError(f"Parser '{parser_name}' is already running for this job.")
        if existing_status == "completed":
            raise ValueError(f"Parser '{parser_name}' has already completed for this job.")

        return await self.storage.update_parser_status(
            job_id,
            parser_name,
            status="parsing",
            elapsed_seconds=None,
            error=None,
        )

    async def parse_job(self, job_id: str, parser_name: str) -> None:
        parser = self._get_parser(parser_name)
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
