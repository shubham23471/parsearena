from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from parsearena.api.deps import get_app_settings, get_storage
from parsearena.config import Settings
from parsearena.schemas.jobs import UploadResponse
from parsearena.services.storage import StorageService

router = APIRouter(tags=["upload"])


def _is_pdf(upload: UploadFile) -> bool:
    filename = upload.filename or ""
    extension_is_pdf = filename.lower().endswith(".pdf")
    content_type = (upload.content_type or "").lower()
    content_type_is_pdf = content_type in {"application/pdf", "application/x-pdf"}
    return extension_is_pdf or content_type_is_pdf


def _extract_page_count(pdf_path: Path) -> int:
    try:
        import pymupdf
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Missing dependency 'pymupdf'. Install with: uv add pymupdf") from exc

    try:
        with pymupdf.open(pdf_path) as document:
            return document.page_count
    except Exception as exc:
        raise ValueError("Unable to read PDF pages. The file may be corrupted.") from exc


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_app_settings),
    storage: StorageService = Depends(get_storage),
) -> UploadResponse:
    if not _is_pdf(file):
        raise HTTPException(status_code=422, detail="Invalid file type. Only PDF uploads are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=422,
            detail=f"File is too large. Max allowed size is {settings.max_upload_size_mb}MB.",
        )

    job_id = await storage.create_job()
    pdf_path = await storage.save_pdf(job_id, file_bytes, file.filename)
    try:
        page_count = _extract_page_count(pdf_path)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filename = file.filename or "uploaded.pdf"
    metadata = await storage.update_job_metadata(
        job_id,
        filename=filename,
        page_count=page_count,
        size_bytes=len(file_bytes),
    )

    return UploadResponse.model_validate(metadata)
