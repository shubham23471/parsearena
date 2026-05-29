from __future__ import annotations

import importlib
import importlib.metadata
from dataclasses import dataclass


@dataclass(slots=True)
class ParserInfo:
    name: str
    display_name: str
    description: str
    is_local: bool
    requires_api_key: bool
    api_key_env_var: str | None
    install_command: str
    is_available: bool
    library_version: str | None


@dataclass(slots=True)
class _ParserDefinition:
    name: str
    display_name: str
    description: str
    is_local: bool
    requires_api_key: bool
    api_key_env_var: str | None
    install_command: str
    module_to_probe: str
    package_name: str


PARSER_DEFINITIONS: list[_ParserDefinition] = [
    _ParserDefinition(
        name="pymupdf4llm",
        display_name="PyMuPDF4LLM (Baseline)",
        description="Fast local markdown extraction using PyMuPDF4LLM.",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add pymupdf4llm",
        module_to_probe="pymupdf4llm",
        package_name="pymupdf4llm",
    ),
    _ParserDefinition(
        name="docling",
        display_name="Docling",
        description="IBM document AI parser with strong layout and table extraction.",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add docling",
        module_to_probe="docling",
        package_name="docling",
    ),
    _ParserDefinition(
        name="marker",
        display_name="Marker",
        description="High-quality local parser tuned for document OCR and structure.",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add marker-pdf",
        module_to_probe="marker",
        package_name="marker-pdf",
    ),
    _ParserDefinition(
        name="unstructured",
        display_name="Unstructured",
        description="General-purpose document parser using Unstructured's PDF partitioning pipeline.",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add \"unstructured[pdf]\"",
        module_to_probe="unstructured",
        package_name="unstructured",
    ),
    _ParserDefinition(
        name="markitdown",
        display_name="MarkItDown",
        description="Microsoft parser for converting PDFs and other document formats to Markdown (CPU pipeline).",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add \"markitdown[pdf]\"",
        module_to_probe="markitdown",
        package_name="markitdown",
    ),
]


def _is_module_available(module_name: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False


def _get_library_version(package_name: str) -> str | None:
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return None


def get_parser_registry() -> list[ParserInfo]:
    return [
        ParserInfo(
            name=definition.name,
            display_name=definition.display_name,
            description=definition.description,
            is_local=definition.is_local,
            requires_api_key=definition.requires_api_key,
            api_key_env_var=definition.api_key_env_var,
            install_command=definition.install_command,
            is_available=_is_module_available(definition.module_to_probe),
            library_version=_get_library_version(definition.package_name),
        )
        for definition in PARSER_DEFINITIONS
    ]
