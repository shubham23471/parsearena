# Phase 2 — Multi-Parser Support

**Parent PRD:** `prds/PRD.md`
**Depends on:** Phase 1 (complete)
**Goal:** Integrate all 4 parsers (PyMuPDF4LLM, Docling, Marker, Unstructured), run them in parallel against a single PDF, and track per-parser progress in real time.

**Estimated Effort:** 6–8 days across 5 sub-phases

---

## What Phase 1 Gave Us (Build Surface)

Before planning, here's what exists and what Phase 2 builds on top of:

| Layer | What exists | What Phase 2 changes |
|-------|------------|----------------------|
| **Parser protocol** | `BaseParser` Protocol in `parsers/base.py` with `name: str` + `async parse(pdf_path) → ParseResult` | Extend `ParseResult` with optional metadata. Add parser registry with availability detection. |
| **Parser adapter** | `PyMuPDF4LLMParser` in `parsers/pymupdf4llm.py` using `asyncio.to_thread()` | Add 3 new adapters following the same pattern. |
| **Parser service** | `ParserService` in `services/parser_service.py` — single-parser execution with `mark_parsing()` + `parse_job()` | Extend to accept multiple parsers, run in parallel, isolate errors. |
| **Storage** | `StorageService` in `services/storage.py` — JSON `metadata.json` per job, files on disk | **Migrate metadata to SQLite** for safe concurrent writes. Keep PDF/markdown files on disk. |
| **Schemas** | `UploadResponse`, `JobMetadata`, `JobStatus`, `ParserStatus`, `ParseTriggerResponse`, `ParseResultResponse` in `schemas/jobs.py` | Add `ParserInfo`, `ParseRequest`. Update `ParseTriggerResponse` for multi-parser. |
| **API** | `POST /parse` hardcoded to pymupdf4llm, `GET /status`, `GET /results/{parser}` | Update `/parse` to accept parser list, add `GET /parsers`, `GET /results` (all). |
| **Config** | `Settings` in `config.py` — `DATA_DIR`, `CORS_ORIGINS`, `MAX_UPLOAD_SIZE_MB` | Add `DB_PATH`. |
| **Frontend** | Upload → single parse → two-panel PDF+Markdown view | Add parser selection checkboxes, per-parser progress bars, tabbed multi-result view. |

---

## Architecture Decision: SQLite for Job Tracking

**Problem:** The current `metadata.json` approach does a read → modify → write cycle on every status update. With 5 parsers updating status concurrently, this creates race conditions. JSON file locking is fragile and platform-dependent.

**Decision:** Migrate job/parser metadata to **SQLite**.

**Why SQLite (not Postgres, not keep JSON):**

| Option | Pros | Cons |
|--------|------|------|
| JSON + file locks | No new deps | Race conditions, fragile locking, no query capability |
| **SQLite** | **Zero config, part of Python stdlib, handles concurrent writes, single file, perfect for local tool, easy to query** | Slight migration effort |
| Postgres | Full-featured, scalable | Massive overkill for single-user local tool, requires separate server, hostile to "clone & run" open-source UX |

SQLite is the right fit for an open-source local-first tool. It's a single `parsearena.db` file inside `data/`. Users never have to install or configure anything. If ParseArena ever needs Postgres (multi-user hosted version), the migration is straightforward — the SQL patterns are identical.

**What moves to SQLite:** Job metadata, parser result status, settings (API keys).
**What stays on disk:** PDF files (`data/{job_id}/original.pdf`), markdown outputs (`data/{job_id}/{parser}.md`).

### SQLite Schema

