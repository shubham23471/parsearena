# Phase 4 — Metrics & Scoring Dashboard

**Parent PRD:** `prds/PRD.md`
**Depends on:** Phase 2 (complete). Can be built in parallel with Phase 3.
**Goal:** Surface quantitative data — speed, cost, and structure quality — so users can make data-driven parser decisions instead of eyeballing markdown output.

**Estimated Effort:** 5–7 days across 3 sub-phases

---

## What We're Building On

| Layer | What exists (Phase 1 + 2) | What Phase 4 adds |
|-------|--------------------------|-------------------|
| **Timing data** | `elapsed_seconds` stored per parser in `parser_results` table. Exposed via `/status` and `/results/{parser}`. | Derive `time_per_page`. Surface in metrics cards and comparative table. |
| **Page count** | `page_count` stored in `jobs` table (from upload). `ParseResult` dataclass has `page_count` but it's not exposed in API results. | Use job-level `page_count` for time-per-page and cost-per-page calculations. |
| **Execution device** | `execution_device` (`cuda`/`mps`/`cpu`) tracked per parser in `parser_results`. | Display in metrics for context (GPU parsers are faster but hardware-dependent). |
| **Markdown output** | Full markdown stored on disk as `{parser_name}.md`. Available client-side via `allResults` state. | Analyze markdown to extract structure quality heuristics. |
| **Cost data** | Nothing. All 4 current parsers are local ($0). | Add cost metadata to parser registry. Show $0.00 for local parsers. Structure ready for future API parsers. |
| **API** | `GET /results` returns markdown + elapsed_seconds. `GET /status` returns parser statuses. No metrics endpoint. | New `GET /metrics` endpoint returning computed metrics per parser. |
| **Frontend** | Parser tabs show `parserName · 14.9s · GPU-CUDA`. No metrics cards, no comparative view. | Metrics summary cards, comparative ranking table, "best for this document" recommendation. |

---

## Architecture Decision: Where to Compute Metrics

**Options considered:**

| Approach | Pros | Cons |
|----------|------|------|
| **Client-side** (compute from markdown in browser) | Zero backend changes. Markdown already in `allResults` state. | Duplicates logic if multiple tabs open. Large documents slow down the UI thread. Can't query historical metrics. |
| **On-the-fly backend** (compute on `/metrics` request from .md files) | No schema changes. Always fresh. | Reads large files on every request. Slow for big documents. No caching. |
| **Compute on parse completion** (backend, stored in DB) | Fast reads. Computed once. Queryable. Scales to batch comparisons in Phase 6. | Requires new table/columns. Slightly more complex parse pipeline. |

**Decision:** Compute on parse completion, store in SQLite.

Metrics are derived from the markdown output the moment a parser finishes. They're stored in a new `parser_metrics` table (one row per parser per job). The `/metrics` endpoint just reads from SQLite — no file I/O, no re-computation.

This is the right call because:
1. Markdown files can be large (50+ page documents → 100KB+ per parser). Re-reading and parsing them on every metrics request wastes I/O.
2. Stored metrics enable future features: historical comparisons, batch rankings, parser leaderboards.
3. The computation is cheap (regex counts on a string) and adds negligible time to the parse pipeline.

---

## Metrics Taxonomy

### Speed Metrics

| Metric | Source | Unit | Example |
|--------|--------|------|---------|
| `elapsed_seconds` | Already in `parser_results` | seconds | `14.9` |
| `time_per_page` | `elapsed_seconds / page_count` | seconds/page | `0.65` |
| `execution_device` | Already in `parser_results` | enum | `cuda` |

No new backend computation needed — derived from existing data.

### Cost Metrics

| Metric | Source | Unit | Example |
|--------|--------|------|---------|
| `cost_per_page` | Parser registry metadata (static) | USD | `0.00` |
| `total_cost` | `cost_per_page × page_count` | USD | `0.00` |
| `is_local` | Already in parser registry | boolean | `true` |

All current parsers are local ($0). The infrastructure exists for when API-based parsers (Mistral OCR at ~$0.01/page, LlamaParse at ~$0.003/page) are added in Phase 6. The parser registry already has `is_local` and `requires_api_key` fields — we add `cost_per_page_usd` to `ParserInfo`.

### Structure Quality Metrics

