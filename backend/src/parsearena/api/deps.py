from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from parsearena.config import Settings, get_settings
from parsearena.services.parser_service import ParserService
from parsearena.services.storage import StorageService


def get_app_settings() -> Settings:
    return get_settings()


@lru_cache(maxsize=1)
def _get_storage(data_dir: Path) -> StorageService:
    return StorageService(data_dir=data_dir)


def get_storage(settings: Settings = Depends(get_app_settings)) -> StorageService:
    return _get_storage(settings.data_dir)


def get_parser_service(storage: StorageService = Depends(get_storage)) -> ParserService:
    return ParserService(storage=storage)
