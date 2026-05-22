from __future__ import annotations

import importlib
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


PARSER_DEFINITIONS: list[_ParserDefinition] = [
    _ParserDefinition(
        name="pymupdf4llm",
        display_name="PyMuPDF4LLM",
        description="Fast local markdown extraction using PyMuPDF4LLM.",
        is_local=True,
        requires_api_key=False,
        api_key_env_var=None,
        install_command="uv add pymupdf4llm",
        module_to_probe="pymupdf4llm",
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
    ),
]


def _is_module_available(module_name: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False


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
        )
        for definition in PARSER_DEFINITIONS
    ]
