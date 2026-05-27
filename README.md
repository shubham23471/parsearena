# ParseArena 🛡️

**A local-first, open-source playground to visually compare, evaluate, and diff PDF-to-Markdown parsers side-by-side.**

Choosing the right PDF parser for your Retrieval-Augmented Generation (RAG) pipeline is hard. Benchmarks are often run on clean, academic datasets, but your production documents are messy contracts, complex tables, multi-column research papers, and scanned invoices.

**ParseArena** lets you drag and drop your own PDFs, run them through multiple popular parsers simultaneously, and compare the original document next to each parser's Markdown output. No writing glue code, no configuring databases, and no uploading your private data to third-party APIs.

---

## 🌟 Key Features

- **Side-by-Side Visualizer:** Render your original PDF right next to the parsed Markdown output with synchronized scrolling (Linked Scrolling).
- **Multi-Parser Parallel Execution:** Trigger multiple parsers at once and watch their progress, runtimes, and hardware devices (CPU/GPU) in real time.
- **Multiple View Modes:**
  - **Tab Mode:** View the PDF alongside a single parser's output (optimized for laptops).
  - **Split Mode:** View the PDF alongside two parser outputs simultaneously (optimized for wider screens).
  - **Compare Mode:** Hide the PDF and compare two parser outputs side-by-side.
  - **Diff Mode:** Computes a block-level structural diff (headings, paragraphs, lists, tables) highlighting what was added, removed, or modified between two parser outputs.
- **Dynamic Parser Detection:** The backend auto-detects which libraries are installed in your environment, presenting copy-paste setup tooltips in the UI for missing ones.
- **Local-First & Lightweight:** Built using Fast API, SQLite, Next.js, and Tailwind CSS. Data is stored on disk and metadata in a zero-config SQLite database.

---

## 📦 Supported Parsers

ParseArena supports both lightweight layout extractors and heavy deep learning models. 

| Parser | Type | Key Features | System Requirements | Install Command |
| :--- | :--- | :--- | :--- | :--- |
| **PyMuPDF4LLM** | Local (Rule-based) | Blazing fast, clean markdown structure, low memory footprint. | None | `uv add pymupdf4llm` |
| **Docling** (IBM) | Local (ML-based) | Outstanding layout analysis, table extraction, and reading order preservation. | None | `uv add docling` |
| **Marker** | Local (ML-based) | High-fidelity OCR and formatting recovery (tuned for papers and books). | PyTorch (GPU recommended) | `uv add marker-pdf` |
| **Unstructured** | Local (Rule/ML) | Modular document partitioner with traditional layout algorithms. | `tesseract-ocr`, `poppler-utils` | `uv add "unstructured[pdf]"` |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+ (managed via [`uv`](https://github.com/astral-sh/uv))
- Node.js 18+ (managed via `npm`)
- Optional system dependencies for Unstructured/OCR:
  - **macOS:** `brew install tesseract poppler`
  - **Ubuntu/Debian:** `sudo apt install tesseract-ocr poppler-utils`

---

### 1. Setup Backend

Clone the repository and navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment and install core dependencies:
```bash
uv sync
```

#### Installing Parsers
You can install specific parsers or install all of them at once using `uv` dependency groups:

*   **Install all parsers:**
    ```bash
    uv sync --group parsers-all
    ```
*   **Install all parsers + CUDA GPU acceleration (Linux):**
    ```bash
    uv sync --group parsers-all --group gpu-cuda
    ```
*   **Install all parsers + Metal GPU acceleration (macOS):**
    ```bash
    uv sync --group parsers-all --group gpu-mps
    ```

Start the FastAPI backend (runs on port `8000` by default):
```bash
uv run uvicorn parsearena.main:app --reload
```

---

### 2. Setup Frontend

Open a new terminal window and navigate to the frontend directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Next.js development server (runs on port `3000` by default):
```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser, drag in a PDF, and start comparing!

---

## ⌨️ Keyboard Shortcuts

Power through parser comparisons with built-in shortcuts:

*   `1` - `9`: Switch active parser tab (in Tab Mode).
*   `[` / `]`: Cycle to the previous / next parser.
*   `v` then `t` / `s` / `c`: Switch view mode (Tab, Split, Compare).
*   `l`: Toggle Linked Scrolling.
*   `?`: Toggle keyboard shortcut help popup.

---

## 🛡️ License

This project is open-source and licensed under the MIT License.
