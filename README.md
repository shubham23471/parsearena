# ParseArena 🛡️

**A local-first, open-source playground to visually compare PDF-to-Markdown parsers side-by-side — using your own documents.**

Choosing a parser for real-world RAG pipelines is hard. Your PDFs are contracts, scans, multi-column reports, and table-heavy documents, and parser behavior changes a lot by file type.

**ParseArena** lets you upload your own PDFs, run multiple parsers, inspect outputs side-by-side, and make document-specific decisions without writing glue code.

---

## 🌟 Key Features


- **Local-First & Private:** All parsing happens on your machine. Documents never leave your system.
- **Side-by-Side Visualizer:** View the original PDF next to parser Markdown with linked scrolling.
- **Parallel Parser Runs:** Trigger multiple parsers together and inspect progress, timing, and execution device (CPU/GPU).
- **Multiple View Modes:**
  - **Tab Mode:** PDF + one parser output.
  - **Split Mode:** PDF + two parser outputs.
  - **Compare Mode:** Two parser outputs without PDF.
  - **Diff Mode:** Structural diff view for headings, paragraphs, lists, and tables.
- **Format-Normalized Diff:** Toggle between raw diff and normalized diff that ignores formatting conventions (e.g., `**bold**` vs `<b>bold</b>`), surfacing actual content differences.
- **Run Details Panel:** Expand any result to see library version, exact configuration, timing breakdown (model load vs. parse time), execution device, and GPU fallback warnings.
- **Metrics Comparison:** In Compare mode, view side-by-side metrics including word count, heading distribution (H1/H2/H3+), table count, list items, code blocks, noise lines, unicode errors, and chunk statistics.
- **Chunk Simulation Preview:** See how each parser's output would chunk for RAG—view chunk count, size distribution, and the first three chunks rendered inline.
- **Dynamic Parser Detection:** Installed parsers are auto-detected and missing setup commands are shown in UI.
---

## ⚖️ Methodology & Fairness

ParseArena is a **comparison playground**, not a benchmark suite.

- **Default settings only:** Parsers run with out-of-the-box configuration to represent first-run behavior.
- **Not maximum capability:** Libraries like Unstructured and Docling expose advanced tuning knobs that can improve results; ParseArena does not auto-tune parser-specific configs.
- **Configuration is visible:** Results include parser config, library version, execution details, and timing breakdown in the UI (`ⓘ Details`).
- **Your documents, your decision:** The goal is to help you choose a good starting point for your files. No universal winner is assumed.

See full methodology: `docs/wiki/METHODOLOGY.md`.

---

## 📦 Supported Parsers

| Parser | Type | Default Config | Key Features | System Requirements | Install Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PyMuPDF4LLM** | Local (Rule-based) | `page_chunks=True` | Fast markdown extraction with low memory usage. | None | `uv add pymupdf4llm` |
| **Docling** | Local (ML-based) | Default pipeline + device auto-detect | Strong layout and table extraction. | None | `uv add docling` |
| **Marker** | Local (ML-based) | Default model weights + device auto-detect | High-fidelity OCR and structure recovery. | PyTorch (GPU recommended) | `uv add marker-pdf` |
| **Unstructured** | Local (Rule/ML) | `strategy="auto"` | Modular PDF partitioning with structural elements. | `tesseract-ocr`, `poppler-utils` | `uv add "unstructured[pdf]"` |
| **MarkItDown** | Local (CPU) | `enable_plugins=True` (fallback to `False`) | Microsoft converter with broad format support. | None | `uv add "markitdown[pdf]"` |

---

## 📊 What's Measured

ParseArena computes descriptive metrics for each parser output:

- **Timing:** total wall-clock latency, plus model-load and parse-only timing where available.
- **Structure:** headings, tables, lists, code blocks, image references.
- **Quality signals:** noise-like lines, unicode replacement characters, empty-line ratio.
- **Chunk simulation:** heading-aware chunk stats and preview chunks for RAG-oriented inspection.

These are **inspection signals**, not absolute quality scores.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+ (managed via [`uv`](https://github.com/astral-sh/uv))
- Node.js 18+ (managed via `npm`)
- Optional system dependencies for Unstructured/OCR:
  - **macOS:** `brew install tesseract poppler`
  - **Ubuntu/Debian:** `sudo apt install tesseract-ocr poppler-utils`

### 1. Setup Backend

```bash
cd backend
uv sync
```

Install parser groups as needed:

- **All parsers:** `uv sync --group parsers-all`
- **All parsers + CUDA (Linux):** `uv sync --group parsers-all --group gpu-cuda`
- **All parsers + Metal (macOS):** `uv sync --group parsers-all --group gpu-mps`

Run backend:

```bash
uv run uvicorn parsearena.main:app --reload
```

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` and start comparing parser outputs.

---

## ⌨️ Keyboard Shortcuts

- `1` - `9`: switch parser tab (Tab mode)
- `[` / `]`: previous / next parser
- `v` then `t` / `s` / `c`: switch view mode
- `l`: toggle linked scrolling
- `?`: toggle shortcut help

---

## 🛡️ License

This project is open-source and licensed under the MIT License.
