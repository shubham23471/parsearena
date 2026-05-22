from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import aiosqlite


type Migration = tuple[int, Sequence[str]]


MIGRATIONS: list[Migration] = [
    (
        1,
        (
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                stored_pdf_name TEXT,
                page_count INTEGER NOT NULL DEFAULT 0,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'uploaded',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS parser_results (
                job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
                parser_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                elapsed_seconds REAL,
                error TEXT,
                queued_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                PRIMARY KEY (job_id, parser_name)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """,
        ),
    ),
    (
        2,
        (
            """
            ALTER TABLE parser_results
            ADD COLUMN execution_device TEXT;
            """,
        ),
    ),
]


class DatabaseService:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    async def init_db(self) -> None:
        async with aiosqlite.connect(self.db_path) as connection:
            await connection.execute("PRAGMA journal_mode=WAL;")
            await connection.execute("PRAGMA foreign_keys=ON;")
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )

            cursor = await connection.execute("SELECT version FROM schema_migrations")
            applied_versions = {row[0] for row in await cursor.fetchall()}

            for version, statements in MIGRATIONS:
                if version in applied_versions:
                    continue
                for statement in statements:
                    await connection.execute(statement)
                await connection.execute(
                    "INSERT INTO schema_migrations(version) VALUES (?)",
                    (version,),
                )

            await connection.commit()

    async def execute(self, query: str, params: Sequence[object] = ()) -> None:
        async with aiosqlite.connect(self.db_path) as connection:
            await connection.execute("PRAGMA foreign_keys=ON;")
            await connection.execute(query, params)
            await connection.commit()

    async def fetchone(
        self,
        query: str,
        params: Sequence[object] = (),
    ) -> aiosqlite.Row | None:
        async with aiosqlite.connect(self.db_path) as connection:
            await connection.execute("PRAGMA foreign_keys=ON;")
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(query, params)
            return await cursor.fetchone()

    async def fetchall(
        self,
        query: str,
        params: Sequence[object] = (),
    ) -> list[aiosqlite.Row]:
        async with aiosqlite.connect(self.db_path) as connection:
            await connection.execute("PRAGMA foreign_keys=ON;")
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(query, params)
            return await cursor.fetchall()
