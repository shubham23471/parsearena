"""Parser adapters and parser registry for ParseArena."""

from parsearena.parsers.docling_parser import DoclingParser
from parsearena.parsers.marker_parser import MarkerParser
from parsearena.parsers.pymupdf4llm import PyMuPDF4LLMParser
from parsearena.parsers.registry import ParserInfo, get_parser_registry
from parsearena.parsers.unstructured_parser import UnstructuredParser

__all__ = [
    "DoclingParser",
    "MarkerParser",
    "ParserInfo",
    "PyMuPDF4LLMParser",
    "UnstructuredParser",
    "get_parser_registry",
]
