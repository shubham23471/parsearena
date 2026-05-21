# Phase 1.1 Implementation TODO

- [x] Create backend `uv` project scaffold with `pyproject.toml` and Python `3.12`.
- [x] Add `src/parsearena/` package layout (`api`, `schemas`, `services`, `parsers`).
- [x] Implement configuration via `pydantic-settings` with:
  - [x] `DATA_DIR` defaulting to `./data`
  - [x] `CORS_ORIGINS` defaulting to `http://localhost:3000`
  - [x] `MAX_UPLOAD_SIZE_MB` defaulting to `50`
- [x] Implement FastAPI app factory and lifespan hook in `parsearena.main`.
- [x] Add CORS middleware allowing frontend origin(s).
- [x] Mount API router under `/api/v1`.
- [x] Implement `GET /api/v1/health` returning `{"status":"ok"}`.
- [x] Add `backend/.env.example` with documented defaults.
- [x] Add runtime `backend/data/` directory scaffold (`.gitkeep`).
- [x] Generate `uv.lock` after dependency resolution (`uv lock`).
- [x] Verify run command: `uv run uvicorn parsearena.main:app --reload`.
- [x] Verify health command: `curl localhost:8000/api/v1/health`.