These are heuristic signals computed from the markdown output. They don't measure "correctness" (that would require ground truth), but they surface what each parser *detected*:

| Metric | How to compute | What it tells you | Example |
|--------|---------------|-------------------|---------|
| `heading_count` | Count lines matching `^#{1,6}\s` | How much document structure was preserved | `12` |
| `heading_depth` | Max heading level found (`#` = 1, `######` = 6) | Whether nested structure was detected | `3` |
| `table_count` | Count distinct markdown table blocks (consecutive lines with `\|`) | Whether tables were extracted vs flattened to text | `5` |
| `list_count` | Count `^[\s]*[-*+]\s` and `^[\s]*\d+\.\s` blocks | Whether lists were structured vs inline | `8` |
| `image_count` | Count `!\[` patterns | How many images/figures were referenced | `3` |
| `code_block_count` | Count `` ``` `` fence pairs | Whether code sections were preserved | `0` |
| `char_count` | `len(markdown)` | Raw output size (proxy for completeness) | `45832` |
| `word_count` | `len(markdown.split())` | Readable content volume | `7204` |
| `line_count` | `markdown.count('\n') + 1` | Output density | `312` |
| `page_break_count` | Count `\f` characters | Whether parser emits page boundaries | `22` |

These are intentionally simple — regex-based, no NLP, no ML. They run in < 10ms even on large documents.

---

## SQLite Schema Extension

### New table: `parser_metrics`

```sql
CREATE TABLE parser_metrics (
    job_id              TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    parser_name         TEXT NOT NULL,
    heading_count       INTEGER NOT NULL DEFAULT 0,
    heading_depth       INTEGER NOT NULL DEFAULT 0,
    table_count         INTEGER NOT NULL DEFAULT 0,
    list_count          INTEGER NOT NULL DEFAULT 0,
    image_count         INTEGER NOT NULL DEFAULT 0,
    code_block_count    INTEGER NOT NULL DEFAULT 0,
    char_count          INTEGER NOT NULL DEFAULT 0,
    word_count          INTEGER NOT NULL DEFAULT 0,
    line_count          INTEGER NOT NULL DEFAULT 0,
    page_break_count    INTEGER NOT NULL DEFAULT 0,
    computed_at         TEXT NOT NULL,  -- ISO 8601
    PRIMARY KEY (job_id, parser_name)
);
```

This table is populated immediately after a parser's markdown is saved to disk (`storage.save_result()`). The metrics computation happens in the same background task — no extra async work.

### Parser registry extension

Add `cost_per_page_usd: float` to `ParserInfo` dataclass and `ParserInfoResponse` schema. All current parsers: `0.0`.

---

## Sub-Phase Breakdown

### Phase 4.1 — Backend Metrics Engine

**Goal:** Compute structure quality metrics from markdown on parse completion, store them in SQLite, and expose via a new `/metrics` endpoint.

**Deliverables:**

- **Metrics computation module** — `services/metrics.py`:
  - `compute_structure_metrics(markdown: str) → StructureMetrics` — pure function, no I/O
  - Uses regex patterns to count each metric:
    ```python
    heading_count = len(re.findall(r'^#{1,6}\s', markdown, re.MULTILINE))
    heading_depth = max((len(m.group(1)) for m in re.finditer(r'^(#{1,6})\s', markdown, re.MULTILINE)), default=0)
    table_count   = count_table_blocks(markdown)  # consecutive lines containing |
    list_count    = count_list_blocks(markdown)    # consecutive list items
    image_count   = len(re.findall(r'!\[', markdown))
    code_block_count = markdown.count('```') // 2
    char_count    = len(markdown)
    word_count    = len(markdown.split())
    line_count    = markdown.count('\n') + 1
    page_break_count = markdown.count('\f')
    ```
  - `count_table_blocks()` — walks lines, counts transitions into table regions (lines with `|`)
  - `count_list_blocks()` — walks lines, counts transitions into list regions (lines starting with `- `, `* `, `+ `, or `1. `)
  - Returns a `StructureMetrics` dataclass

- **Database migration** — `services/database.py`:
  - Add `parser_metrics` table creation to `init_db()` migration chain
  - New migration version check (same pattern as the `execution_device` column migration in Phase 2)

- **Storage integration** — update `services/storage.py`:
  - New method: `save_metrics(job_id: str, parser_name: str, metrics: StructureMetrics) → None`
    - INSERT OR REPLACE into `parser_metrics`
  - New method: `get_metrics(job_id: str) → dict[str, ParserMetrics]`
    - SELECT all parser_metrics rows for job
    - JOIN with `parser_results` for `elapsed_seconds`, `execution_device`
    - JOIN with `jobs` for `page_count`
    - Returns combined speed + quality metrics per parser

- **Parser service integration** — update `services/parser_service.py`:
  - After `storage.save_result()` succeeds, compute metrics and call `storage.save_metrics()`
  - This happens inside the existing `_run_single_parser()` background task
  - If metrics computation fails (unlikely), log warning but don't fail the parse

- **Schemas** — `schemas/metrics.py`:
  ```python
  class SpeedMetrics(BaseModel):
      elapsed_seconds: float
      time_per_page: float | None  # None if page_count unknown
      execution_device: Literal["cuda", "mps", "cpu"] | None

  class CostMetrics(BaseModel):
      cost_per_page_usd: float  # 0.0 for local parsers
      total_cost_usd: float     # cost_per_page × page_count
      is_local: bool

  class StructureMetrics(BaseModel):
      heading_count: int
      heading_depth: int
      table_count: int
      list_count: int
      image_count: int
      code_block_count: int
      char_count: int
      word_count: int
      line_count: int
      page_break_count: int

  class ParserMetrics(BaseModel):
      parser_name: str
      speed: SpeedMetrics
      cost: CostMetrics
      structure: StructureMetrics

  class JobMetricsResponse(BaseModel):
      job_id: str
      page_count: int
      parsers: dict[str, ParserMetrics]
  ```

- **API endpoint** — `api/v1/jobs.py`:
  - `GET /api/v1/jobs/{job_id}/metrics` → `JobMetricsResponse`
  - Returns 404 if job not found
  - Returns metrics for all parsers that have completed (parsers still running or errored are omitted)
  - Speed metrics derived from `parser_results` + `jobs.page_count`
  - Cost metrics derived from parser registry's `cost_per_page_usd` + `jobs.page_count`
  - Structure metrics from `parser_metrics` table

- **Parser registry update** — `parsers/registry.py`:
  - Add `cost_per_page_usd: float = 0.0` to `ParserInfo` dataclass
  - Add a `get_parser_cost(parser_name: str) → float` helper

- **Schema update** — `schemas/parsers.py`:
  - Add `cost_per_page_usd: float` to `ParserInfoResponse`

**Definition of Done:**
- After parsing completes, `parser_metrics` rows exist for each completed parser
- `GET /metrics` returns speed, cost, and structure metrics for all completed parsers
- Metrics computation adds < 50ms to the parse pipeline (even for 100-page documents)
- Existing parse flow is not broken — metrics are a non-blocking addition
- `GET /parsers` now includes `cost_per_page_usd` (0.0 for all current parsers)

---

### Phase 4.2 — Frontend Metrics Dashboard

**Goal:** Display metrics visually — summary cards per parser, a comparative ranking table, and a "best for this document" recommendation.

**Deliverables:**

- **API client update** — `api.ts`:
  - `getMetrics(jobId: string): Promise<JobMetricsResponse>` — `GET /api/v1/jobs/{job_id}/metrics`

- **Types update** — `types/index.ts`:
  ```typescript
  type SpeedMetrics = {
    elapsed_seconds: number;
    time_per_page: number | null;
    execution_device: "cuda" | "mps" | "cpu" | null;
  };

  type CostMetrics = {
    cost_per_page_usd: number;
    total_cost_usd: number;
    is_local: boolean;
  };

  type StructureMetrics = {
    heading_count: number;
    heading_depth: number;
    table_count: number;
    list_count: number;
    image_count: number;
    code_block_count: number;
    char_count: number;
    word_count: number;
    line_count: number;
    page_break_count: number;
  };

  type ParserMetrics = {
    parser_name: string;
    speed: SpeedMetrics;
    cost: CostMetrics;
    structure: StructureMetrics;
  };

  type JobMetricsResponse = {
    job_id: string;
    page_count: number;
    parsers: Record<string, ParserMetrics>;
  };
  ```

- **Metrics summary cards** — `components/metrics-cards.tsx`:
  - Displayed **above** the comparison panels (between parser selector/progress and the PDF/result grid)
  - Horizontal scrollable row of cards, one per completed parser
  - Each card shows:
    - Parser name + device badge
    - Speed: `14.9s` (total) / `0.65s/page`
    - Cost: `$0.00` (or `$0.02/page` for future API parsers)
    - Key structure signals as small icons + counts:
      - `H` icon + heading count (e.g., `H 12`)
      - Table icon + table count (e.g., `⊞ 5`)
      - Image icon + image count (e.g., `🖼 3`)
      - `¶` + word count (e.g., `¶ 7.2k`)
    - Color-coded border: green for fastest, default for others
  - Cards are compact — fits 4 parsers in a row at 1440px width
  - Clicking a card switches the active parser tab in the comparison view

- **Comparative ranking table** — `components/metrics-table.tsx`:
  - Expandable section below the metrics cards (collapsed by default, "Show detailed comparison" toggle)
  - Full table with parsers as rows and metrics as columns:

    | Parser | Time | Time/Page | Device | Cost | Headings | Tables | Lists | Images | Words | Chars |
    |--------|------|-----------|--------|------|----------|--------|-------|--------|-------|-------|
    | Docling | 14.9s | 0.65s/pg | GPU-CUDA | $0.00 | 12 | 5 | 8 | 3 | 7204 | 45832 |
    | PyMuPDF4LLM | 5.9s | 0.26s/pg | CPU | $0.00 | 10 | 3 | 6 | 0 | 6891 | 43120 |
    | Marker | 22.1s | 0.96s/pg | GPU-CUDA | $0.00 | 11 | 5 | 7 | 3 | 7102 | 44980 |
    | Unstructured | 18.4s | 0.80s/pg | CPU | $0.00 | 8 | 2 | 4 | 1 | 5430 | 35210 |

  - Column headers are sortable (click to sort ascending/descending)
  - **Cell highlighting**: for each column, the best value gets a green accent, worst gets a muted/red accent
    - Speed: lowest is best (green)
    - Structure counts: highest is best (green) — more detected = more complete extraction
  - Responsive: horizontally scrollable on narrow screens

- **"Best for this document" recommendation** — `components/best-parser.tsx`:
  - Small card/banner shown above or within the metrics section
  - Computes a weighted score per parser:
    ```
    score = w_structure × structure_score + w_speed × speed_score
    ```
  - `structure_score`: normalized (0–1) based on total detections (headings + tables + lists + images) relative to the max across parsers
  - `speed_score`: normalized (0–1) inverse of elapsed time relative to fastest parser
  - Default weights: `w_structure = 0.7`, `w_speed = 0.3` (structure matters more than speed for RAG engineers)
  - Display:
    - "**Best for this document: Docling** — highest structure extraction (12 headings, 5 tables) with competitive speed."
    - Runner-up mention: "Runner-up: Marker (similar structure, 48% slower)"
  - Weights are NOT user-configurable in this phase (keep it simple; Phase 6 can add a slider)

- **Page integration** — update `app/page.tsx`:
  - Fetch metrics via `getMetrics(jobId)` after `parseState` becomes `"completed"`
  - Store in state: `const [metrics, setMetrics] = useState<JobMetricsResponse | null>(null)`
  - Render metrics section between progress/selector and comparison grid
  - Metrics section is only visible when `parseState === "completed"` and metrics are loaded

**Definition of Done:**
- After parsing, metrics cards appear showing speed, cost, and structure signals per parser
- The comparative table ranks all parsers with sortable columns and best/worst highlighting
- A "best for this document" recommendation is visible and gives a clear, justified verdict
- Clicking a metrics card switches the active parser in the comparison view
- The metrics section looks polished in dark mode and doesn't break the layout on 13" screens

---

### Phase 4.3 — Metrics Polish & Edge Cases

**Goal:** Handle edge cases, add visual flair, and ensure metrics are robust across document types.

**Deliverables:**

- **Parser tab badges** — update parser tabs (in comparison view):
  - Add a small speed badge to each tab: `docling · 14.9s · 0.65s/pg · GPU-CUDA`
  - The `time_per_page` addition gives per-page context that's missing today

- **Error parser handling in metrics**:
  - Parsers that errored are excluded from metrics and scoring
  - If only 1 parser completed, hide the comparative table and recommendation (nothing to compare)
  - If 0 parsers completed, show "No metrics available — all parsers failed"

- **Metric tooltips**:
  - Each metric in the cards/table has a hover tooltip explaining what it measures
  - Example: hovering `⊞ 5` shows "5 markdown tables detected in parser output"
  - Example: hovering `H 12` shows "12 headings detected (max depth: H3)"

- **Metrics for re-parse**:
  - When the user triggers a new parse on the same job (re-running parsers), old metrics are replaced
  - The `INSERT OR REPLACE` in `save_metrics()` handles this naturally

- **Structure quality radar/bar mini-chart** (stretch goal):
  - Replace the icon+number layout in metrics cards with a small inline bar chart
  - Each bar represents a structure metric, normalized to the max across parsers
  - Gives a visual "fingerprint" of what each parser captured
  - Implementation: inline SVG, no charting library needed

- **Metrics loading state**:
  - While metrics are being fetched, show skeleton cards (gray pulsing blocks)
  - Metrics fetch should complete in < 100ms (reading from SQLite), so skeleton may flash briefly

**Definition of Done:**
- Edge cases (all parsers failed, single parser, re-parse) are handled gracefully
- Tooltips explain every metric for users unfamiliar with the signals
- Parser tabs include time-per-page context
- No layout regressions on any supported screen size

---

## Updated API Endpoints (Phase 4 addition)

| Method | Path | Request | Response | Status | Phase |
|--------|------|---------|----------|--------|-------|
| **`GET`** | **`/api/v1/jobs/{job_id}/metrics`** | — | **`JobMetricsResponse`** | 200 | **4** |

All other endpoints remain unchanged. The `/parsers` endpoint gains a `cost_per_page_usd` field.

---

## New & Modified Files Summary

### Phase 4.1 — Backend

**New files:**
```
backend/src/parsearena/
├── services/metrics.py           # Structure quality computation (pure functions)
└── schemas/metrics.py            # Metrics-related Pydantic models
```

**Modified files:**
```
backend/src/parsearena/
├── services/database.py          # Add parser_metrics table migration
├── services/storage.py           # save_metrics(), get_metrics() methods
├── services/parser_service.py    # Call metrics computation after save_result()
├── api/v1/jobs.py                # Add GET /metrics endpoint
├── parsers/registry.py           # Add cost_per_page_usd to ParserInfo
└── schemas/parsers.py            # Add cost_per_page_usd to ParserInfoResponse
```

### Phase 4.2 — Frontend

**New files:**
```
frontend/src/
├── components/metrics-cards.tsx   # Per-parser summary cards
├── components/metrics-table.tsx   # Comparative ranking table
└── components/best-parser.tsx     # "Best for this document" recommendation
```

**Modified files:**
```
frontend/src/
├── app/page.tsx                   # Fetch + render metrics section
├── api.ts                         # Add getMetrics() function
└── types/index.ts                 # Metrics-related types
```

### Phase 4.3 — Polish

**Modified files:**
```
frontend/src/
├── components/metrics-cards.tsx   # Tooltips, skeleton loading
├── components/metrics-table.tsx   # Error state, single-parser handling
├── components/best-parser.tsx     # Edge case messaging
└── app/page.tsx                   # Parser tab speed badges
```

---

## Dependencies

### Backend
No new Python packages. All computation uses Python stdlib (`re`, `dataclasses`). SQLite is already configured via `aiosqlite`.

### Frontend
No new npm packages. Metrics cards, table, and mini-charts use Tailwind + inline SVG. No charting library needed for V1.

---

## Scoring Algorithm Detail

The "best for this document" recommendation uses a simple weighted score:

```python
def compute_parser_score(metrics: ParserMetrics, all_metrics: list[ParserMetrics]) -> float:
    """Score from 0.0 (worst) to 1.0 (best)."""

    # Structure score: sum of detections, normalized to max across parsers
    structure_total = (
        metrics.structure.heading_count
        + metrics.structure.table_count
        + metrics.structure.list_count
        + metrics.structure.image_count
    )
    max_structure = max(
        (m.structure.heading_count + m.structure.table_count +
         m.structure.list_count + m.structure.image_count)
        for m in all_metrics
    )
    structure_score = structure_total / max_structure if max_structure > 0 else 0.0

    # Speed score: inverse of time, normalized to fastest parser
    min_time = min(m.speed.elapsed_seconds for m in all_metrics)
    speed_score = min_time / metrics.speed.elapsed_seconds if metrics.speed.elapsed_seconds > 0 else 0.0

    # Weighted combination
    W_STRUCTURE = 0.7
    W_SPEED = 0.3
    return W_STRUCTURE * structure_score + W_SPEED * speed_score
