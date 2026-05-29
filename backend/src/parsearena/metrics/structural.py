from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(slots=True)
class StructuralMetrics:
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


_HEADING_RE = re.compile(r"^(#{1,6})\s", flags=re.MULTILINE)
_LIST_ITEM_RE = re.compile(r"^(?:[-*]\s|\d+\.\s)", flags=re.MULTILINE)
_IMAGE_RE = re.compile(r"!\[[^\]]*]\([^)]+\)")
_WORD_RE = re.compile(r"\b\w+\b")

_NOISE_REPEATED_RULE_RE = re.compile(r"^[-=_]{5,}$")
_NOISE_SYMBOLS_RE = re.compile(r"^[■●▪◦]{3,}")
_NOISE_PAGE_NUMBER_RE = re.compile(r"^\d+$")
_NOISE_PAGE_HEADER_RE = re.compile(r"^(?:Page|page)\s+\d+")


def compute_structural_metrics(markdown: str, page_count: int) -> StructuralMetrics:
    lines = markdown.splitlines()
    total_lines = len(lines)
    non_empty_lines = [line for line in lines if line.strip()]
    empty_line_ratio = (
        (total_lines - len(non_empty_lines)) / total_lines if total_lines > 0 else 0.0
    )

    heading_levels = [len(match.group(1)) for match in _HEADING_RE.finditer(markdown)]
    heading_h1_count = sum(1 for level in heading_levels if level == 1)
    heading_h2_count = sum(1 for level in heading_levels if level == 2)
    heading_h3_plus_count = sum(1 for level in heading_levels if level >= 3)

    list_item_count = len(_LIST_ITEM_RE.findall(markdown))
    image_reference_count = len(_IMAGE_RE.findall(markdown))
    unicode_error_count = markdown.count("�")

    code_block_count = _count_code_blocks(lines)
    table_count = _count_table_blocks(lines)
    noise_line_count = _count_noise_lines(lines)

    word_count = len(_WORD_RE.findall(markdown))
    character_count = len(markdown)
    words_per_page = word_count / page_count if page_count > 0 else float(word_count)

    return StructuralMetrics(
        word_count=word_count,
        character_count=character_count,
        heading_count=len(heading_levels),
        heading_h1_count=heading_h1_count,
        heading_h2_count=heading_h2_count,
        heading_h3_plus_count=heading_h3_plus_count,
        table_count=table_count,
        list_item_count=list_item_count,
        code_block_count=code_block_count,
        image_reference_count=image_reference_count,
        empty_line_ratio=empty_line_ratio,
        noise_line_count=noise_line_count,
        unicode_error_count=unicode_error_count,
        words_per_page=words_per_page,
    )


def _count_code_blocks(lines: list[str]) -> int:
    blocks = 0
    inside_block = False
    for line in lines:
        if line.strip().startswith("```"):
            if not inside_block:
                blocks += 1
                inside_block = True
            else:
                inside_block = False
    return blocks


def _count_table_blocks(lines: list[str]) -> int:
    table_blocks = 0
    in_table = False
    for line in lines:
        contains_delimiter = "|" in line and line.strip() != "|"
        if contains_delimiter and not in_table:
            table_blocks += 1
            in_table = True
        elif not contains_delimiter:
            in_table = False
    return table_blocks


def _count_noise_lines(lines: list[str]) -> int:
    noise_count = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == "---":
            continue
        if _NOISE_REPEATED_RULE_RE.match(stripped):
            noise_count += 1
            continue
        if _NOISE_SYMBOLS_RE.match(stripped):
            noise_count += 1
            continue
        if _NOISE_PAGE_NUMBER_RE.match(stripped):
            noise_count += 1
            continue
        if _NOISE_PAGE_HEADER_RE.match(stripped):
            noise_count += 1
    return noise_count
