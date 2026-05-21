# Phase 1 — Foundation: Single Parser End-to-End

**Parent PRD:** `prds/PRD.md`
**Goal:** Monorepo scaffolding with production-grade project structure, a single parser (PyMuPDF4LLM) working end-to-end: upload a PDF → parse it → view the original PDF alongside the parsed Markdown output.

**Tech decisions locked for this phase:**
- Monorepo: `backend/` and `frontend/` at repo root
- Backend: Python 3.12+, FastAPI, `uv` as package manager
- Frontend: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- No database — JSON metadata files on disk
- No tests (deferred)
- No Docker (deferred to Phase 5)

---

## Target Directory Structure

```
parsearena/
├── backend/
│   ├── pyproject.toml          # uv project config, all deps here
│   ├── uv.lock
│   ├── .python-version
│   ├── .env.example
│   ├── src/
│   │   └── parsearena/
│   │       ├── __init__.py
│   │       ├── main.py             # FastAPI app factory, lifespan, CORS
│   │       ├── config.py           # Pydantic Settings (env-based config)
│   │       ├── api/
│   │       │   ├── __init__.py
│   │       │   ├── router.py       # Top-level API router aggregation
│   │       │   ├── deps.py         # Shared dependencies (get_storage, etc.)
│   │       │   └── v1/
│   │       │       ├── __init__.py
│   │       │       ├── upload.py   # POST /api/v1/upload
│   │       │       ├── jobs.py     # GET /api/v1/jobs/{id}, parse, status, results
│   │       │       └── health.py   # GET /api/v1/health
│   │       ├── schemas/
│   │       │   ├── __init__.py
│   │       │   └── jobs.py         # Pydantic request/response models
│   │       ├── services/
│   │       │   ├── __init__.py
│   │       │   ├── storage.py      # File storage abstraction (save/read PDF, markdown, metadata)
│   │       │   └── parser_service.py  # Orchestrates parser execution
│   │       └── parsers/
│   │           ├── __init__.py
│   │           ├── base.py         # Abstract base parser protocol
│   │           └── pymupdf4llm.py  # PyMuPDF4LLM adapter
│   └── data/                       # Runtime data dir (gitignored)
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── .env.local.example
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout, fonts, dark mode
│   │   │   ├── page.tsx            # Home page (upload + results)
│   │   │   └── globals.css         # Tailwind base + dark theme tokens
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui primitives (button, card, etc.)
│   │   │   ├── pdf-upload.tsx      # Drag-and-drop upload zone
│   │   │   ├── pdf-viewer.tsx      # pdf.js-based PDF renderer
│   │   │   └── markdown-viewer.tsx # Rendered Markdown display
│   │   ├── lib/
│   │   │   ├── api.ts              # API client (fetch wrapper, typed endpoints)
│   │   │   └── utils.ts            # Shared utilities (cn, formatters)
│   │   └── types/
│   │       └── index.ts            # Shared TypeScript types matching backend schemas
│   └── public/
├── prds/
├── .gitignore
└── README.md
```

---

## Sub-Phase Breakdown

### Phase 1.1 — Backend Scaffolding

**Goal:** Set up the FastAPI project with `uv`, production-grade structure, config, and the health endpoint running.

**Deliverables:**
- `pyproject.toml` with project metadata, Python 3.12+ requirement, and dependencies: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `python-multipart`
- `src/parsearena/` package structure as described above
- `main.py`: FastAPI app with lifespan context manager, CORS middleware (allow `localhost:3000`), and `/api/v1` router mount
- `config.py`: Pydantic `Settings` class reading from env vars — `DATA_DIR` (default: `./data`), `CORS_ORIGINS`, `MAX_UPLOAD_SIZE_MB` (default: 50)
- `api/v1/health.py`: `GET /api/v1/health` returning `{"status": "ok"}`
- `.env.example` with documented defaults
- `.python-version` set to `3.12`

**Definition of Done:**
- Running `uv run uvicorn parsearena.main:app --reload` starts the server on port 8000
- `curl localhost:8000/api/v1/health` returns `{"status": "ok"}`
- The project structure matches the tree above

---

### Phase 1.2 — File Upload & Storage

**Goal:** Accept PDF uploads via the API, store them on disk with UUID-based job folders, and serve them back.

**Deliverables:**
- `services/storage.py`: Storage class with methods:
  - `create_job() → job_id` — creates `data/{job_id}/` directory and a `metadata.json`
  - `save_pdf(job_id, file) → path` — saves uploaded PDF as `original.pdf`
  - `get_pdf_path(job_id) → Path` — returns the path to the original PDF
  - `save_result(job_id, parser_name, markdown, timing)` — writes `.md` file and updates metadata
  - `get_metadata(job_id) → dict` — reads metadata.json