```sql
CREATE TABLE jobs (
    job_id       TEXT PRIMARY KEY,
    filename     TEXT NOT NULL,
    stored_pdf_name TEXT,
    page_count   INTEGER,
    size_bytes   INTEGER,
    status       TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded | parsing | completed | error
    created_at   TEXT NOT NULL,                      -- ISO 8601
    updated_at   TEXT NOT NULL
);

CREATE TABLE parser_results (
    job_id         TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    parser_name    TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',  -- pending | queued | running | completed | error
    elapsed_seconds REAL,
    error          TEXT,
    queued_at      TEXT,
    started_at     TEXT,
    completed_at   TEXT,
    PRIMARY KEY (job_id, parser_name)
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## Parser Inventory

| Parser | Package | Type | Requires API Key | Python API | Heavy Deps |
|--------|---------|------|-----------------|------------|------------|
| **PyMuPDF4LLM** | `pymupdf4llm` | Local | No | `pymupdf4llm.to_markdown(path)` | None (already installed) |
| **Docling** | `docling` | Local | No | `DocumentConverter().convert(path).document.export_to_markdown()` | ML models (~2.5 min first-run download) |
| **Marker** | `marker-pdf` | Local | No | `PdfConverter(artifact_dict=create_model_dict())(path)` | PyTorch, surya OCR models |
| **Unstructured** | `unstructured[pdf]` | Local | No | `partition_pdf(filename=path)` → elements joined as text | tesseract-ocr, poppler-utils, layout models |

### Dependency Reality Check

Docling, Marker, and Unstructured each pull in ML model weights and/or system dependencies. These are **not** auto-installed. The parser registry reports availability by probing imports. If a parser isn't installed, the UI shows the install command and disables the checkbox.

---

## Sub-Phase Breakdown

### Phase 2.1 — SQLite Storage Migration & Parser Registry

**Goal:** Replace JSON metadata with SQLite for concurrent-safe status tracking. Build the parser registry that reports which parsers are available.

**Deliverables:**

- `services/database.py`: SQLite database manager
  - `init_db()` — creates tables if not exist, runs on app startup via lifespan
  - Uses `aiosqlite` for async access (or `sqlite3` with `asyncio.to_thread()`)
  - Connection pool / single connection with WAL mode for concurrent reads
  - Database file at `{DATA_DIR}/parsearena.db`
- Migrate `StorageService` methods to use SQLite:
  - `create_job()` → INSERT into `jobs` table
  - `update_job_metadata()` → UPDATE `jobs`
  - `get_metadata()` → SELECT from `jobs` + `parser_results`
  - `update_parser_status()` → UPSERT into `parser_results`
  - `get_result()` → SELECT from `parser_results` + read markdown file from disk
  - Keep `save_pdf()`, `get_pdf_path()`, `save_result()` (file operations) — these still touch disk
- `parsers/registry.py`: Parser registry
  - `ParserInfo` dataclass: `name`, `display_name`, `description`, `is_local`, `install_command`, `is_available` (runtime check)
  - `get_parser_registry() → list[ParserInfo]` — returns metadata for all 4 parsers
  - Availability check: try importing the parser's key module, catch `ImportError`
- `schemas/parsers.py`: `ParserInfoResponse` Pydantic model
- `api/v1/parsers.py`: `GET /api/v1/parsers` endpoint — returns list of parsers with availability status
- Update `config.py`: add `db_path: Path` (defaults to `{DATA_DIR}/parsearena.db`)
- Add `aiosqlite` to `pyproject.toml` dependencies
- Remove JSON metadata read/write from `StorageService` (replaced by SQLite)

**Definition of Done:**
- All existing functionality works identically but backed by SQLite instead of JSON
- `GET /api/v1/parsers` returns a list of 4 parsers with `is_available` reflecting actual install status
- Database file is created automatically on first startup
- Existing upload → parse → results flow still works end-to-end

---

### Phase 2.2 — Parser Adapter Implementations

**Goal:** Implement the 3 new parser adapters following the established `BaseParser` protocol.

**Deliverables:**

- `parsers/docling_parser.py`: Docling adapter
  ```python
  # Core API:
  from docling.document_converter import DocumentConverter
  converter = DocumentConverter()
  result = converter.convert(str(pdf_path))
  markdown = result.document.export_to_markdown()
  ```
  - CPU-bound, runs via `asyncio.to_thread()`
  - First run downloads models (~2.5 min) — adapter should handle gracefully
  - Catches `ImportError` and raises clear error if `docling` not installed

- `parsers/marker_parser.py`: Marker adapter
  ```python
  # Core API:
  from marker.converters.pdf import PdfConverter
  from marker.models import create_model_dict
  from marker.output import text_from_rendered
  converter = PdfConverter(artifact_dict=create_model_dict())
  rendered = converter(str(pdf_path))
  text, _, images = text_from_rendered(rendered)
  ```
  - CPU/GPU-bound, runs via `asyncio.to_thread()`
  - Model dict created once and reused (cache in class instance)
  - Catches `ImportError` if `marker-pdf` not installed

- `parsers/unstructured_parser.py`: Unstructured adapter
  ```python
  # Core API:
  from unstructured.partition.pdf import partition_pdf
  elements = partition_pdf(filename=str(pdf_path))
  markdown = "\n\n".join(str(el) for el in elements)
  ```
  - CPU-bound, runs via `asyncio.to_thread()`
  - Requires system deps: `tesseract-ocr`, `poppler-utils`
  - Catches `ImportError` if `unstructured` not installed

- Update `parsers/__init__.py`: export all parsers
- Update `ParseResult` in `parsers/base.py`:
  - Add optional `metadata: dict[str, Any] | None = None` field for parser-specific extra info (e.g., Marker image count, element counts)

**Dependency install commands** (documented, NOT auto-installed):
```bash
# Docling
uv add docling

