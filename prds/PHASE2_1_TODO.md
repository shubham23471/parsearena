# Phase 2.1 TODO — SQLite Storage Migration & Parser Registry

- [x] Add SQLite database service with SQL-query migration runner (no Alembic).
- [x] Initialize database on FastAPI startup and ensure DB file lives under `DATA_DIR`.
- [x] Create core tables via SQL migrations: `jobs`, `parser_results`, `settings`.
- [x] Migrate `StorageService` metadata operations from JSON to SQLite queries.
- [x] Keep PDF and markdown file operations on disk (`data/{job_id}`) unchanged.
- [x] Preserve existing upload -> parse -> status -> results API behavior.
- [x] Add parser registry metadata + runtime availability checks for 5 parsers.
- [x] Add parser schema model and `GET /api/v1/parsers` endpoint.
- [x] Add `db_path` setting in backend config (default `data/parsearena.db`).
- [x] Add `aiosqlite` to backend dependencies (`pyproject.toml`).
