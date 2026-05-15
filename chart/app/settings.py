from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class Settings:
    database_path: Path = field(
        default_factory=lambda: Path(
            os.getenv("DATABASE_PATH", "data/classroom.sqlite3")
        )
    )
    secret_key: str = field(
        default_factory=lambda: os.getenv("SECRET_KEY", "dev-secret-change-me")
    )
    teacher_password: str = field(
        default_factory=lambda: os.getenv("TEACHER_PASSWORD", "teacher123")
    )
