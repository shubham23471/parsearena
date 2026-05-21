from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from parsearena.config import Settings, get_settings
from parsearena.services.storage import StorageService


def get_app_settings() -> Settings:
    return get_settings()


@lru_cache(maxsize=1)
def _get_storage(data_dir: Path) -> StorageService:
    return StorageService(data_dir=data_dir)


def get_storage(settings: Settings = Depends(get_app_settings)) -> StorageService:
    return _get_storage(settings.data_dir)
