"""Parser adapters and parser registry for ParseArena."""

from parsearena.parsers.pymupdf4llm import PyMuPDF4LLMParser
from parsearena.parsers.registry import ParserInfo, get_parser_registry

__all__ = ["ParserInfo", "PyMuPDF4LLMParser", "get_parser_registry"]
