from __future__ import annotations

from pydantic import BaseModel


class StructuralMetricsResponse(BaseModel):
    word_count: int
    character_count: int
    heading_count: int
    heading_h1_count: int
    heading_h2_count: int
    heading_h3_plus_count: int
    table_count: int
    list_item_count: int
    code_block_count: int
    image_reference_count: int
    empty_line_ratio: float
    noise_line_count: int
    unicode_error_count: int
    words_per_page: float


class ChunkSimulationResponse(BaseModel):
    chunk_count: int
    avg_chunk_size_chars: int
    min_chunk_size_chars: int
    max_chunk_size_chars: int
    chunk_size_std_dev: float
    preview_chunks: list[str]


class MetricsResponse(BaseModel):
    structural_metrics: StructuralMetricsResponse
    chunk_simulation: ChunkSimulationResponse
