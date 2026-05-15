from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    event,
    insert,
    outerjoin,
    select,
    update,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Connection, Engine, Row

from app.schemas import TIME_POINTS

DEFAULT_CLASSROOM_NAME = "默认班级"
DEFAULT_CLASSROOM_SLUG = "default"
DEFAULT_GROUP_COUNT = 10
VALUE_COLUMNS = tuple(
    f"{prefix}_{point}" for point in TIME_POINTS for prefix in ("cool", "hot")
)

metadata = MetaData()

classrooms = Table(
    "classrooms",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String, nullable=False),
    Column("slug", String, nullable=False, unique=True),
    Column("group_count", Integer, nullable=False),
    Column("created_at", String, nullable=False),
)

groups = Table(
    "groups",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "classroom_id",
        Integer,
        ForeignKey("classrooms.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("name", String, nullable=False),
    Column("sort_order", Integer, nullable=False),
    UniqueConstraint("classroom_id", "sort_order"),
    UniqueConstraint("classroom_id", "name"),
)

temperature_records = Table(
    "temperature_records",
    metadata,
    Column(
        "group_id",
        Integer,
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("record_date", String, nullable=False),
    *(Column(column_name, Float, nullable=False) for column_name in VALUE_COLUMNS),
    Column("updated_at", String, nullable=False),
)

_ENGINE_CACHE: dict[str, Engine] = {}


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def _target_key(database_target: Path | str) -> str:
    if isinstance(database_target, Path):
        return f"sqlite+pysqlite:///{database_target.resolve().as_posix()}"
    return _normalize_database_url(database_target)


def _engine_for_target(database_target: Path | str) -> Engine:
    target_key = _target_key(database_target)
    engine = _ENGINE_CACHE.get(target_key)
    if engine is not None:
        return engine

    connect_args: dict[str, Any] = {}
    if target_key.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(
        target_key,
        future=True,
        connect_args=connect_args,
        pool_pre_ping=not target_key.startswith("sqlite"),
    )

    if target_key.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection: Any, _: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys = ON")
            try:
                cursor.execute("PRAGMA journal_mode = WAL")
            except sqlite3.DatabaseError:
                pass
            cursor.close()

    _ENGINE_CACHE[target_key] = engine
    return engine


def _row_to_dict(row: Row[Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row._mapping)


def _sqlite_connect(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(
        str(database_path), timeout=30, check_same_thread=False
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def _sqlite_table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (table_name,),
    ).fetchone()
    return row is not None


def _sqlite_groups_need_migration(connection: sqlite3.Connection) -> bool:
    if not _sqlite_table_exists(connection, "groups"):
        return False

    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(groups)").fetchall()
    }
    return "classroom_id" not in columns


def _generate_slug() -> str:
    return f"classroom-{uuid4().hex[:10]}"


def _sqlite_create_classrooms_table(connection: sqlite3.Connection) -> None:
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


def _sqlite_create_groups_table(connection: sqlite3.Connection) -> None:
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


def _sqlite_create_temperature_records_table(connection: sqlite3.Connection) -> None:
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


def _sqlite_migrate_legacy_schema(database_path: Path) -> None:
    if not database_path.exists():
        return

    with _sqlite_connect(database_path) as connection:
        if not _sqlite_groups_need_migration(connection):
            return

        _sqlite_create_classrooms_table(connection)
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
        if _sqlite_table_exists(connection, "temperature_records"):
            connection.execute(
                "ALTER TABLE temperature_records RENAME TO temperature_records_legacy"
            )
        connection.execute("ALTER TABLE groups RENAME TO groups_legacy")

        _sqlite_create_groups_table(connection)
        _sqlite_create_temperature_records_table(connection)

        connection.execute(
            """
            INSERT INTO groups (id, classroom_id, name, sort_order)
            SELECT id, ?, name, sort_order
            FROM groups_legacy
            ORDER BY sort_order
            """,
            (classroom_id,),
        )

        if _sqlite_table_exists(connection, "temperature_records_legacy"):
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
        connection.commit()


def _insert_group_rows(
    connection: Connection,
    classroom_id: int,
    group_count: int,
) -> None:
    connection.execute(
        insert(groups),
        [
            {
                "classroom_id": classroom_id,
                "name": f"第{index}组",
                "sort_order": index,
            }
            for index in range(1, group_count + 1)
        ],
    )


def _ensure_default_classroom(connection: Connection) -> None:
    row = connection.execute(
        select(classrooms.c.id).order_by(classrooms.c.created_at, classrooms.c.id).limit(1)
    ).first()
    if row:
        return

    created_at = datetime.now(timezone.utc).isoformat()
    result = connection.execute(
        insert(classrooms).values(
            name=DEFAULT_CLASSROOM_NAME,
            slug=DEFAULT_CLASSROOM_SLUG,
            group_count=DEFAULT_GROUP_COUNT,
            created_at=created_at,
        )
    )
    classroom_id = int(result.inserted_primary_key[0])
    _insert_group_rows(connection, classroom_id, DEFAULT_GROUP_COUNT)


def ensure_database(database_target: Path | str) -> None:
    if isinstance(database_target, Path):
        database_target.parent.mkdir(parents=True, exist_ok=True)
        _sqlite_migrate_legacy_schema(database_target)

    engine = _engine_for_target(database_target)
    metadata.create_all(engine)
    with engine.begin() as connection:
        _ensure_default_classroom(connection)


def list_classrooms(database_target: Path | str) -> list[dict[str, int | str]]:
    engine = _engine_for_target(database_target)
    with engine.connect() as connection:
        rows = connection.execute(
            select(
                classrooms.c.id,
                classrooms.c.name,
                classrooms.c.slug,
                classrooms.c.group_count,
                classrooms.c.created_at,
            ).order_by(classrooms.c.created_at.desc(), classrooms.c.id.desc())
        ).all()
    return [dict(row._mapping) for row in rows]


def get_classroom(
    database_target: Path | str, classroom_id: int
) -> dict[str, int | str] | None:
    engine = _engine_for_target(database_target)
    with engine.connect() as connection:
        row = connection.execute(
            select(
                classrooms.c.id,
                classrooms.c.name,
                classrooms.c.slug,
                classrooms.c.group_count,
                classrooms.c.created_at,
            ).where(classrooms.c.id == classroom_id)
        ).first()
    return _row_to_dict(row)


def get_classroom_by_slug(
    database_target: Path | str, classroom_slug: str
) -> dict[str, int | str] | None:
    engine = _engine_for_target(database_target)
    with engine.connect() as connection:
        row = connection.execute(
            select(
                classrooms.c.id,
                classrooms.c.name,
                classrooms.c.slug,
                classrooms.c.group_count,
                classrooms.c.created_at,
            ).where(classrooms.c.slug == classroom_slug)
        ).first()
    return _row_to_dict(row)


def create_classroom(
    database_target: Path | str,
    name: str,
    group_count: int,
) -> dict[str, int | str]:
    created_at = datetime.now(timezone.utc).isoformat()
    slug = _generate_slug()
    engine = _engine_for_target(database_target)

    with engine.begin() as connection:
        result = connection.execute(
            insert(classrooms).values(
                name=name,
                slug=slug,
                group_count=group_count,
                created_at=created_at,
            )
        )
        classroom_id = int(result.inserted_primary_key[0])
        _insert_group_rows(connection, classroom_id, group_count)

    return {
        "id": classroom_id,
        "name": name,
        "slug": slug,
        "group_count": group_count,
        "created_at": created_at,
    }


def list_groups(
    database_target: Path | str, classroom_id: int
) -> list[dict[str, int | str]]:
    engine = _engine_for_target(database_target)
    with engine.connect() as connection:
        rows = connection.execute(
            select(
                groups.c.id,
                groups.c.classroom_id,
                groups.c.name,
                groups.c.sort_order,
            )
            .where(groups.c.classroom_id == classroom_id)
            .order_by(groups.c.sort_order)
        ).all()
    return [dict(row._mapping) for row in rows]


def get_group(database_target: Path | str, group_id: int) -> dict[str, int | str] | None:
    engine = _engine_for_target(database_target)
    statement = (
        select(
            groups.c.id,
            groups.c.classroom_id,
            groups.c.name,
            groups.c.sort_order,
            classrooms.c.name.label("classroom_name"),
            classrooms.c.slug.label("classroom_slug"),
        )
        .select_from(groups.join(classrooms, classrooms.c.id == groups.c.classroom_id))
        .where(groups.c.id == group_id)
    )
    with engine.connect() as connection:
        row = connection.execute(statement).first()
    return _row_to_dict(row)


def get_group_in_classroom(
    database_target: Path | str,
    classroom_id: int,
    group_id: int,
) -> dict[str, int | str] | None:
    engine = _engine_for_target(database_target)
    statement = (
        select(
            groups.c.id,
            groups.c.classroom_id,
            groups.c.name,
            groups.c.sort_order,
            classrooms.c.name.label("classroom_name"),
            classrooms.c.slug.label("classroom_slug"),
        )
        .select_from(groups.join(classrooms, classrooms.c.id == groups.c.classroom_id))
        .where(groups.c.classroom_id == classroom_id, groups.c.id == group_id)
    )
    with engine.connect() as connection:
        row = connection.execute(statement).first()
    return _row_to_dict(row)


def get_record(
    database_target: Path | str, group_id: int
) -> dict[str, int | str | float] | None:
    engine = _engine_for_target(database_target)
    with engine.connect() as connection:
        row = connection.execute(
            select(
                temperature_records.c.group_id,
                temperature_records.c.record_date,
                temperature_records.c.updated_at,
                *[temperature_records.c[column] for column in VALUE_COLUMNS],
            ).where(temperature_records.c.group_id == group_id)
        ).first()
    return _row_to_dict(row)


def save_record(
    database_target: Path | str,
    group_id: int,
    record_date: str,
    values: dict[str, float],
) -> None:
    updated_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "group_id": group_id,
        "record_date": record_date,
        "updated_at": updated_at,
        **{column: values[column] for column in VALUE_COLUMNS},
    }
    engine = _engine_for_target(database_target)

    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            statement = pg_insert(temperature_records).values(**payload)
            upsert = statement.on_conflict_do_update(
                index_elements=[temperature_records.c.group_id],
                set_={
                    "record_date": statement.excluded.record_date,
                    "updated_at": statement.excluded.updated_at,
                    **{
                        column: getattr(statement.excluded, column)
                        for column in VALUE_COLUMNS
                    },
                },
            )
            connection.execute(upsert)
            return

        if connection.dialect.name == "sqlite":
            statement = sqlite_insert(temperature_records).values(**payload)
            upsert = statement.on_conflict_do_update(
                index_elements=[temperature_records.c.group_id],
                set_={
                    "record_date": statement.excluded.record_date,
                    "updated_at": statement.excluded.updated_at,
                    **{
                        column: getattr(statement.excluded, column)
                        for column in VALUE_COLUMNS
                    },
                },
            )
            connection.execute(upsert)
            return

        existing = connection.execute(
            select(temperature_records.c.group_id).where(
                temperature_records.c.group_id == group_id
            )
        ).first()
        if existing:
            connection.execute(
                update(temperature_records)
                .where(temperature_records.c.group_id == group_id)
                .values(**payload)
            )
        else:
            connection.execute(insert(temperature_records).values(**payload))


def list_groups_with_records(
    database_target: Path | str,
    classroom_id: int,
) -> list[dict[str, int | str | float | None]]:
    engine = _engine_for_target(database_target)
    join_clause = outerjoin(
        groups, temperature_records, groups.c.id == temperature_records.c.group_id
    )
    statement = (
        select(
            groups.c.id,
            groups.c.classroom_id,
            groups.c.name,
            groups.c.sort_order,
            temperature_records.c.record_date,
            temperature_records.c.updated_at,
            *[temperature_records.c[column] for column in VALUE_COLUMNS],
        )
        .select_from(join_clause)
        .where(groups.c.classroom_id == classroom_id)
        .order_by(groups.c.sort_order)
    )
    with engine.connect() as connection:
        rows = connection.execute(statement).all()
    return [dict(row._mapping) for row in rows]
