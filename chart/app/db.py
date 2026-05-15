from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.schemas import TIME_POINTS

DEFAULT_CLASSROOM_NAME = "默认班级"
DEFAULT_CLASSROOM_SLUG = "default"
DEFAULT_GROUP_COUNT = 10
VALUE_COLUMNS = tuple(
    f"{prefix}_{point}" for point in TIME_POINTS for prefix in ("cool", "hot")
)


def _connect(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(
        str(database_path), timeout=30, check_same_thread=False
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (table_name,),
    ).fetchone()
    return row is not None


def _groups_need_migration(connection: sqlite3.Connection) -> bool:
    if not _table_exists(connection, "groups"):
        return False

    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(groups)").fetchall()
    }
    return "classroom_id" not in columns


def _generate_slug() -> str:
    return f"classroom-{uuid4().hex[:10]}"


def _create_classrooms_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS classrooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            group_count INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )


def _create_groups_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            classroom_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
            UNIQUE(classroom_id, sort_order),
            UNIQUE(classroom_id, name)
        )
        """
    )


def _create_temperature_records_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS temperature_records (
            group_id INTEGER PRIMARY KEY,
            record_date TEXT NOT NULL,
            {", ".join(f"{column} REAL NOT NULL" for column in VALUE_COLUMNS)},
            updated_at TEXT NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
        """
    )


def _insert_group_rows(
    connection: sqlite3.Connection,
    classroom_id: int,
    group_count: int,
) -> None:
    connection.executemany(
        """
        INSERT INTO groups (classroom_id, name, sort_order)
        VALUES (?, ?, ?)
        """,
        [
            (classroom_id, f"第{index}组", index)
            for index in range(1, group_count + 1)
        ],
    )


def _ensure_default_classroom(connection: sqlite3.Connection) -> None:
    row = connection.execute(
        """
        SELECT id
        FROM classrooms
        ORDER BY created_at, id
        LIMIT 1
        """
    ).fetchone()
    if row:
        return

    created_at = datetime.now(timezone.utc).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO classrooms (name, slug, group_count, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            DEFAULT_CLASSROOM_NAME,
            DEFAULT_CLASSROOM_SLUG,
            DEFAULT_GROUP_COUNT,
            created_at,
        ),
    )
    _insert_group_rows(connection, int(cursor.lastrowid), DEFAULT_GROUP_COUNT)


def _migrate_legacy_schema(connection: sqlite3.Connection) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO classrooms (name, slug, group_count, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            DEFAULT_CLASSROOM_NAME,
            DEFAULT_CLASSROOM_SLUG,
            DEFAULT_GROUP_COUNT,
            created_at,
        ),
    )
    classroom_id = int(cursor.lastrowid)

    connection.execute("PRAGMA foreign_keys = OFF")
    if _table_exists(connection, "temperature_records"):
        connection.execute("ALTER TABLE temperature_records RENAME TO temperature_records_legacy")
    connection.execute("ALTER TABLE groups RENAME TO groups_legacy")

    _create_groups_table(connection)
    _create_temperature_records_table(connection)

    connection.execute(
        """
        INSERT INTO groups (id, classroom_id, name, sort_order)
        SELECT id, ?, name, sort_order
        FROM groups_legacy
        ORDER BY sort_order
        """,
        (classroom_id,),
    )

    if _table_exists(connection, "temperature_records_legacy"):
        connection.execute(
            f"""
            INSERT INTO temperature_records (
                group_id,
                record_date,
                {", ".join(VALUE_COLUMNS)},
                updated_at
            )
            SELECT
                group_id,
                record_date,
                {", ".join(VALUE_COLUMNS)},
                updated_at
            FROM temperature_records_legacy
            """
        )
        connection.execute("DROP TABLE temperature_records_legacy")

    connection.execute("DROP TABLE groups_legacy")
    connection.execute("PRAGMA foreign_keys = ON")


def ensure_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with _connect(database_path) as connection:
        _create_classrooms_table(connection)

        if _groups_need_migration(connection):
            _migrate_legacy_schema(connection)
        else:
            _create_groups_table(connection)
            _create_temperature_records_table(connection)

        _ensure_default_classroom(connection)
        connection.commit()


def list_classrooms(database_path: Path) -> list[dict[str, int | str]]:
    with _connect(database_path) as connection:
        rows = connection.execute(
            """
            SELECT id, name, slug, group_count, created_at
            FROM classrooms
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_classroom(
    database_path: Path, classroom_id: int
) -> dict[str, int | str] | None:
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT id, name, slug, group_count, created_at
            FROM classrooms
            WHERE id = ?
            """,
            (classroom_id,),
        ).fetchone()
    return dict(row) if row else None