- `schemas/jobs.py`: Pydantic models — `UploadResponse(job_id, filename, page_count, created_at)`, `JobStatus`, `JobMetadata`
- `api/v1/upload.py`: `POST /api/v1/upload` — accepts `multipart/form-data` with a single PDF, validates file type and size, calls storage service, returns `UploadResponse`
- `api/v1/jobs.py`:
  - `GET /api/v1/jobs/{job_id}` — returns job metadata
  - `GET /api/v1/jobs/{job_id}/pdf` — serves the original PDF file with correct content-type
- Add `pymupdf` to dependencies (needed for page count extraction on upload — PyMuPDF is the base lib)

**Definition of Done:**
- `curl -F "file=@sample.pdf" localhost:8000/api/v1/upload` returns a JSON with `job_id`
- `data/{job_id}/original.pdf` exists on disk
- `GET /api/v1/jobs/{job_id}` returns metadata including filename and page count
- `GET /api/v1/jobs/{job_id}/pdf` returns the PDF binary with `application/pdf` content-type
- Uploading a non-PDF or >50MB file returns a 422 with a clear error message

---

### Phase 1.3 — Parser Adapter & Execution

**Goal:** Implement the abstract parser interface and the PyMuPDF4LLM adapter, wire up the parse endpoint.

**Deliverables:**
- `parsers/base.py`: Abstract base class / Protocol defining the parser contract:
  - `name: str`
  - `async def parse(pdf_path: Path) → ParseResult` where `ParseResult` contains `markdown: str`, `elapsed_seconds: float`, `page_count: int`
- `parsers/pymupdf4llm.py`: Concrete adapter using `pymupdf4llm.to_markdown()`. Runs in a thread pool executor since it's CPU-bound.
- `services/parser_service.py`: Service that:
  - Accepts a `job_id` and a parser name
  - Looks up the parser adapter
  - Runs the parse
  - Calls `storage.save_result()` with the output
  - Updates job metadata status (`pending → parsing → completed / error`)
- `api/v1/jobs.py` additions:
  - `POST /api/v1/jobs/{job_id}/parse` — triggers parsing (for Phase 1, hardcoded to PyMuPDF4LLM). Runs as a background task. Returns `202 Accepted` with current status.
  - `GET /api/v1/jobs/{job_id}/status` — returns per-parser status
  - `GET /api/v1/jobs/{job_id}/results/{parser}` — returns the Markdown string
- Add `pymupdf4llm` to dependencies

**Definition of Done:**
- `POST /api/v1/jobs/{job_id}/parse` triggers PyMuPDF4LLM and returns 202
- Polling `GET /api/v1/jobs/{job_id}/status` shows the parser transition from `parsing` to `completed`
- `GET /api/v1/jobs/{job_id}/results/pymupdf4llm` returns the Markdown output
- `data/{job_id}/pymupdf4llm.md` exists on disk after parsing
- A 10-page PDF parses in under 2 seconds

---

### Phase 1.4 — Frontend Scaffolding

**Goal:** Set up the Next.js project with App Router, Tailwind, shadcn/ui, dark mode, and the API client — ready for feature development.

**Deliverables:**
- Next.js 15 project in `frontend/` with TypeScript, App Router, Tailwind CSS
- shadcn/ui initialized with `new-york` style, dark mode as default via `class` strategy
- Root layout with Inter font, dark background, and `<html class="dark">` by default
- `lib/api.ts`: typed API client wrapping `fetch` — base URL from `NEXT_PUBLIC_API_URL` env var (default `http://localhost:8000`). Functions: `uploadPdf(file)`, `getJob(jobId)`, `triggerParse(jobId)`, `getJobStatus(jobId)`, `getParseResult(jobId, parser)`
- `types/index.ts`: TypeScript types mirroring backend schemas — `UploadResponse`, `JobMetadata`, `JobStatus`, `ParseResult`
- `.env.local.example` with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Basic landing page with app title and placeholder content