# Marker
uv add marker-pdf

# Unstructured (PDF support)
uv add "unstructured[pdf]"
# Also requires system packages: tesseract-ocr, poppler-utils
```

**Definition of Done:**
- Each adapter can parse a sample PDF and return `ParseResult` with markdown and timing
- Each adapter handles missing dependencies with a clear error message
- Each adapter handles parse failures gracefully (returns error, doesn't crash)
- PyMuPDF4LLM adapter remains unchanged and still works

---

### Phase 2.3 — Multi-Parser Execution Engine

**Goal:** Update the parse API to accept multiple parsers, execute them in parallel, and track progress per-parser in real time.

**Deliverables:**

- `schemas/jobs.py` updates:
  - `ParseRequest(BaseModel)`: `parsers: list[str]` — list of parser names to run
  - Update `ParseTriggerResponse`: `parsers: dict[str, str]` — maps parser name → initial status
  - Add `AllResultsResponse(BaseModel)`: `results: dict[str, ParseResultResponse | None]` — all parser results for a job
  - Update `ParserStatus`: add `queued_at`, `started_at`, `completed_at` fields

- `services/parser_service.py` rewrite:
  - `ParserService.__init__()` — registers all 4 parsers (only instantiates available ones)
  - `get_available_parsers() → list[str]` — returns names of installed parsers
  - `validate_parser_selection(parsers: list[str])` — checks all requested parsers are available
  - `start_multi_parse(job_id: str, parser_names: list[str])` — marks all as "queued", returns immediately
  - `run_parsers(job_id: str, parser_names: list[str])` — the background task:
    - Creates an `asyncio.TaskGroup` (or `asyncio.gather` with `return_exceptions=True`)
    - Each parser task: mark "running" → call adapter → mark "completed" or "error"
    - **Error isolation**: one parser failing does NOT cancel others
    - Updates SQLite status at each transition
  - Thread pool executor sized to `min(len(parsers), 3)` to avoid overwhelming the machine

- `api/v1/jobs.py` updates:
  - `POST /api/v1/jobs/{job_id}/parse`:
    - Accepts `ParseRequest` body with `parsers` list
    - Validates all parsers are available
    - If `parsers` is empty or omitted, defaults to all available parsers
    - Returns `202 Accepted` with initial status for each parser
    - Spawns background task via `BackgroundTasks`
  - `GET /api/v1/jobs/{job_id}/status`:
    - Returns per-parser status from SQLite (fast reads due to WAL mode)
    - Includes `queued_at`, `started_at`, `completed_at` timestamps
  - `GET /api/v1/jobs/{job_id}/results`:
    - Returns all completed parser results in one response
    - Parsers still running or errored are included with `null` markdown
  - `GET /api/v1/jobs/{job_id}/results/{parser_name}` — unchanged (single parser result)

- Job-level status derivation:
  - `status = "parsing"` if any parser is `queued` or `running`
  - `status = "completed"` if all parsers are `completed` (or `error`)
  - `status = "error"` if all parsers errored

**Definition of Done:**
- `POST /parse` with `{"parsers": ["pymupdf4llm", "docling"]}` triggers both in parallel
- Polling `GET /status` shows each parser's progress independently
- If Docling fails but PyMuPDF4LLM succeeds, the job still shows results for PyMuPDF4LLM
- 4 parsers running in parallel on a 5-page PDF complete without deadlocks or race conditions
- `GET /results` returns all completed parser outputs in one call

---

### Phase 2.4 — Reserved for Future API-Based Parsers

**Note:** This sub-phase is reserved for when API-based parsers (e.g., Mistral OCR, LlamaParse) are added. All current parsers (PyMuPDF4LLM, Docling, Marker, Unstructured) are local and require no API keys. The SQLite `settings` table exists in the schema for future use but no settings UI or endpoints are needed in this phase.

---

### Phase 2.5 — Frontend: Parser Selection & Progress

**Goal:** Build the frontend for parser selection, real-time progress tracking, and multi-result viewing.

**Deliverables:**

- **Parser Selection UI** — `components/parser-selector.tsx`:
  - Fetches `GET /api/v1/parsers` on mount
  - Displays each parser as a checkbox card:
    - Parser name, short description
    - Availability badge: "Ready" (green) / "Not Installed" (gray, with install command tooltip)
    - Disabled checkbox for unavailable parsers
  - "Select All Available" / "Deselect All" convenience buttons
  - Selected parsers passed to `POST /parse`

- **Progress Tracking UI** — `components/parse-progress.tsx`:
  - Polls `GET /api/v1/jobs/{job_id}/status` every 1.5 seconds while any parser is `queued` or `running`
  - Per-parser progress row:
    - Parser name
    - Status badge with color: queued (gray) → running (blue, animated) → completed (green) → error (red)
    - Elapsed time (live counter while running, final time when done)
    - Error message expandable on click if status is `error`
  - Overall progress bar showing `completed / total` parsers
  - Stops polling when all parsers are `completed` or `error`

- **Multi-Result Tabbed View** — update `page.tsx`:
  - After parsing completes, right panel shows tabbed interface
  - One tab per completed parser result
  - Tab label: parser name + elapsed time badge (e.g., "PyMuPDF4LLM · 0.8s")
  - Active tab loads markdown via `GET /results/{parser}`
  - Errored parsers show error tab with message
  - Existing `MarkdownViewer` component reused

- **Updated Page Flow** in `page.tsx`:
  1. Upload PDF → show PDF viewer on left
  2. Show parser selector below/beside PDF viewer
  3. User selects parsers → clicks "Parse"
  4. Parser selector replaced by progress tracker
  5. When all parsers finish → progress tracker collapses, tabbed results appear on right
  6. User can switch between parser tabs to compare outputs

- **Types** — update `types/index.ts`:
  - `ParserInfo`: `name`, `display_name`, `description`, `is_local`, `is_available`, `install_command`
  - `ParseRequest`: `parsers: string[]`
  - Update `JobStatus` to include new parser status fields

- **API Client** — update `lib/api.ts`:
  - `getParsers()` — `GET /parsers`
  - `triggerParse(jobId, parsers)` — `POST /parse` with body
  - `getAllResults(jobId)` — `GET /results`

**Definition of Done:**
- User sees all 4 parsers with availability status before parsing
- User can select a subset, click "Parse", and watch per-parser progress in real time
- When parsing completes, user can switch between parser outputs via tabs
- The UI works at 1440×900 in dark mode without horizontal scrolling

---

## Updated API Endpoints (Phase 2 additions in bold)

| Method | Path | Request | Response | Status | Phase |
|--------|------|---------|----------|--------|-------|
| `GET` | `/api/v1/health` | — | `{"status": "ok"}` | 200 | 1 |
| `POST` | `/api/v1/upload` | `multipart/form-data` | `UploadResponse` | 201 | 1 |
| `GET` | `/api/v1/jobs/{job_id}` | — | `JobMetadata` | 200 | 1 |
| `GET` | `/api/v1/jobs/{job_id}/pdf` | — | Binary PDF | 200 | 1 |
| `POST` | `/api/v1/jobs/{job_id}/parse` | **`ParseRequest` (parser list)** | **`MultiParseTriggerResponse`** | 202 | **2** (updated) |
| `GET` | `/api/v1/jobs/{job_id}/status` | — | `JobStatus` (per-parser) | 200 | 1 (updated) |
| `GET` | `/api/v1/jobs/{job_id}/results/{parser}` | — | `ParseResultResponse` | 200 | 1 |
| **`GET`** | **`/api/v1/jobs/{job_id}/results`** | — | **`AllResultsResponse`** | 200 | **2** |
| **`GET`** | **`/api/v1/parsers`** | — | **`list[ParserInfoResponse]`** | 200 | **2** |

---

## New Schema Definitions (Phase 2)

### ParseRequest
```
parsers: list[str]       # e.g., ["pymupdf4llm", "docling", "marker", "unstructured"]
                         # empty or omitted = all available parsers
