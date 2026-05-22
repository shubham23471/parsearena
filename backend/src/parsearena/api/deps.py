from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from parsearena.config import Settings, get_settings
from parsearena.services.parser_service import ParserService
from parsearena.services.database import DatabaseService
from parsearena.services.storage import StorageService


def get_app_settings() -> Settings:
    return get_settings()


@lru_cache(maxsize=1)
def _get_database(db_path: Path) -> DatabaseService:
    return DatabaseService(db_path=db_path)


def get_database(settings: Settings = Depends(get_app_settings)) -> DatabaseService:
    return _get_database(settings.db_path)


@lru_cache(maxsize=1)
def _get_storage(data_dir: Path, db_path: Path) -> StorageService:
    database = _get_database(db_path)
    return StorageService(data_dir=data_dir, database=database)


def get_storage(settings: Settings = Depends(get_app_settings)) -> StorageService:
    return _get_storage(settings.data_dir, settings.db_path)


def get_parser_service(storage: StorageService = Depends(get_storage)) -> ParserService:
    return ParserService(storage=storage)
