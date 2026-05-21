from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from parsearena.api.deps import get_storage
from parsearena.schemas.jobs import JobMetadata
from parsearena.services.storage import StorageService

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobMetadata)
async def get_job(job_id: str, storage: StorageService = Depends(get_storage)) -> JobMetadata:
    try:
        metadata = storage.get_metadata(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return JobMetadata.model_validate(metadata)


@router.get("/jobs/{job_id}/pdf")
async def get_job_pdf(job_id: str, storage: StorageService = Depends(get_storage)) -> FileResponse:
    try:
        pdf_path = storage.get_pdf_path(job_id)
        metadata = storage.get_metadata(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    filename = metadata.get("filename", "uploaded.pdf")
    return FileResponse(pdf_path, media_type="application/pdf", filename=filename)
