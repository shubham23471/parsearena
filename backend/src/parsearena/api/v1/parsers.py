from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter

from parsearena.parsers.registry import get_parser_registry
from parsearena.schemas.parsers import ParserInfoResponse

router = APIRouter(tags=["parsers"])


@router.get("/parsers", response_model=list[ParserInfoResponse])
async def list_parsers() -> list[ParserInfoResponse]:
    parser_info = get_parser_registry()
    return [ParserInfoResponse.model_validate(asdict(item)) for item in parser_info]
