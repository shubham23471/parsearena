# Prompt: Generate PRD for ParseArena

Copy everything below the line and paste it into Cursor as a single prompt.

---

You are a senior product manager and technical architect. Using the context below, generate a **Product Requirements Document (PRD)** for an open-source PDF parser comparison platform called **"ParseArena"**.

## Output Rules
- Output a single markdown file called `PRD.md`
- NO code. No code snippets, no pseudo-code, no implementation details. This is a product/architecture document only.
- Be concise. Use tables, bullet points, and headers. No filler paragraphs.
- Divide the build into **phases** that can each be vibe-coded independently in Cursor (each phase should be a self-contained unit of work with clear inputs and outputs).

## Project Context

### What We're Building
An open-source web application (backend + frontend) that lets a user upload one or multiple PDFs and run them through multiple PDF parsers simultaneously, then view the results **side-by-side** to visually compare parsing quality. The goal is to help RAG practitioners decide which PDF parser works best for their specific documents.

### This is NOT a SaaS
It's a local-first, open-source developer tool. The user runs it locally via Docker or `pip install`. No auth, no billing, no cloud hosting required. The monetization is content (YouTube, Reddit, GitHub stars) + consulting, not subscriptions.

### The 5 Parsers to Support at Launch
1. **Docling** (~58.6K GitHub stars) — AI structure-aware, best table extraction (TableFormer), Apache 2.0. Install: `pip install docling`
2. **Marker** (~34.4K stars) — Speed + accuracy, most popular PDF→Markdown converter, GPU-optional. Install: `pip install marker-pdf`
3. **MinerU** (~64.1K stars) — Highest layout detection accuracy (97.5 mAP), academic/complex docs. Install: `pip install magic-pdf`
4. **PyMuPDF4LLM** (~1.7K stars) — Speed baseline, zero ML, pure rule-based, CPU-only, milliseconds. Install: `pip install pymupdf4llm`
5. **Mistral OCR** (Cloud API) — VLM-based, vision AI representative. Install: `pip install mistralai`. Requires API key.

### Key Differentiators (vs competitors like PDFstract, ParseBench)
1. **Visual Diff** — Show original PDF rendered side-by-side with each parser's Markdown output. Nobody else does this visually.
2. **VLM Parsing** — Include vision-language model parsing (Mistral OCR) alongside traditional parsers. Nobody in open-source space does this.
3. **Metrics Dashboard** — Show speed (time per page), cost per page, and structure quality per parser per document.
4. **Beautiful UI** — Screenshot-worthy for YouTube/Twitter content. Not a developer-only CLI tool.
5. **Export Ready** — Let users copy/download the winning parser's output + generate the pip install snippet.

### Tech Stack Preferences
- **Backend:** Python, FastAPI
- **Frontend:** Next.js 
- **PDF Rendering:** pdf.js for in-browser PDF viewing
- **Containerization:** Docker + docker-compose for one-command setup
- **Parser Execution:** Each parser runs as an isolated async task on the backend

### Design Requirements
- Dark mode by default
- The comparison view is the hero — think "split-screen code diff" but for PDF parsing results
- Must work on a 13" laptop screen without horizontal scrolling
- Mobile is NOT a priority

## PRD Structure (Follow This Exactly)

### 1. Product Overview
- One-paragraph product description
- Target user persona (who is this for, specifically)
- Core user story (the single most important flow)

### 2. Feature Requirements
For each feature, specify:
- Feature name
- Description (1-2 sentences)
- Priority (P0 = must have for launch, P1 = should have, P2 = nice to have / V2)
- Which phase it belongs to

### 3. Architecture Overview
- High-level system diagram description (backend, frontend, parser workers, file storage — describe it, do NOT draw it)
- API contract summary (list the key endpoints with method, path, and what they do — no request/response schemas)
- Data flow: upload → parse → compare → export

### 4. Phased Build Plan
Divide into phases. For each phase specify:
- Phase name and goal (one sentence)
- What gets built (bullet list of deliverables)
- Definition of done (how do you know this phase is complete — be specific)
- Dependencies (what must exist before this phase can start)
- Estimated effort (in days, assuming vibe coding in Cursor with AI assistance)

Suggested phase breakdown (adjust as you see fit):
- **Phase 1:** Project scaffolding + single parser working end-to-end (upload → parse → view result)
- **Phase 2:** Multi-parser support (all 5 parsers integrated, running in parallel)
- **Phase 3:** Side-by-side comparison UI (the hero feature)
- **Phase 4:** Metrics & scoring (speed, cost, structure quality dashboard)
- **Phase 5:** Export & polish (download results, code snippets, README, Docker setup)
- **Phase 6:** V2 features (additional parsers, batch upload, domain classification)

### 5. Non-Functional Requirements
- Performance targets (max parse time, concurrent uploads)
- File limits (max PDF size, max pages)
- Browser support
- Accessibility baseline

### 6. Open Questions
List any decisions that still need to be made before or during build (framework choices, naming, specific UI patterns, etc.)

### 7. Out of Scope (for V1)
Explicitly list what we are NOT building to prevent scope creep.
