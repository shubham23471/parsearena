from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class StorageService:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def create_job(self) -> str:
        job_id = str(uuid4())
        job_dir = self.data_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        metadata = {
            "job_id": job_id,
            "created_at": datetime.now(UTC).isoformat(),
            "status": "uploaded",
            "parsers": {},
        }
        self._write_metadata(job_id, metadata)
        return job_id

    def save_pdf(self, job_id: str, file_bytes: bytes, filename: str | None) -> Path:
        safe_filename = self._normalize_pdf_filename(filename)
        pdf_path = self._job_dir(job_id) / safe_filename
        pdf_path.write_bytes(file_bytes)
        metadata = self.get_metadata(job_id)
        metadata["stored_pdf_name"] = safe_filename
        self._write_metadata(job_id, metadata)
        return pdf_path

    def get_pdf_path(self, job_id: str) -> Path:
        metadata = self.get_metadata(job_id)
        stored_pdf_name = metadata.get("stored_pdf_name")
        if stored_pdf_name:
            pdf_path = self._job_dir(job_id) / stored_pdf_name
        else:
            pdf_path = self._job_dir(job_id) / "uploaded.pdf"
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found for job '{job_id}'.")
        return pdf_path

    def update_job_metadata(
        self,
        job_id: str,
        *,
        filename: str,
        page_count: int,
        size_bytes: int,
    ) -> dict:
        metadata = self.get_metadata(job_id)
        metadata.update(
            {
                "filename": filename,
                "page_count": page_count,
                "size_bytes": size_bytes,
                "status": "uploaded",
            }
        )
        self._write_metadata(job_id, metadata)
        return metadata

    def save_result(
        self,
        job_id: str,
        parser_name: str,
        markdown: str,
        timing: float,
    ) -> None:
        job_dir = self._job_dir(job_id)
        markdown_path = job_dir / f"{parser_name}.md"
        markdown_path.write_text(markdown, encoding="utf-8")

        metadata = self.get_metadata(job_id)
        parsers = metadata.get("parsers", {})
        parsers[parser_name] = {
            "name": parser_name,
            "status": "completed",
            "elapsed_seconds": timing,
            "error": None,
        }
        metadata["parsers"] = parsers
        metadata["status"] = "completed"
        self._write_metadata(job_id, metadata)

    def get_metadata(self, job_id: str) -> dict:
        metadata_path = self._metadata_path(job_id)
        if not metadata_path.exists():
            raise FileNotFoundError(f"Metadata not found for job '{job_id}'.")
        return json.loads(metadata_path.read_text(encoding="utf-8"))

    def _job_dir(self, job_id: str) -> Path:
        job_dir = self.data_dir / job_id
        if not job_dir.exists():
            raise FileNotFoundError(f"Job '{job_id}' not found.")
        return job_dir

    def _metadata_path(self, job_id: str) -> Path:
        return self.data_dir / job_id / "metadata.json"

    def _normalize_pdf_filename(self, filename: str | None) -> str:
        normalized = (filename or "uploaded.pdf").strip()
        normalized = Path(normalized).name
        if not normalized:
            normalized = "uploaded.pdf"
        if not normalized.lower().endswith(".pdf"):
            normalized = f"{normalized}.pdf"
        return normalized

    def _write_metadata(self, job_id: str, payload: dict) -> None:
        metadata_path = self._metadata_path(job_id)
        metadata_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=True),
            encoding="utf-8",
        )