```

### ParserInfoResponse
```
name: str                # "docling"
display_name: str        # "Docling"
description: str         # "IBM's document AI parser with advanced table & layout detection"
is_local: bool           # true (all current parsers are local)
is_available: bool       # true (dependency installed)
install_command: str     # "uv add docling"
```

### MultiParseTriggerResponse
```
job_id: str
parsers: dict[str, str]  # {"pymupdf4llm": "queued", "docling": "queued"}
```

### AllResultsResponse
```
job_id: str
results: dict[str, ParseResultResponse | null]
```

---

## Updated ParserStatus (Phase 2)

```
name: str
status: "pending" | "queued" | "running" | "completed" | "error"
elapsed_seconds: float | null
error: str | null
queued_at: str | null        # ISO 8601
started_at: str | null       # ISO 8601
completed_at: str | null     # ISO 8601
```

---

## Phase 2 Dependencies (new packages)

### Backend (Python — managed via `uv`)

| Package | Purpose | Required | Auto-install |
|---------|---------|----------|-------------|
| `aiosqlite` | Async SQLite access | Yes (core) | Yes — add to `pyproject.toml` |
| `docling` | Docling PDF parser | No (optional) | **No** — user installs if wanted |
| `marker-pdf` | Marker PDF parser | No (optional) | **No** — user installs if wanted |
| `unstructured[pdf]` | Unstructured PDF parser | No (optional) | **No** — user installs if wanted |

Only `aiosqlite` is added to `pyproject.toml`. Parser packages are optional — the registry detects availability at runtime.

### System Dependencies (for Unstructured)

| Package | Purpose | Platform |
|---------|---------|----------|
| `tesseract-ocr` | OCR for images/PDFs | `apt install tesseract-ocr` / `brew install tesseract` |
| `poppler-utils` | PDF rendering | `apt install poppler-utils` / `brew install poppler` |

### Frontend (Node — managed via `npm`)
No new frontend dependencies. Phase 1 already includes all needed UI libraries (shadcn/ui, lucide-react, etc.).

---

## File Changes Summary

### New files
```
backend/src/parsearena/
├── services/database.py           # SQLite database manager
├── parsers/registry.py            # Parser registry & metadata
├── parsers/docling_parser.py      # Docling adapter
├── parsers/marker_parser.py       # Marker adapter
├── parsers/unstructured_parser.py # Unstructured adapter
├── schemas/parsers.py             # Parser-related schemas
└── api/v1/parsers.py              # GET /parsers endpoint

