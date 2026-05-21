# ParseArena — Product Requirements Document

## 1. Product Overview

### Product Description

ParseArena is a local-first, open-source web application that lets users upload PDFs and run them through multiple PDF parsers simultaneously, then view the original document alongside each parser's Markdown output in a side-by-side visual comparison. It gives RAG practitioners a fast, visual way to evaluate which parser handles their specific document types best — without reading documentation, writing glue code, or trusting benchmarks on someone else's data.

### Target User Persona

**The RAG Engineer** — a developer or ML engineer building retrieval-augmented generation pipelines who needs to choose a PDF parser. They've heard of Docling, Marker, MinerU, etc., but don't have time to install, configure, and compare five tools manually. They want to drop in their own PDFs (invoices, research papers, contracts, slide decks) and see which parser wins for *their* data. They're comfortable with Docker and the terminal but want a visual result, not a JSON dump.

### Core User Story

> As a RAG engineer, I want to upload a PDF, run it through multiple parsers at once, and see the original PDF rendered next to each parser's Markdown output — so I can visually judge which parser best preserves the structure, tables, and content of my specific document.

---

## 2. Feature Requirements

| # | Feature | Description | Priority | Phase |
|---|---------|-------------|----------|-------|
| F1 | PDF Upload | Upload one or more PDF files via drag-and-drop or file picker. Files are stored on the local filesystem. | P0 | 1 |
| F2 | Single Parser Execution | Run a selected parser against an uploaded PDF and return the Markdown result. | P0 | 1 |
| F3 | Parsed Result Viewer | Display a parser's Markdown output with rendered preview (headings, tables, lists). | P0 | 1 |
| F4 | PDF Viewer | Render the original PDF in-browser using pdf.js for page-by-page viewing. | P0 | 1 |
| F5 | Multi-Parser Execution | Run all 5 parsers (or a user-selected subset) against a PDF in parallel and collect results. | P0 | 2 |
| F6 | Parser Selection | Let the user choose which parsers to run via checkboxes before triggering a parse job. | P0 | 2 |
| F7 | API Key Configuration | Settings panel where users can paste their Mistral API key (stored in local env/config, never persisted to disk in plaintext beyond `.env`). | P0 | 2 |
| F8 | Progress Tracking | Show real-time status per parser (queued → running → done/error) while a multi-parser job is in progress. | P0 | 2 |
| F9 | Side-by-Side Comparison View | Hero feature: display original PDF on the left and parser Markdown outputs in switchable/tabbed panels on the right. Support 2-up and 3-up layouts. | P0 | 3 |
| F10 | Parser Output Diff | Highlight structural differences between two selected parser outputs (added/missing headings, tables, images). | P1 | 3 |
| F11 | Speed Metrics | Record and display wall-clock parse time and time-per-page for each parser. | P0 | 4 |
| F12 | Cost Metrics | Calculate and display estimated cost per page for API-based parsers (Mistral OCR). Show $0 for local parsers. | P1 | 4 |
| F13 | Structure Quality Indicators | Surface heuristic quality signals per parser: table count detected, heading hierarchy depth, image placeholder count, character count. | P1 | 4 |
| F14 | Metrics Dashboard | Aggregate metrics across parsers for a single document into a comparative summary table/card view. | P1 | 4 |
| F15 | Export Markdown | Download the selected parser's Markdown output as a `.md` file. | P0 | 5 |
| F16 | Copy to Clipboard | One-click copy of any parser's Markdown output. | P0 | 5 |
| F17 | Install Snippet | Show the `pip install` command and minimal Python usage snippet for the winning parser. | P1 | 5 |
| F18 | Docker One-Command Setup | `docker-compose up` brings up backend + frontend + all parser dependencies. | P0 | 5 |
| F19 | Batch Upload | Upload multiple PDFs and run a selected parser set across all of them in one job. | P2 | 6 |
| F20 | Additional Parsers | Plugin architecture to add new parsers without modifying core code. | P2 | 6 |
| F21 | Document Type Classification | Auto-detect document type (invoice, academic paper, slide deck, etc.) and recommend the best parser. | P2 | 6 |

