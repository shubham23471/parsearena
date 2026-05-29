# ParseArena Methodology

ParseArena is designed as a practical **comparison playground** for real documents. It helps you inspect parser behavior quickly, but it is not intended to publish leaderboard-style claims.

## What are default settings?

In ParseArena, each parser runs with an out-of-the-box configuration chosen to mirror a normal first-run setup.

- **PyMuPDF4LLM:** `to_markdown(..., page_chunks=True)` for page-aligned output.
- **Docling:** default pipeline options with accelerator set from device detection.
- **Marker:** default model artifacts with device-aware converter reuse.
- **Unstructured:** `partition_pdf(..., strategy="auto")`.
- **MarkItDown:** `enable_plugins=True`, with fallback to `False` only when plugin mode fails.

Default settings are deliberate: they keep the comparison transparent and easy to reproduce.

## How is timing measured?

Timing is reported as:

- **Total wall-clock (`elapsed_seconds`)**: end-to-end latency users feel.
- **Model load time (`model_load_seconds`)**: setup/initialization time when measurable.
- **Parse-only time (`parse_only_seconds`)**: conversion time excluding model loading when measurable.

For cached/warm runs, model-load may be near zero. For fallback scenarios (for example GPU to CPU), timing reflects the successful execution path.

## What metrics are computed?

ParseArena computes reference-free structural descriptors from Markdown:

- Content volume: word count, character count, words per page.
- Structure counts: headings, tables, list items, code blocks, image references.
- Quality signals: empty-line ratio, likely-noise lines, unicode replacement character count.
- Chunk simulation: heading-based split behavior with fallback character splitting and preview chunks.

These are descriptive signals for inspection, not universal quality scores.

## Known limitations

ParseArena does not:

- tune parser-specific advanced options per document,
- measure downstream retrieval accuracy or task-level answer quality,
- evaluate semantic correctness with ground-truth labels,
- normalize all parser-specific formatting conventions into a single canonical style.

You should treat results as decision support, not an absolute scorecard.

## Parser-specific caveats

- **Unstructured:** running with `strategy="auto"`; `hi_res` may improve certain layouts.
- **Marker:** full ML pipeline with default model weights.
- **Docling:** default pipeline settings, including default table extraction behavior.
- **PyMuPDF4LLM:** rule-based extraction, no OCR model pipeline.
- **MarkItDown:** plugin-enabled conversion with safe fallback when needed.

## How to interpret results

Use ParseArena to answer practical questions for your own corpus:

1. Which parser preserves headings/tables/lists best for this PDF type?
2. Which output chunks cleanly for your RAG splitter?
3. Is latency acceptable for your deployment constraints?
4. Are there parser-specific artifacts you need to post-process?

Choose a parser as a starting point, then tune based on your domain needs.

## Why not a benchmark?

A benchmark implies standardized datasets, fixed protocols, and score-oriented ranking. ParseArena intentionally focuses on exploratory comparison with user-provided files and default settings. Different PDFs reward different parser behaviors, so the product goal is transparency and informed selection, not declaring a single best parser.
