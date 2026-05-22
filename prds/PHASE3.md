# Phase 3 — Side-by-Side Comparison View

**Parent PRD:** `prds/PRD.md`
**Depends on:** Phase 2 (complete)
**Goal:** Build the hero feature — a polished, adaptive visual comparison of parser outputs against the original PDF, with multi-panel layouts, structural diff, and a layout system that scales from 13" laptops to 27" 4K desktops.

**Estimated Effort:** 7–9 days across 3 sub-phases

---

## What Phase 2 Gave Us (Build Surface)

Before planning, here's what exists and what Phase 3 builds on:

| Layer | What exists (Phase 1 + 2) | What Phase 3 changes |
|-------|--------------------------|----------------------|
| **Layout** | Single vertical stack at `max-w-[1280px]`. Header → job info → parser selector → `lg:grid-cols-2` (PDF \| Result). | Fluid full-width layout with adaptive breakpoints. Comparison panels fill available screen width. |
| **Parser tabs** | Small text buttons in result panel header: `parserName · 14.9s · GPU-CUDA`. One active at a time. | Upgraded to a proper tab bar with active indicator. Multiple panels can be visible simultaneously in split/compare views. |
| **Synchronized scrolling** | `MarkdownViewer` syncs with `PdfViewer` via `activePdfPage` state. Page-boundary detection in markdown content. | Extended to work across multiple visible parser panels simultaneously. |
| **Dark mode** | Full dark mode via Tailwind `class` strategy. All components styled. | No changes needed — already complete. |
| **PDF viewer** | `PdfViewer` component using `react-pdf`. Page navigation, page count display, scrollable. | May add a minimize/collapse option for compare-only mode. |
| **Result viewer** | `MarkdownViewer` with `react-markdown` + `remark-gfm`. Handles page markers, headings, tables. | Reused as-is inside each comparison panel. |
| **Parser selector** | `ParserSelector` with checkbox cards, availability badges, select-all/deselect-all. | Shown pre-parse only (no changes). |
| **Progress** | `ParseProgress` with per-parser status polling at 1.5s interval. | No changes needed. |
| **API** | `GET /results` returns all parser results. `GET /results/{parser}` returns single result. | No backend API changes needed for Phase 3.1–3.2. Phase 3.3 may add a diff endpoint or compute diffs client-side. |
| **Types** | `ParseResult`, `JobStatus`, `ParserStatus` with timing, device, error fields. | Add view-mode related types. Phase 3.3 adds diff-related types. |

---

## Current Layout Analysis (from Screenshot)

