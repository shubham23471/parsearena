from __future__ import annotations

from fastapi import APIRouter

from parsearena.api.v1.health import router as health_router
from parsearena.api.v1.jobs import router as jobs_router
from parsearena.api.v1.parsers import router as parsers_router
from parsearena.api.v1.upload import router as upload_router

router = APIRouter()
router.include_router(health_router)
router.include_router(upload_router)
router.include_router(jobs_router)
router.include_router(parsers_router)