---

## 3. Architecture Overview

### High-Level System Description

The system has four layers:

- **Frontend (Next.js)** — A single-page app serving the upload UI, PDF viewer (pdf.js), comparison view, and metrics dashboard. Communicates with the backend exclusively via REST API. Runs on port 3000.

- **Backend (FastAPI)** — Python API server handling file uploads, parser orchestration, result storage, and metrics calculation. Exposes REST endpoints. Runs on port 8000.

- **Parser Workers** — Each of the 5 parsers is wrapped in a common adapter interface. When a parse job is triggered, the backend spawns async tasks (one per selected parser) that call the adapter, capture the Markdown output, and record timing. All parsers run in the same Python process (no separate microservices) but execute concurrently via `asyncio` with thread/process pool executors for CPU-bound parsers.

- **Local File Storage** — Uploaded PDFs and generated Markdown outputs are stored on the local filesystem under a configurable `data/` directory. Each upload gets a UUID-based folder. No database is required for V1 — a lightweight JSON metadata file per job tracks status and results.

### API Contract Summary

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/upload` | Upload one or more PDF files, returns a job ID |
| `GET` | `/api/jobs/{job_id}` | Get job status and metadata |
| `POST` | `/api/jobs/{job_id}/parse` | Trigger parsing with selected parsers |
| `GET` | `/api/jobs/{job_id}/status` | Poll parse progress (per-parser status) |
| `GET` | `/api/jobs/{job_id}/results` | Get all parser results for a job |
| `GET` | `/api/jobs/{job_id}/results/{parser}` | Get a single parser's Markdown output |
| `GET` | `/api/jobs/{job_id}/metrics` | Get timing/cost/quality metrics for all parsers |
| `GET` | `/api/jobs/{job_id}/pdf` | Serve the original PDF file for in-browser rendering |
| `GET` | `/api/parsers` | List available parsers and their status (installed, requires API key, etc.) |
| `PUT` | `/api/settings` | Update settings (API keys, default parser selection) |
| `GET` | `/api/health` | Health check |

### Data Flow

1. **Upload** — User drops a PDF into the frontend. Frontend sends it to `POST /api/upload`. Backend saves the file to `data/{job_id}/original.pdf` and returns the job ID.

2. **Parse** — User selects parsers and clicks "Run." Frontend calls `POST /api/jobs/{job_id}/parse` with the parser list. Backend spawns one async task per parser. Each task calls the parser adapter, writes the Markdown output to `data/{job_id}/{parser_name}.md`, and records wall-clock time. Frontend polls `GET /api/jobs/{job_id}/status` for progress.

3. **Compare** — When parsing completes, frontend fetches results via `GET /api/jobs/{job_id}/results` and renders the comparison view: original PDF (pdf.js) on the left, parser outputs (rendered Markdown) in tabbed/split panels on the right. Metrics are fetched from `GET /api/jobs/{job_id}/metrics`.

4. **Export** — User selects a parser output and clicks "Download" or "Copy." Frontend either triggers a file download of the `.md` file or copies the content to clipboard. The install snippet is rendered client-side based on parser metadata.

---

## 4. Phased Build Plan

### Phase 1 — Foundation: Single Parser End-to-End

**Goal:** Get one PDF uploaded, parsed by one parser (PyMuPDF4LLM — fastest, zero dependencies), and displayed alongside the original.

**Deliverables:**
- FastAPI project scaffolding with file upload endpoint
- PyMuPDF4LLM parser adapter (the simplest parser, good for proving the pipeline)
- PDF upload UI with drag-and-drop
- PDF viewer component (pdf.js)
- Markdown result viewer (rendered HTML)
- Basic two-panel layout: PDF on left, parsed output on right
- Local file storage structure (`data/{job_id}/`)

**Definition of Done:**
- User can open the app, upload a PDF, click "Parse," and see the original PDF next to PyMuPDF4LLM's Markdown output within the same screen
- The backend returns the Markdown result within 10 seconds for a 10-page PDF
- The app runs locally via `uvicorn` (backend) + `npm run dev` (frontend)

**Dependencies:** None (starting from scratch)

**Estimated Effort:** 3–4 days

---

### Phase 2 — Multi-Parser Support

**Goal:** Integrate all 5 parsers and run them in parallel against a single PDF.

**Deliverables:**
- Parser adapter implementations for Docling, Marker, MinerU, and Mistral OCR
- Common parser interface/protocol that all adapters implement
- Parser selection UI (checkboxes with parser names, descriptions, and install status)
- Parallel execution via asyncio with thread pool
- Per-parser progress tracking (queued → running → done → error)
- Settings panel for Mistral API key entry
- Error handling per parser (one parser failing doesn't block others)

**Definition of Done:**
- User can select any combination of the 5 parsers, run them, and see all results complete (or error) independently
- Mistral OCR works when API key is provided and shows a clear error when it's missing
- All 4 local parsers complete successfully on a standard 5-page PDF
- Progress indicators update in real-time during parsing

**Dependencies:** Phase 1 complete

**Estimated Effort:** 4–5 days

---

### Phase 3 — Side-by-Side Comparison View

**Goal:** Build the hero feature — a polished visual comparison of parser outputs against the original PDF.

**Deliverables:**
- Comparison layout: original PDF pinned on the left, parser outputs on the right
- Tabbed view to switch between parser outputs on the right panel
- Split view option to show 2 parser outputs side-by-side (without the PDF)
- Synchronized scrolling between PDF pages and Markdown sections (best-effort)
- Dark mode styling across all components
- Responsive layout that works on 13" screens without horizontal scrolling
- Parser output diff view (highlight differences between two selected parsers)

**Definition of Done:**
- A user can visually compare the original PDF against any parser's output in a side-by-side layout
- Switching between parser outputs is instant (no reload)
- The UI looks polished in dark mode at 1440×900 resolution
- A user can select two parsers and see a structural diff of their outputs

**Dependencies:** Phase 2 complete

**Estimated Effort:** 4–5 days

---

### Phase 4 — Metrics & Scoring Dashboard

**Goal:** Surface quantitative data (speed, cost, structure quality) so users can make data-driven parser decisions.

**Deliverables:**
- Timing instrumentation: wall-clock time and time-per-page recorded per parser
- Cost calculation for API-based parsers (Mistral OCR pricing per page)
- Structure quality heuristics: table count, heading count/depth, image placeholder count, total character count
- Metrics summary cards displayed above the comparison view
- Comparative bar chart or table ranking parsers by each metric
- "Best for this document" recommendation based on weighted score

**Definition of Done:**
- After parsing, each parser shows its speed (e.g., "2.3s, 0.46s/page") and cost (e.g., "$0.00" or "$0.02/page")
- Structure quality signals are visible per parser
- A summary table ranks all parsers by speed, cost, and quality
- Metrics are accurate and match manually timed runs within 10% tolerance

**Dependencies:** Phase 2 complete (Phase 3 not required, can be built in parallel)

**Estimated Effort:** 3–4 days

---

### Phase 5 — Export & Production Polish

**Goal:** Make the tool export-ready, containerized, and presentable for open-source launch.

**Deliverables:**
- Download button: export any parser's Markdown as a `.md` file
- Copy-to-clipboard button for Markdown output
- Install snippet display: show `pip install` command + minimal usage code for the selected parser
- Dockerfile and docker-compose.yml for one-command setup
- README.md with screenshots, quick start, and parser descriptions
- Error states and empty states polished across all views
- Loading skeletons and transitions

**Definition of Done:**
- `docker-compose up` starts the entire app and all parsers work out of the box (except Mistral OCR which requires an API key)
- A new user can clone the repo, run one command, and use the app within 5 minutes
- Export/copy/snippet features work for all 5 parsers
- README includes at least one screenshot of the comparison view

**Dependencies:** Phases 3 and 4 complete

**Estimated Effort:** 3–4 days

---

### Phase 6 — V2 Features

**Goal:** Extend the platform with power-user features and community-requested additions.

**Deliverables:**
- Batch upload: upload multiple PDFs and run the same parser set across all
- Parser plugin system: define a standard interface so community contributors can add parsers via a config file + adapter
- Document type auto-classification (invoice, research paper, legal, slide deck) with parser recommendation
- Parse history: list of previous jobs with quick re-open
- Additional parsers: candidates include Unstructured, LlamaParse, Nougat

**Definition of Done:**
- A user can upload 5 PDFs at once and get comparison results for each
- A contributor can add a new parser by creating a single adapter file and adding an entry to a config
- Document type detection runs on upload and shows a label in the UI

**Dependencies:** Phase 5 complete

**Estimated Effort:** 5–7 days

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Parse Time** | Local parsers must complete within 60 seconds for a 20-page PDF on a machine with 16GB RAM. PyMuPDF4LLM should complete in under 2 seconds. |
| **Concurrent Uploads** | Support at least 3 concurrent upload+parse jobs. No requirement for high concurrency — this is a local tool. |
| **Max PDF Size** | 50 MB per file |
| **Max Pages** | 100 pages per PDF (show warning above 50 pages for ML-based parsers) |
| **Browser Support** | Latest Chrome and Firefox. Safari best-effort. No IE/Edge legacy. |
| **Accessibility** | WCAG 2.1 AA baseline: keyboard navigation for all primary actions, sufficient color contrast in dark mode, alt text on informational images. Screen reader support is best-effort. |
| **Disk Usage** | Auto-cleanup of job data older than 7 days (configurable). Warn if `data/` exceeds 1 GB. |
| **Startup Time** | App should be usable within 30 seconds of `docker-compose up` (excluding initial image build). |

---

## 6. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | **GPU support in Docker** — Should the Docker setup include NVIDIA runtime for GPU-accelerated parsers (Marker, MinerU, Docling), or default to CPU-only with GPU as an opt-in config? | Affects Docker complexity and parser speed. |
| 2 | **Parser installation strategy** — Install all parsers in one container, or use separate containers per parser to avoid dependency conflicts? Single container is simpler; multi-container avoids Python dependency hell. | Affects Docker architecture and build time. |
| 3 | **Synchronized scrolling** — How should PDF page scrolling sync with Markdown output? By page anchors, by heading matching, or not at all? | Affects Phase 3 complexity significantly. |
| 4 | **Structure quality scoring** — Should the quality heuristics be simple counts (tables found, headings found) or should we implement a ground-truth comparison mode where users can mark a "reference" output? | Affects Phase 4 scope. |
| 5 | **Naming: "job" vs "session" vs "comparison"** — What do we call a single upload+parse+compare cycle in the UI and API? | Affects API naming and UX copy. |
| 6 | **Mistral OCR pricing model** — Is the cost-per-page estimate hardcoded or fetched from the API? Pricing may change. | Affects cost metric accuracy. |
| 7 | **WebSocket vs polling** — Should progress tracking use WebSocket for real-time updates or HTTP polling? Polling is simpler; WebSocket feels more responsive. | Affects Phase 2 implementation. |

---

## 7. Out of Scope (for V1)

- **User authentication or multi-tenancy** — This is a single-user local tool
- **Cloud deployment or hosted version** — No managed service, no server infrastructure
- **Mobile or tablet UI** — Desktop-only
- **PDF editing or annotation** — Read-only viewing of source PDFs
- **Custom parser configuration** — Users cannot tune parser parameters (chunk size, model selection, etc.) in V1
- **Ground-truth labeling or human evaluation workflows** — No manual scoring or annotation tools
- **Automated benchmark suites** — No pre-loaded test datasets or standardized scoring against known outputs
- **Internationalization (i18n)** — English-only UI
- **Persistent database** — No SQLite/Postgres; JSON file metadata is sufficient for V1
- **CI/CD pipeline or automated testing** — Testing is manual for initial launch
- **Plugin marketplace or community registry** — V2 introduces the plugin interface; no registry in V1
- **Comparison across multiple documents** — V1 compares parsers on a single document at a time