The current UI at 1440×900 (13" laptop equivalent):

```
┌──────────────────────────────────────────────┐
│ PHASE 1.6 / ParseArena / description         │  ← Header (fixed)
├──────────────────────────────────────────────┤
│ Uploaded: file.pdf | Job ID: xxx | Status    │  ← Job info bar
├──────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐           │
│ │ ☑ PyMuPDF4LLM│  │ ☑ Docling    │           │  ← Parser selector
│ │ ☑ Marker     │  │ ☑ Unstructured│          │     (2×2 grid)
│ └──────────────┘  └──────────────┘           │
├──────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐    │
│ │   PDF Viewer     │ │  Parse Result     │   │  ← 50/50 split
│ │   Pages: 23      │ │  [docling][pymu]  │   │     (lg:grid-cols-2)
│ │                  │ │                   │   │
│ │  (rendered PDF)  │ │ (rendered markdown)│   │
│ │                  │ │                   │   │
│ └──────────────────┘ └──────────────────┘    │
└──────────────────────────────────────────────┘
         ← max-w-[1280px], centered →
```

**Problems at 27" 4K (2560×1440 logical @ 150% scaling):**
- The `max-w-[1280px]` container wastes ~50% of horizontal space — massive empty margins on both sides.
- Only one parser output visible at a time; user must tab-switch to compare.
- No way to view two parser outputs simultaneously for visual comparison.
- The layout doesn't adapt to available space — same experience on 13" and 27".

**What works well (keep these):**
- Clean vertical flow on small screens.
- Parser tabs with timing + device badges.
- Linked scrolling toggle.
- Dark mode aesthetic.

---

## Resolution & Breakpoint Strategy

### Why 1440×900 was the Phase 2 target

1440×900 CSS pixels is the **default logical resolution** of a 13" MacBook Air (native 2560×1600 at Apple's default "looks like 1440×900" Retina scaling). Most laptop users see this viewport. It's the minimum viable target — if it works here without horizontal scrolling, it works everywhere wider.

### Breakpoint plan for Phase 3

| Breakpoint | CSS width | Typical device | Layout behavior |
|-----------|-----------|----------------|-----------------|
| `sm` | < 768px | Not supported (desktop-only tool per PRD §7) | — |
| `md` | 768–1023px | Small windows, tablet | Single-column stack: PDF above, result below |
| `lg` | 1024–1439px | 13" laptop | **Tab mode only**: PDF (45%) + 1 parser (55%). No split view. |
| `xl` | 1440–1919px | 15" laptop, external 1080p | **Tab + Split**: PDF (35%) + 2 parsers (32.5% each). Split view unlocked. |
| `2xl` | 1920+ | 21"+ monitor, 27" 4K @ 150% | **Full multi-up**: PDF (30%) + 2–3 parsers. Compare mode (no PDF) with 2 full-width panels. |

The layout container switches from `max-w-[1280px]` to `max-w-[1920px] 2xl:max-w-[2400px]` with `w-full` and horizontal padding. At `2xl`, the content stretches to fill the monitor.

---

## View Modes

Phase 3 introduces a **view mode** concept — the user can choose how many panels are visible:

| Mode | Panels visible | Best for | Min breakpoint |
|------|---------------|----------|----------------|
| **Tab** (default) | PDF + 1 parser | Reading through one parser's output, 13" screens | `lg` |
| **Split** | PDF + 2 parsers | Comparing two parsers with PDF reference | `xl` |
| **Compare** | 2 parsers (no PDF) | Focused parser-vs-parser comparison | `lg` |
| **Diff** | 2 parsers (diff overlay) | Structural difference analysis | `lg` |

A **view mode toggle** in the comparison area header lets the user switch. On screens narrower than the mode's minimum breakpoint, that mode is disabled with a tooltip ("Wider screen needed").

---

## Sub-Phase Breakdown

### Phase 3.1 — Adaptive Layout & View Mode Switcher

**Goal:** Replace the fixed-width layout with a fluid system that scales from 13" to 27" 4K. Add a view mode toggle that controls how many comparison panels are visible.

**Deliverables:**

- **Layout overhaul** in `app/page.tsx`:
  - Replace `max-w-[1280px]` with adaptive max-width:
    - `lg`: `max-w-[1280px]` (same as today — no regression on 13")
    - `xl`: `max-w-[1600px]`
    - `2xl`: `max-w-[2400px]`
  - This is done with Tailwind classes: `max-w-screen-xl xl:max-w-[1600px] 2xl:max-w-[2400px] w-full`
  - Horizontal padding stays at `px-6`
  - The comparison grid switches from fixed `lg:grid-cols-2` to a dynamic grid based on view mode

- **View mode state** in `page.tsx`:
  - New state: `viewMode: "tab" | "split" | "compare" | "diff"` (default: `"tab"`)
  - View mode persists in `localStorage` so it survives page reload
  - Derived state: `visiblePanels` computed from `viewMode` + available results
  - For split mode: new state `secondaryParserTab: string | null` to track the second visible parser

- **View mode toggle** — `components/view-mode-toggle.tsx`:
  - Row of icon buttons in the comparison area header:
    - Tab icon (single pane) — `Columns2` from lucide
    - Split icon (PDF + 2) — `Columns3` from lucide
    - Compare icon (2 parsers) — `ColumnsIcon` or `SplitSquareHorizontal` from lucide
    - Diff icon (diff overlay) — `GitCompareArrows` from lucide (disabled until Phase 3.3)
  - Tooltip on each button showing the mode name
  - Active mode has a highlighted background
  - Modes requiring wider screens are disabled with tooltip "Requires wider screen" when viewport is too narrow
  - Uses `useMediaQuery` hook (or `window.matchMedia`) to detect breakpoints at runtime

- **Comparison panel grid** — update comparison section in `page.tsx`:
  - **Tab mode** (current behavior, slightly improved):
    ```
    grid-cols-[minmax(0,45fr)_minmax(0,55fr)]   (PDF 45%, Result 55%)
    ```
  - **Split mode**:
    ```
    grid-cols-[minmax(0,30fr)_minmax(0,35fr)_minmax(0,35fr)]   (PDF 30%, Parser A 35%, Parser B 35%)
    ```
    - Second parser selected via a dropdown in the second panel header
  - **Compare mode**:
    ```
    grid-cols-2   (Parser A 50%, Parser B 50%)
    ```
    - PDF viewer hidden (or collapsed to a thin strip with page thumbnails — stretch goal)
    - Both panels have their own parser selector dropdown
  - All panels independently scrollable, with linked scrolling applying to all visible panels simultaneously when enabled

- **Parser panel component** — `components/parser-panel.tsx`:
  - Extracted from the inline result section in `page.tsx`
  - Self-contained panel with:
    - Header: parser name, timing badge, device badge, parser selector dropdown (for split/compare mode)
    - Body: `MarkdownViewer` instance
    - Receives `parsers` list and `activeParser` as props
    - Emits `onParserChange` when user switches parser in the dropdown
  - Reuses existing `MarkdownViewer` component internally

- **Collapsible job info bar**:
  - After parsing completes, the job info bar (filename, job ID, statuses) collapses to a single-line summary
  - Expandable on click to show full details
  - This saves vertical space for the comparison panels — the hero feature should dominate the viewport

- **Responsive synchronized scrolling**:
  - The existing `activePdfPage` ↔ `MarkdownViewer` sync now works across all visible panels
  - When the user scrolls any parser panel, all other visible panels (including PDF) sync to the same page position
  - The source-of-truth is whichever panel the user is actively scrolling (detect via `onScroll` + `pointer-events` or a `scrollingSource` ref)

**New types** in `types/index.ts`:
```typescript
type ViewMode = "tab" | "split" | "compare" | "diff";
```

**Definition of Done:**
- On a 13" screen (1440×900), the app looks identical to today — no regression
- On a 27" 4K screen (2560×1440 at 150%), the comparison panels fill the available width
- User can switch to Split mode and see PDF + 2 parsers simultaneously on a wide screen
- User can switch to Compare mode and see 2 parsers side by side without the PDF
- View mode persists across page reload via localStorage
- Linked scrolling works across all visible panels

---

### Phase 3.2 — Comparison UX Polish

**Goal:** Polish the comparison experience with better panel headers, keyboard shortcuts, and visual refinements that make parser comparison faster and more intuitive.

**Deliverables:**

- **Improved parser tab bar** — update tab styling in `parser-panel.tsx`:
  - Replace small text buttons with a proper segmented tab bar
  - Each tab shows: parser name, elapsed time, device badge, status indicator (green dot for completed, red for error)
  - Active tab has a bottom border accent (not inverted colors)
  - Tabs are scrollable horizontally if many parsers are present (future-proofing for Phase 6 additional parsers)

- **Parser selector dropdown** for Split/Compare modes:
  - In Split and Compare modes, each panel has a dropdown at the top to select which parser to display
  - Dropdown shows all completed parsers with timing info
  - Prevents selecting the same parser in both panels (grayed out with "Already visible" label)

- **Keyboard shortcuts** for power users:
  - `1`–`4` (or `1`–`n`): Switch active parser tab in Tab mode
  - `[` / `]`: Switch to previous/next parser
  - `v` then `t`/`s`/`c`: Switch view mode (tab/split/compare)
  - `l`: Toggle linked scrolling
  - Shortcuts shown in a `?` help popover accessible from the header
  - Only active when no input element is focused

- **Panel resize handles** (stretch goal):
  - In Split and Compare modes, drag handles between panels allow resizing
  - Uses CSS `resize` or a lightweight library
  - Minimum panel width: 300px
  - Resize position persisted in localStorage

- **Page indicator overlay** on parser panels:
  - Small floating badge showing current page number (e.g., "Page 3 / 23") in the bottom-right of each parser panel
  - Matches the PDF viewer's page indicator
  - Only visible when linked scrolling is enabled

- **Empty state improvements**:
  - When no results exist yet: "Select parsers above and run to see comparison"
  - When in Split mode but only 1 parser completed: Second panel shows "Waiting for another parser to complete..." or a parser selector
  - When a parser errored: Panel shows error message with red accent, not just blank

- **Smooth transitions**:
  - View mode switch animates panel widths via CSS `transition-all duration-300`
  - Parser switch within a panel fades content (opacity transition)
  - No layout jank when switching modes

**Definition of Done:**
- Switching between parsers feels instant and polished (no flicker, smooth transitions)
- Tab bar clearly communicates which parser is active with timing/device context
- Keyboard shortcuts work for common comparison workflows
- Empty states and error states are handled gracefully in all view modes
- Split/Compare modes prevent duplicate parser selection across panels

---

### Phase 3.3 — Structural Diff View

**Goal:** Let users select two parser outputs and see a visual diff highlighting what each parser captured differently — the key analytical feature for parser evaluation.

**Deliverables:**

- **Diff computation engine** — `lib/diff.ts` (client-side):
  - Takes two markdown strings as input
  - Splits each into structural blocks:
    - Headings (by level)
    - Paragraphs
    - Tables (as a unit)
    - Lists
    - Code blocks
    - Page break markers
  - Computes block-level diff using a longest-common-subsequence (LCS) algorithm:
    - **Matched blocks**: Present in both outputs (possibly with minor text differences)
    - **Added blocks**: Present in Parser B but not Parser A
    - **Removed blocks**: Present in Parser A but not Parser B
    - **Changed blocks**: Same structural type at same position but significantly different content
  - For matched blocks with text differences, computes word-level inline diff
  - Returns a `DiffResult` structure with annotated blocks

- **Diff view component** — `components/diff-viewer.tsx`:
  - Two-column layout (Parser A | Parser B), synchronized scrolling
  - Color coding:
    - Green background: content unique to this parser (added)
    - Red background: content missing from this parser (removed)
    - Yellow/amber background: content present in both but with differences (changed)
    - No highlight: identical content
  - Within changed blocks, word-level diffs highlighted:
    - Green text: words added in this version
    - Red text with strikethrough: words removed in this version
  - Block type icons in the gutter: `H1`, `¶`, `┃` (table), `•` (list)
  - Collapsible identical sections: when many consecutive blocks are identical, collapse them with "N identical blocks" expander

- **Diff summary header** — shown above the diff view:
  - Stats card: "12 matched · 3 added in B · 2 missing from B · 5 changed"
  - Per-category breakdown:
    - Headings: "A: 8, B: 7 (1 missing)"
    - Tables: "A: 3, B: 3 (matched)"
    - Paragraphs: "A: 45, B: 42 (3 missing, 2 changed)"
  - Quick verdict: e.g., "Parser B captured all tables but missed 1 heading"

- **Parser selection for diff**:
  - When user switches to Diff view mode, two dropdown selectors appear: "Parser A" and "Parser B"
  - Defaults to first two completed parsers
  - Dropdown shows parser name + timing
  - Swap button (↔) to flip A and B

- **Backend consideration** — diff is computed **client-side**:
  - Both markdown strings are already available in `allResults` state
  - No new API endpoints needed
  - Diff computation is fast for typical document sizes (< 100 pages)
  - If performance becomes an issue with very large documents (> 50 pages), add a Web Worker wrapper — but start without it

- **New types** in `types/index.ts`:
  ```typescript
  type DiffBlockType = "heading" | "paragraph" | "table" | "list" | "code" | "page_break" | "other";

  type DiffStatus = "matched" | "added" | "removed" | "changed";

  interface DiffBlock {
    type: DiffBlockType;
    status: DiffStatus;
    contentA: string | null;
    contentB: string | null;
    inlineDiff?: InlineDiff[];
  }

  interface InlineDiff {
    text: string;
    status: "equal" | "added" | "removed";
  }

  interface DiffResult {
    blocks: DiffBlock[];
    summary: DiffSummary;
  }

  interface DiffSummary {
    matched: number;
    added: number;
    removed: number;
    changed: number;
    headingsA: number;
    headingsB: number;
    tablesA: number;
    tablesB: number;
    paragraphsA: number;
    paragraphsB: number;
  }
  ```

- **Dependency**: `diff` npm package for word-level diffing (or implement a simple LCS — the `diff` package is lightweight and battle-tested).

**Definition of Done:**
- User can switch to Diff mode, select two parsers, and see a color-coded structural diff
- Identical blocks are collapsed by default to focus attention on differences
- The diff summary gives an at-a-glance comparison (counts + quick verdict)
- Word-level inline diffs highlight exactly what changed within similar blocks
- Diff view scrolls synchronously between the two panels
- Performance is acceptable for documents up to 50 pages (< 500ms to compute diff)

---

## New & Modified Files Summary

### Phase 3.1 — New files
```
frontend/src/
├── components/view-mode-toggle.tsx    # View mode switcher (tab/split/compare/diff)
├── components/parser-panel.tsx        # Self-contained parser result panel
└── hooks/use-media-query.ts           # Responsive breakpoint detection hook
```

### Phase 3.1 — Modified files
```
frontend/src/
├── app/page.tsx                       # Layout overhaul, view mode state, adaptive grid
├── types/index.ts                     # Add ViewMode type
└── components/markdown-viewer.tsx     # Multi-panel scroll sync support
```

### Phase 3.2 — Modified files
```
frontend/src/
├── components/parser-panel.tsx        # Improved tabs, dropdown selector, page indicator
├── components/view-mode-toggle.tsx    # Keyboard shortcut integration
├── app/page.tsx                       # Keyboard event handlers, transitions
└── app/globals.css                    # Transition utilities if needed
```

### Phase 3.3 — New files
```
frontend/src/
├── lib/diff.ts                        # Markdown structural diff engine
├── components/diff-viewer.tsx         # Two-column diff display
└── components/diff-summary.tsx        # Diff stats header card
```

### Phase 3.3 — Modified files
```
frontend/src/
├── app/page.tsx                       # Diff mode integration
├── types/index.ts                     # Diff-related types
└── components/view-mode-toggle.tsx    # Enable diff button
```

---

## Frontend Dependencies (Phase 3)

| Package | Purpose | Phase | Auto-install |
|---------|---------|-------|-------------|
| `diff` | Word-level text diffing for structural comparison | 3.3 | **No** — output install command |

Install command:
```bash
npm install diff @types/diff
```

No backend dependencies needed for Phase 3. All changes are frontend-only.

---

## Responsive Layout Specification

### Viewport: 1440×900 (13" laptop — minimum target)

```
┌────────────────────────────── 1440px ──────────────────────────────┐
│  px-6 │                  max-w-[1280px]                     │ px-6 │
│       │ ┌─────────────────────────────────────────────────┐ │      │
│       │ │ Header + Job Info (collapsed one-liner)         │ │      │
│       │ ├─────────────────────────────────────────────────┤ │      │
│       │ │ [Tab] [Split ░] [Compare] [Diff ░]  Linked ☑   │ │      │
│       │ ├───────────────────────┬─────────────────────────┤ │      │
│       │ │                      │                          │ │      │
│       │ │     PDF Viewer       │   Parser Output (tabbed) │ │      │
│       │ │     ~570px           │   ~680px                 │ │      │
│       │ │                      │   [docling|pymu|marker]  │ │      │
│       │ │                      │                          │ │      │
│       │ └───────────────────────┴─────────────────────────┘ │      │
│       └─────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

- Split mode disabled (grayed out) — not enough width for 3 panels.
- Compare mode works: 2 panels at ~630px each.
- Tab mode is default and matches current behavior.

### Viewport: 2560×1440 (27" 4K @ 150% scaling)

```
┌────────────────────────────────────── 2560px ──────────────────────────────────────┐
│  px-6 │                         max-w-[2400px]                              │ px-6 │
│       │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│       │ │ Header + Job Info (collapsed one-liner)                        │ │      │
│       │ ├─────────────────────────────────────────────────────────────────┤ │      │
│       │ │ [Tab] [Split] [Compare] [Diff]                     Linked ☑   │ │      │
│       │ ├─────────────┬───────────────────────┬───────────────────────────┤ │      │
│       │ │             │                       │                           │ │      │
│       │ │  PDF Viewer  │  Parser A (docling)   │  Parser B (pymupdf4llm)  │ │      │
│       │ │  ~700px     │  ~820px               │  ~820px                  │ │      │
│       │ │             │                       │                           │ │      │
│       │ │             │  [dropdown to switch]  │  [dropdown to switch]    │ │      │
│       │ │             │                       │                           │ │      │
│       │ └─────────────┴───────────────────────┴───────────────────────────┘ │      │
│       └─────────────────────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- All view modes available.
- Split mode is the sweet spot: PDF + 2 parsers visible at once.
- Compare mode gives two very wide panels (~1170px each) for detailed reading.

---

## Design Decisions & Rationale

| Decision | Alternatives considered | Why this choice |
|----------|------------------------|-----------------|
| **Client-side diff** | Backend diff endpoint | Both markdown strings are already in browser memory. No network round-trip. Simpler architecture. Move to backend only if perf is an issue (unlikely for < 100 pages). |
| **Block-level diff first, word-level second** | Pure line-level diff (like `git diff`) | Line-level diff is noisy for prose — a reworded paragraph shows every line as changed. Block-level groups content logically (headings, tables, paragraphs) and shows the structural picture first. Word-level within blocks catches fine-grained differences. |
| **View mode toggle (not auto-detect)** | Auto-switch layout based on screen width | Users should control their layout. Auto-switching would be jarring when resizing windows. Default to Tab mode everywhere, let users upgrade to Split/Compare when they want. |
| **localStorage for view mode** | URL query param, React state only | survives reload without polluting URLs. Low-stakes preference — if localStorage is cleared, user just gets the default. |
| **Extract ParserPanel component** | Keep inline in page.tsx | page.tsx is already 285 lines. Multi-panel modes would make it unmanageable. ParserPanel encapsulates the header + tabs + markdown viewer + scroll sync for one panel. |
| **Disable modes on narrow screens** | Hide the buttons entirely | Disabling with tooltip educates the user about what's possible on a wider display. Hiding would make the feature invisible. |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-panel layout causes layout jank on resize | Choppy UX | Use CSS grid with `fr` units (browser handles resize natively). Avoid JS-driven layout. |
| Synchronized scrolling across 3 panels causes scroll loops | Panels bounce/fight | Use a `scrollSourceRef` to track which panel the user is actively scrolling. Only sync *from* the active panel *to* others. Debounce scroll events. |
| Diff algorithm is slow on large documents | UI freezes | Start with sync computation. If > 200ms, wrap in `requestIdleCallback` or Web Worker. Documents > 50 pages show a "Computing diff..." skeleton. |
| `diff` npm package adds bundle size | Slower page load | `diff` is ~15KB minified. Acceptable. Can also lazy-import it only when diff mode is activated. |
| Too many view modes confuse users | Cognitive overload | Default to Tab mode (familiar). View toggle has clear icons + tooltips. Keyboard shortcut help is opt-in (`?` button). |
| Panel resize handles are fiddly on touchpads | Frustrating UX | Mark resize handles as a stretch goal. Fixed proportions via CSS grid are simpler and work for most use cases. Revisit if users request. |

---

## Open Questions

| # | Question | Current Thinking |
|---|----------|-----------------|
| 1 | Should Compare mode completely hide the PDF, or show a collapsed thumbnail strip? | **Hide completely** for V1. Thumbnail strip is a nice-to-have but adds complexity. Users can switch back to Tab/Split to see the PDF. |
| 2 | Should diff computation happen eagerly (on parse complete) or lazily (when user enters diff mode)? | **Lazy.** Most users will use Tab/Split mode. Don't waste cycles computing diffs until requested. Cache the result after first computation. |
| 3 | How to handle diff when parsers produce wildly different output lengths? | The block-level diff handles this naturally — unmatched blocks show as "added" or "removed." The summary stats make the size disparity obvious. |
| 4 | Should keyboard shortcuts be enabled by default or opt-in? | **Enabled by default** but only active when no input is focused. Most dev tools (Figma, VS Code, Chrome DevTools) do this. Show a small `?` badge to discover them. |
| 5 | What about page-level diff (compare page 3 of Parser A vs page 3 of Parser B)? | **Defer.** Block-level diff across the full document is more useful. Page-level comparison is only meaningful if both parsers emit page markers at the same positions, which isn't guaranteed. |

---

## Phase 3 Definition of Done (Overall)

- [ ] On a 13" screen (1440×900), the app works at least as well as today — no regression
- [ ] On a 27" 4K screen (2560×1440 at 150%), the comparison panels fill the available width intelligently
- [ ] User can switch between Tab, Split, Compare, and Diff view modes
- [ ] Split mode shows PDF + 2 parser outputs simultaneously on wide screens
- [ ] Compare mode shows 2 parser outputs side by side without the PDF
- [ ] Diff mode shows a structural diff between two selected parsers with color coding
- [ ] Diff summary shows at-a-glance comparison stats
- [ ] Switching between parsers and view modes feels instant (no reload, smooth transitions)
- [ ] Linked scrolling works across all visible panels in any view mode
- [ ] View mode preference persists across page reload
- [ ] Keyboard shortcuts available for common comparison workflows
- [ ] The UI looks polished in dark mode at all supported resolutions
