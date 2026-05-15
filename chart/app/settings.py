from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_value(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _env_path(name: str, default: str) -> Path:
    value = _env_value(name)
    return Path(value) if value is not None else Path(default)


def _env_flag(name: str, default: bool = False) -> bool:
    value = _env_value(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class Settings:
    database_url: str | None = field(default_factory=lambda: _env_value("DATABASE_URL"))
    database_path: Path = field(
        default_factory=lambda: _env_path("DATABASE_PATH", "data/classroom.sqlite3")
    )
    secret_key: str = field(
        default_factory=lambda: os.getenv("SECRET_KEY", "dev-secret-change-me")
    )
    teacher_password: str = field(
        default_factory=lambda: os.getenv("TEACHER_PASSWORD", "teacher123")
    )
    session_cookie_secure: bool = field(
        default_factory=lambda: _env_flag("SESSION_COOKIE_SECURE")
    )

    @property
    def database_target(self) -> Path | str:
        return self.database_url or self.database_path