frontend/src/
├── components/parser-selector.tsx  # Parser selection checkboxes
└── components/parse-progress.tsx   # Per-parser progress tracking
```

### Modified files
```
backend/src/parsearena/
├── config.py                      # Add db_path
├── main.py                        # Init SQLite in lifespan
├── services/storage.py            # Migrate from JSON to SQLite
├── services/parser_service.py     # Multi-parser parallel execution
├── schemas/jobs.py                # New/updated schemas
├── api/v1/jobs.py                 # Update parse endpoint, add /results
├── api/v1/__init__.py             # Mount new routers
├── parsers/__init__.py            # Export new parsers
└── parsers/base.py                # Add metadata field to ParseResult

frontend/src/
├── app/page.tsx                   # Updated page flow
├── lib/api.ts                     # New API functions
├── types/index.ts                 # New types
└── components/markdown-viewer.tsx # (minor: support tab switching)
```

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Parser dependency conflicts (PyTorch version clashes between Marker/Docling) | Parsers fail to install together | Each parser is optional. Users install only what they need. Phase 5 Docker will isolate environments if needed. |
| Unstructured requires system packages (tesseract, poppler) | Parser unavailable without system deps | Clear error message with install instructions per platform. Docker image includes all system deps. |
| SQLite write contention under 4 concurrent parsers | Slow status updates | WAL mode handles this well. Writes are small (status updates). Benchmark confirms <1ms per write. |
| Large model downloads on first parser run (Docling, Marker) | User thinks app is frozen | Document first-run behavior. Parser status shows "initializing" during model download. Long timeout for first run. |

---

## Open Questions Resolved

| # | Question | Decision |
|---|----------|----------|
| 1 | Per-parser progress tracking storage? | **SQLite** — zero config, handles concurrency, perfect for local open-source tool. See architecture decision above. |
| 2 | WebSocket vs polling for progress? | **Polling** — simpler, already used in Phase 1, works well with 1.5s interval. SSE is a stretch goal for Phase 3. |
| 3 | How to handle parsers with heavy deps? | **Optional installs** — only `aiosqlite` is added to core deps. Parser packages are user-installed. Registry detects availability. |
| 4 | MinerU / Mistral OCR? | **Deferred** — MinerU has a hard Pillow conflict with Marker. Mistral OCR removed (API-based, adds complexity). Both can be revisited via Docker service isolation in Phase 5. |
| 5 | Unstructured system deps? | **Document clearly** — Unstructured requires `tesseract-ocr` and `poppler-utils`. Docker image includes them. Bare-metal users get clear install instructions. |
