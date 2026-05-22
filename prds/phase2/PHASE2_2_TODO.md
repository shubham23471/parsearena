 # Phase 2.2 TODO — Parser Adapter Implementations

- [x] Add `DoclingParser` adapter in `backend/src/parsearena/parsers/docling_parser.py`.
- [x] Add `MarkerParser` adapter in `backend/src/parsearena/parsers/marker_parser.py` with converter/model caching.
- [x] Add `UnstructuredParser` adapter in `backend/src/parsearena/parsers/unstructured_parser.py`.
- [x] Ensure each adapter returns `ParseResult` with markdown, elapsed time, and page count.
- [x] Ensure each adapter provides clear missing-dependency errors with exact `uv add ...` install commands.
- [x] Remove MinerU parser code (`backend/src/parsearena/parsers/mineru_parser.py`).
- [x] Remove Mistral OCR parser code (`backend/src/parsearena/parsers/mistral_ocr_parser.py`).
- [x] Export all parser adapters from `backend/src/parsearena/parsers/__init__.py`.
- [x] Keep existing `PyMuPDF4LLMParser` implementation unchanged.
