from __future__ import annotations

from pydantic import BaseModel


class ParserInfoResponse(BaseModel):
    name: str
    display_name: str
    description: str
    is_local: bool
    requires_api_key: bool
    api_key_env_var: str | None = None
    install_command: str
    is_available: bool
