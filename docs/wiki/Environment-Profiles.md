# Environment Profiles

Reproducible environments are managed with `uv` using committed `backend/pyproject.toml` + `backend/uv.lock`.

## Quick Start

From repo root:

```bash
cd backend
uv sync --frozen
```

This installs the base backend environment exactly from lockfile.

## One-Command Profiles

Run from `backend/`:

### Base only (minimal API)

```bash
uv sync --frozen
```

### Base + all local parsers

```bash
uv sync --frozen --group parsers-all
```

### Base + all parsers + CUDA GPU (Linux/NVIDIA)

```bash
uv sync --frozen --group parsers-all --group gpu-cuda
```

### Base + all parsers + MPS GPU (Apple Silicon)

```bash
uv sync --frozen --group parsers-all --group gpu-mps
```

## Notes

- CUDA profile is wired to PyTorch CUDA wheels (`cu128`) via `tool.uv.index` + `tool.uv.sources`.
- MPS profile uses the same torch version range and relies on macOS MPS support.
- Unstructured parser also needs system packages:
  - Ubuntu/Debian: `sudo apt install -y tesseract-ocr poppler-utils`
  - macOS: `brew install tesseract poppler`

## Re-locking

When dependencies change:

```bash
cd backend
uv lock
```

Then commit both:

- `backend/pyproject.toml`
- `backend/uv.lock`
