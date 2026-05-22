from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from parsearena.services.database import DatabaseService


class StorageService:
    def __init__(self, data_dir: Path, database: DatabaseService):
        self.data_dir = data_dir
        self.database = database
        self.data_dir.mkdir(parents=True, exist_ok=True)

    async def create_job(self) -> str:
        job_id = str(uuid4())
        job_dir = self.data_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        now = datetime.now(UTC).isoformat()
        await self.database.execute(
            """
            INSERT INTO jobs (
                job_id,
                filename,
                stored_pdf_name,
                page_count,
                size_bytes,
                status,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (job_id, "uploaded.pdf", None, 0, 0, "uploaded", now, now),
        )
        return job_id

    async def save_pdf(self, job_id: str, file_bytes: bytes, filename: str | None) -> Path:
        safe_filename = self._normalize_pdf_filename(filename)
        pdf_path = self._job_dir(job_id) / safe_filename
        pdf_path.write_bytes(file_bytes)
        await self.database.execute(
            """
            UPDATE jobs
            SET stored_pdf_name = ?, updated_at = ?
            WHERE job_id = ?
            """,
            (safe_filename, datetime.now(UTC).isoformat(), job_id),
        )
        return pdf_path

    async def get_pdf_path(self, job_id: str) -> Path:
        metadata = await self.get_metadata(job_id)
        stored_pdf_name = metadata.get("stored_pdf_name")
        if stored_pdf_name:
            pdf_path = self._job_dir(job_id) / stored_pdf_name
        else:
            pdf_path = self._job_dir(job_id) / "uploaded.pdf"
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found for job '{job_id}'.")
        return pdf_path

    async def update_job_metadata(
        self,
        job_id: str,
        *,
        filename: str,
        page_count: int,
        size_bytes: int,
    ) -> dict:
        await self.database.execute(
            """
            UPDATE jobs
            SET filename = ?, page_count = ?, size_bytes = ?, status = ?, updated_at = ?
            WHERE job_id = ?
            """,
            (
                filename,
                page_count,
                size_bytes,
                "uploaded",
                datetime.now(UTC).isoformat(),
                job_id,
            ),
        )
        return await self.get_metadata(job_id)

    async def save_result(
        self,
        job_id: str,
        parser_name: str,
        markdown: str,
        timing: float,
    ) -> None:
        job_dir = self._job_dir(job_id)
        markdown_path = job_dir / f"{parser_name}.md"
        markdown_path.write_text(markdown, encoding="utf-8")
        await self.update_parser_status(
            job_id=job_id,
            parser_name=parser_name,
            status="completed",
            elapsed_seconds=timing,
            error=None,
        )

    async def update_parser_status(
        self,
        job_id: str,
        parser_name: str,
        *,
        status: str,
        elapsed_seconds: float | None = None,
        error: str | None = None,
    ) -> dict:
        now = datetime.now(UTC).isoformat()
        started_at = now if status == "parsing" else None
        completed_at = now if status in {"completed", "error"} else None
        await self.database.execute(
            """
            INSERT INTO parser_results (
                job_id,
                parser_name,
                status,
                elapsed_seconds,
                error,
                started_at,
                completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id, parser_name) DO UPDATE SET
                status = excluded.status,
                elapsed_seconds = excluded.elapsed_seconds,
                error = excluded.error,
                started_at = COALESCE(parser_results.started_at, excluded.started_at),
                completed_at = excluded.completed_at
            """,
            (
                job_id,
                parser_name,
                status,
                elapsed_seconds,
                error,
                started_at,
                completed_at,
            ),
        )

        metadata = await self.get_metadata(job_id)
        parsers = metadata.get("parsers", {})
        if status == "parsing":
            metadata["status"] = "parsing"
        elif status == "error":
            metadata["status"] = "error"
        elif status == "completed":
            parser_states = {entry.get("status") for entry in parsers.values()}
            if parser_states and parser_states == {"completed"}:
                metadata["status"] = "completed"

        await self.database.execute(
            """
            UPDATE jobs
            SET status = ?, updated_at = ?
            WHERE job_id = ?
            """,
            (metadata["status"], now, job_id),
        )
        return await self.get_metadata(job_id)

    async def get_result(self, job_id: str, parser_name: str) -> dict:
        parser_row = await self.database.fetchone(
            """
            SELECT elapsed_seconds
            FROM parser_results
            WHERE job_id = ? AND parser_name = ?
            """,
            (job_id, parser_name),
        )
        if parser_row is None:
            raise FileNotFoundError(f"Result metadata not found for parser '{parser_name}'.")

        markdown_path = self._job_dir(job_id) / f"{parser_name}.md"
        if not markdown_path.exists():
            raise FileNotFoundError(f"Result file not found for parser '{parser_name}'.")

        return {
            "markdown": markdown_path.read_text(encoding="utf-8"),
            "elapsed_seconds": parser_row["elapsed_seconds"],
        }

    async def get_metadata(self, job_id: str) -> dict:
        job_row = await self.database.fetchone(
            """
            SELECT
                job_id,
                filename,
                stored_pdf_name,
                page_count,
                size_bytes,
                status,
                created_at,
                updated_at
            FROM jobs
            WHERE job_id = ?
            """,
            (job_id,),
        )
        if job_row is None:
            raise FileNotFoundError(f"Metadata not found for job '{job_id}'.")

        parser_rows = await self.database.fetchall(
            """
            SELECT
                parser_name,
                status,
                elapsed_seconds,
                error,
                queued_at,
                started_at,
                completed_at
            FROM parser_results
            WHERE job_id = ?
            """,
            (job_id,),
        )

        parsers = {
            row["parser_name"]: {
                "name": row["parser_name"],
                "status": row["status"],
                "elapsed_seconds": row["elapsed_seconds"],
                "error": row["error"],
            }
            for row in parser_rows
        }
        return {
            "job_id": job_row["job_id"],
            "filename": job_row["filename"],
            "stored_pdf_name": job_row["stored_pdf_name"],
            "page_count": job_row["page_count"],
            "size_bytes": job_row["size_bytes"],
            "status": job_row["status"],
            "created_at": job_row["created_at"],
            "updated_at": job_row["updated_at"],
            "parsers": parsers,
        }

    def _job_dir(self, job_id: str) -> Path:
        job_dir = self.data_dir / job_id
        if not job_dir.exists():
            raise FileNotFoundError(f"Job '{job_id}' not found.")
        return job_dir

    def _normalize_pdf_filename(self, filename: str | None) -> str:
        normalized = (filename or "uploaded.pdf").strip()
        normalized = Path(normalized).name
        if not normalized:
            normalized = "uploaded.pdf"
        if not normalized.lower().endswith(".pdf"):
            normalized = f"{normalized}.pdf"
        return normalized
