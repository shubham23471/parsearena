from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse

from parsearena.api.deps import get_parser_service, get_storage
from parsearena.schemas.jobs import JobMetadata, JobStatus, ParseResultResponse, ParseTriggerResponse
from parsearena.services.parser_service import ParserService
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


@router.post(
    "/jobs/{job_id}/parse",
    response_model=ParseTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def parse_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    parser_service: ParserService = Depends(get_parser_service),
) -> ParseTriggerResponse:
    parser_name = "pymupdf4llm"
    try:
        parser_service.mark_parsing(job_id, parser_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    background_tasks.add_task(parser_service.parse_job, job_id, parser_name)
    return ParseTriggerResponse(job_id=job_id, parser=parser_name, status="parsing")


@router.get("/jobs/{job_id}/status", response_model=JobStatus)
async def get_job_status(
    job_id: str,
    storage: StorageService = Depends(get_storage),
) -> JobStatus:
    try:
        metadata = storage.get_metadata(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return JobStatus(
        job_id=metadata["job_id"],
        status=metadata["status"],
        parsers=metadata.get("parsers", {}),
    )


@router.get("/jobs/{job_id}/results/{parser_name}", response_model=ParseResultResponse)
async def get_parse_result(
    job_id: str,
    parser_name: str,
    storage: StorageService = Depends(get_storage),
) -> ParseResultResponse:
    try:
        result = storage.get_result(job_id, parser_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ParseResultResponse.model_validate(result)
