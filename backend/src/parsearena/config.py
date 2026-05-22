from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    data_dir: Path = Path("./data")
    db_path: Path | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    max_upload_size_mb: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            items = [origin.strip() for origin in value.split(",")]
            return [origin for origin in items if origin]
        return value

    @model_validator(mode="after")
    def set_default_db_path(self) -> Settings:
        if self.db_path is None:
            self.db_path = self.data_dir / "parsearena.db"
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