**Definition of Done:**
- `npm run dev` starts the frontend on port 3000
- The page renders in dark mode with the app title
- `api.ts` functions are defined and typed (they'll be wired up in Phase 1.5)
- No TypeScript errors, no console warnings

---

### Phase 1.5 — Upload UI & PDF Viewer

**Goal:** Build the upload component and the PDF viewer so users can drop a PDF and see it rendered in-browser.

**Deliverables:**
- `components/pdf-upload.tsx`: Drag-and-drop zone with:
  - Visual drop area with dashed border, icon, and "Drop PDF here or click to browse" text
  - File type validation (PDF only) and size validation (50MB max) on the client side
  - Upload progress indicator
  - Calls `api.uploadPdf()` on drop/select
  - On success, transitions to the viewer state
- `components/pdf-viewer.tsx`: PDF rendering using `react-pdf` (which wraps pdf.js):
  - Renders all pages vertically (scrollable)
  - Page number indicator
  - Loads PDF from `GET /api/v1/jobs/{job_id}/pdf` via the API URL
- Update `page.tsx` to orchestrate the flow: upload → show PDF viewer
- State management: use React `useState` for now (job_id, upload status, parse status)

**Definition of Done:**
- User can drag a PDF onto the page and see it upload with progress feedback
- After upload, the PDF renders page-by-page in the browser
- Invalid file types show an error message inline (no alert boxes)
- The PDF viewer scrolls smoothly for a 10-page document

---

### Phase 1.6 — Parse Trigger & Markdown Viewer

**Goal:** Wire the "Parse" button and display the Markdown result alongside the PDF in a two-panel layout.

**Deliverables:**
- Parse button: appears after upload, triggers `api.triggerParse(jobId)`, then polls `api.getJobStatus(jobId)` until complete
- Loading state: show a spinner/skeleton in the result panel while parsing
- `components/markdown-viewer.tsx`: renders Markdown as styled HTML using `react-markdown` with:
  - Proper heading hierarchy styling
  - Table rendering with borders and alternating row colors
  - Code block styling
  - Dark mode compatible
- Two-panel layout on `page.tsx`:
  - Left panel: PDF viewer (50% width)
  - Right panel: Markdown result viewer (50% width)
  - Resizable divider between panels (stretch goal — fixed 50/50 is acceptable)
- Error handling: if parsing fails, show the error message in the result panel

**Definition of Done:**
- User uploads a PDF → clicks "Parse" → sees a loading state → Markdown appears in the right panel
- The original PDF is visible on the left, parsed Markdown on the right, both scrollable independently
- The layout works at 1440×900 without horizontal scrolling
- The UI is dark mode, visually clean, and uses consistent styling
- End-to-end flow completes in under 15 seconds for a 10-page PDF (including upload + render)

---

## Phase 1 Dependencies (Libraries)

### Backend (Python — managed via `uv`)
| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `pydantic-settings` | Env-based configuration |
| `python-multipart` | File upload support |
| `pymupdf4llm` | PDF→Markdown parser (also installs `pymupdf`) |

### Frontend (Node — managed via `npm`)
| Package | Purpose |
|---------|---------|
| `next` | React framework |
| `react`, `react-dom` | UI library |
| `typescript`, `@types/react`, `@types/node` | Type safety |
| `tailwindcss`, `postcss`, `@tailwindcss/typography` | Styling |
| `react-pdf` | PDF.js wrapper for rendering PDFs |
| `react-markdown` | Markdown→HTML rendering |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough) |
| `lucide-react` | Icons |
| shadcn/ui components: `button`, `card`, `skeleton` | UI primitives |

---

## API Endpoints (Phase 1 Scope)

| Method | Path | Request | Response | Status |
|--------|------|---------|----------|--------|
| `GET` | `/api/v1/health` | — | `{"status": "ok"}` | 200 |
| `POST` | `/api/v1/upload` | `multipart/form-data` with `file` field (PDF) | `UploadResponse` | 201 |
| `GET` | `/api/v1/jobs/{job_id}` | — | `JobMetadata` | 200 |
| `GET` | `/api/v1/jobs/{job_id}/pdf` | — | Binary PDF | 200 |
| `POST` | `/api/v1/jobs/{job_id}/parse` | — (parser is hardcoded to pymupdf4llm in Phase 1) | `{"status": "parsing"}` | 202 |
| `GET` | `/api/v1/jobs/{job_id}/status` | — | `JobStatus` | 200 |
| `GET` | `/api/v1/jobs/{job_id}/results/pymupdf4llm` | — | `{"markdown": "...", "elapsed_seconds": 1.2}` | 200 |

---

## Schema Definitions (Phase 1)

### UploadResponse
```
job_id: str (UUID)
filename: str
page_count: int
size_bytes: int
created_at: str (ISO 8601)
```

### JobMetadata
```
job_id: str
filename: str
page_count: int
size_bytes: int
created_at: str
status: "uploaded" | "parsing" | "completed" | "error"
parsers: dict[str, ParserStatus]
```

### ParserStatus
```
name: str
status: "pending" | "parsing" | "completed" | "error"
elapsed_seconds: float | null
error: str | null
```

### metadata.json (on disk)
```
{
  "job_id": "uuid",
  "filename": "report.pdf",
  "page_count": 10,
  "size_bytes": 2048000,
  "created_at": "2026-05-21T10:00:00Z",
  "status": "completed",
  "parsers": {
    "pymupdf4llm": {
      "status": "completed",
      "elapsed_seconds": 1.2,
      "error": null
    }
  }
}
```