```

**Why these weights:**
- ParseArena's target user is a RAG engineer choosing a parser for *quality*. Speed matters, but not as much as whether the parser actually extracted the tables, headings, and structure from the document.
- A parser that's 3x slower but catches all 5 tables (vs 2 tables) is the better choice for RAG.
- The weights are hardcoded for V1. Phase 6 could add a user-adjustable slider.

**Why NOT use word/char count in scoring:**
- Word count is a proxy for "how much text was extracted" but can be misleading — a parser that extracts OCR garbage will have high word count but low quality.
- Structure signals (headings, tables, lists) are better indicators of *useful* extraction for RAG.
- Word count is still shown in the metrics table for manual inspection.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regex-based metrics miss edge cases (e.g., tables inside code blocks counted twice) | Slightly inaccurate structure counts | These are heuristics, not exact counts. Document them as "approximate" in tooltips. Good enough for parser comparison — both parsers are measured with the same heuristics. |
| "Best parser" recommendation feels authoritative but is based on simple heuristics | Users over-trust the recommendation | Frame it as a *suggestion* not a verdict: "Based on structure extraction and speed, Docling appears strongest for this document." Explain the scoring in a tooltip. |
| Metrics add latency to parse pipeline | Slower parse completion | Metrics computation is < 10ms for 100-page docs (string ops, no I/O). Negligible compared to parser runtimes (5–60s). |
| Adding a table to SQLite requires migration handling | Schema version drift | Use the same migration pattern as Phase 2 (version check + ALTER TABLE / CREATE TABLE). Existing installs auto-migrate on startup. |
| Future API parsers have variable pricing | Cost metrics become stale | Cost data is in the parser registry, not hardcoded. When API parsers are added (Phase 6), their cost is defined in the registry entry alongside install commands. |

---

## Open Questions

| # | Question | Current Thinking |
|---|----------|-----------------|
| 1 | Should metrics be re-computed if the user re-parses with different parsers? | **Yes.** `INSERT OR REPLACE` in `save_metrics()` handles this. Old metrics for the same parser are overwritten. New parsers get new rows. |
| 2 | Should the scoring weights be user-configurable? | **No for V1.** Keep it simple. Phase 6 can add a slider if users request it. |
| 3 | Should we store the computed score in SQLite? | **No.** Scores are derived from metrics + weights. If weights become configurable, stored scores would be stale. Compute on-the-fly in the API response or client-side. |
| 4 | What about image extraction quality (not just count)? | **Deferred.** Counting `![` patterns tells you if images were referenced, not if they were actually extracted. Real image quality assessment would need OCR comparison or pixel diffing — way out of scope for V1. |
| 5 | Should metrics persist after job cleanup (7-day auto-delete from PRD §5)? | **No.** Metrics are tied to job lifecycle. When a job is cleaned up, its metrics go with it (CASCADE delete). |

---

## Phase 4 Definition of Done (Overall)

- [ ] After parsing, each parser shows speed (`14.9s, 0.65s/page`) and cost (`$0.00`) in metrics cards
- [ ] Structure quality signals (heading count, table count, list count, image count, word count) are visible per parser
- [ ] A comparative table ranks all parsers by each metric with sortable columns
- [ ] Best and worst values in each column are highlighted
- [ ] A "best for this document" recommendation gives a justified verdict based on weighted scoring
- [ ] Metrics are computed on parse completion and stored in SQLite (no re-computation on page load)
- [ ] The metrics endpoint returns data in < 100ms
- [ ] Edge cases handled: all parsers failed, single parser, re-parse
- [ ] Metrics are accurate — elapsed_seconds matches parser timing within 10% tolerance
- [ ] The dashboard works on both 13" (1440×900) and 27" 4K screens without layout issues
