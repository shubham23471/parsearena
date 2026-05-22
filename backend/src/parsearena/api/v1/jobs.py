from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse

from parsearena.api.deps import get_parser_service, get_storage
from parsearena.schemas.jobs import (
    AllResultsResponse,
    JobMetadata,
    JobStatus,
    ParseRequest,
    ParseResultResponse,
    ParseTriggerResponse,
)
from parsearena.services.parser_service import ParserService
from parsearena.services.storage import StorageService

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobMetadata)
async def get_job(job_id: str, storage: StorageService = Depends(get_storage)) -> JobMetadata:
    try:
        metadata = await storage.get_metadata(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return JobMetadata.model_validate(metadata)


@router.get("/jobs/{job_id}/pdf")
async def get_job_pdf(job_id: str, storage: StorageService = Depends(get_storage)) -> FileResponse:
    try:
        pdf_path = await storage.get_pdf_path(job_id)
        metadata = await storage.get_metadata(job_id)
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
    parse_request: ParseRequest | None = None,
    parser_service: ParserService = Depends(get_parser_service),
) -> ParseTriggerResponse:
    try:
        selected_parsers = parser_service.validate_parser_selection(
            parse_request.parsers if parse_request else [],
        )
        parser_statuses = await parser_service.start_multi_parse(job_id, selected_parsers)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    background_tasks.add_task(parser_service.run_parsers, job_id, selected_parsers)
    return ParseTriggerResponse(job_id=job_id, parsers=parser_statuses)


@router.get("/jobs/{job_id}/status", response_model=JobStatus)
async def get_job_status(
    job_id: str,
    storage: StorageService = Depends(get_storage),
) -> JobStatus:
    try:
        metadata = await storage.get_metadata(job_id)
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
        result = await storage.get_result(job_id, parser_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ParseResultResponse.model_validate(result)


@router.get("/jobs/{job_id}/results", response_model=AllResultsResponse)
async def get_all_parse_results(
    job_id: str,
    storage: StorageService = Depends(get_storage),
) -> AllResultsResponse:
    try:
        results = await storage.get_all_results(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return AllResultsResponse(job_id=job_id, results=results)
