# Phase 3.3 TODO — Structural Diff View

- [x] Add diff-related types in `frontend/src/types/index.ts` (`DiffBlockType`, `DiffStatus`, `DiffBlock`, `InlineDiff`, `DiffResult`, `DiffSummary`).
- [x] Build structural markdown diff engine in `frontend/src/lib/diff.ts` with block parsing + LCS matching.
- [x] Add word-level inline diff integration using the installed `diff` package.
- [x] Create `frontend/src/components/diff-summary.tsx` with stats, category breakdown, and quick verdict.
- [x] Create `frontend/src/components/diff-viewer.tsx` with two-column color-coded structural diff.
- [x] Add collapsible identical sections in the diff view.
- [x] Integrate Diff mode in `frontend/src/app/page.tsx` with parser A/B selectors and swap button.
- [x] Enable Diff mode in `frontend/src/components/view-mode-toggle.tsx`.
- [x] Ensure Diff view uses completed parser results only and handles empty/error states gracefully.