def get_classroom_by_slug(
    database_path: Path, classroom_slug: str
) -> dict[str, int | str] | None:
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT id, name, slug, group_count, created_at
            FROM classrooms
            WHERE slug = ?
            """,
            (classroom_slug,),
        ).fetchone()
    return dict(row) if row else None


def create_classroom(
    database_path: Path,
    name: str,
    group_count: int,
) -> dict[str, int | str]:
    created_at = datetime.now(timezone.utc).isoformat()
    slug = _generate_slug()

    with _connect(database_path) as connection:
        cursor = connection.execute(
            """
            INSERT INTO classrooms (name, slug, group_count, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (name, slug, group_count, created_at),
        )
        classroom_id = int(cursor.lastrowid)
        _insert_group_rows(connection, classroom_id, group_count)
        connection.commit()

    return {
        "id": classroom_id,
        "name": name,
        "slug": slug,
        "group_count": group_count,
        "created_at": created_at,
    }


def list_groups(
    database_path: Path, classroom_id: int
) -> list[dict[str, int | str]]:
    with _connect(database_path) as connection:
        rows = connection.execute(
            """
            SELECT id, classroom_id, name, sort_order
            FROM groups
            WHERE classroom_id = ?
            ORDER BY sort_order
            """,
            (classroom_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_group(database_path: Path, group_id: int) -> dict[str, int | str] | None:
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT
                groups.id,
                groups.classroom_id,
                groups.name,
                groups.sort_order,
                classrooms.name AS classroom_name,
                classrooms.slug AS classroom_slug
            FROM groups
            INNER JOIN classrooms
                ON classrooms.id = groups.classroom_id
            WHERE groups.id = ?
            """,
            (group_id,),
        ).fetchone()
    return dict(row) if row else None


def get_group_in_classroom(
    database_path: Path,
    classroom_id: int,
    group_id: int,
) -> dict[str, int | str] | None:
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT
                groups.id,
                groups.classroom_id,
                groups.name,
                groups.sort_order,
                classrooms.name AS classroom_name,
                classrooms.slug AS classroom_slug
            FROM groups
            INNER JOIN classrooms
                ON classrooms.id = groups.classroom_id
            WHERE groups.classroom_id = ? AND groups.id = ?
            """,
            (classroom_id, group_id),
        ).fetchone()
    return dict(row) if row else None


def get_record(
    database_path: Path, group_id: int
) -> dict[str, int | str | float] | None:
    with _connect(database_path) as connection:
        row = connection.execute(
            f"""
            SELECT group_id, record_date, updated_at, {", ".join(VALUE_COLUMNS)}
            FROM temperature_records
            WHERE group_id = ?
            """,
            (group_id,),
        ).fetchone()
    return dict(row) if row else None


def save_record(
    database_path: Path,
    group_id: int,
    record_date: str,
    values: dict[str, float],
) -> None:
    updated_at = datetime.now(timezone.utc).isoformat()
    columns = ", ".join(VALUE_COLUMNS)
    placeholders = ", ".join("?" for _ in VALUE_COLUMNS)
    updates = ", ".join(f"{column} = excluded.{column}" for column in VALUE_COLUMNS)

    with _connect(database_path) as connection:
        connection.execute(
            f"""
            INSERT INTO temperature_records (
                group_id,
                record_date,
                {columns},
                updated_at
            )
            VALUES (?, ?, {placeholders}, ?)
            ON CONFLICT(group_id) DO UPDATE SET
                record_date = excluded.record_date,
                {updates},
                updated_at = excluded.updated_at
            """,
            (
                group_id,
                record_date,
                *[values[column] for column in VALUE_COLUMNS],
                updated_at,
            ),
        )
        connection.commit()


def list_groups_with_records(
    database_path: Path,
    classroom_id: int,
) -> list[dict[str, int | str | float | None]]:
    with _connect(database_path) as connection:
        rows = connection.execute(
            f"""
            SELECT
                groups.id,
                groups.classroom_id,
                groups.name,
                groups.sort_order,
                temperature_records.record_date,
                temperature_records.updated_at,
                {", ".join(f"temperature_records.{column}" for column in VALUE_COLUMNS)}
            FROM groups
            LEFT JOIN temperature_records
                ON groups.id = temperature_records.group_id
            WHERE groups.classroom_id = ?
            ORDER BY groups.sort_order
            """,
            (classroom_id,),
        ).fetchall()
    return [dict(row) for row in rows]
