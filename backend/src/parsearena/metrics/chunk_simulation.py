from __future__ import annotations

from dataclasses import dataclass
import re
import statistics


@dataclass(slots=True)
class ChunkSimulationResult:
    chunk_count: int
    avg_chunk_size_chars: int
    min_chunk_size_chars: int
    max_chunk_size_chars: int
    chunk_size_std_dev: float
    preview_chunks: list[str]


_HEADING_RE = re.compile(r"^#{1,3}\s")


def simulate_chunks(markdown: str) -> ChunkSimulationResult:
    chunks = _split_by_headings(markdown)
    if not any(_HEADING_RE.match(line) for line in markdown.splitlines()):
        chunks = _recursive_character_split(markdown, chunk_size=1000)

    normalized_chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
    if not normalized_chunks:
        normalized_chunks = [""]

    sizes = [len(chunk) for chunk in normalized_chunks]
    avg_size = int(round(sum(sizes) / len(sizes))) if sizes else 0
    min_size = min(sizes) if sizes else 0
    max_size = max(sizes) if sizes else 0
    std_dev = statistics.pstdev(sizes) if len(sizes) > 1 else 0.0
    preview_chunks = [_truncate(chunk, 200) for chunk in normalized_chunks[:3]]

    return ChunkSimulationResult(
        chunk_count=len(normalized_chunks),
        avg_chunk_size_chars=avg_size,
        min_chunk_size_chars=min_size,
        max_chunk_size_chars=max_size,
        chunk_size_std_dev=std_dev,
        preview_chunks=preview_chunks,
    )


def _split_by_headings(markdown: str) -> list[str]:
    lines = markdown.splitlines()
    chunks: list[str] = []
    current: list[str] = []
    for line in lines:
        if _HEADING_RE.match(line) and current:
            chunks.append("\n".join(current))
            current = [line]
            continue
        current.append(line)
    if current:
        chunks.append("\n".join(current))
    return chunks


def _recursive_character_split(text: str, chunk_size: int) -> list[str]:
    stripped = text.strip()
    if not stripped:
        return [""]
    if len(stripped) <= chunk_size:
        return [stripped]

    split_index = stripped.rfind("\n", 0, chunk_size)
    if split_index < chunk_size // 2:
        split_index = stripped.rfind(" ", 0, chunk_size)
    if split_index < chunk_size // 2:
        split_index = chunk_size

    head = stripped[:split_index].strip()
    tail = stripped[split_index:].strip()
    if not tail:
        return [head]
    return [head, *_recursive_character_split(tail, chunk_size)]


def _truncate(value: str, length: int) -> str:
    if len(value) <= length:
        return value
    return f"{value[:length].rstrip()}..."
