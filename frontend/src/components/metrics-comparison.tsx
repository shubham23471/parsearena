"use client";

import type { ParserMetricsResponse } from "@/types";

type MetricsComparisonProps = {
  parserAName: string;
  parserBName: string;
  metricsA: ParserMetricsResponse;
  metricsB: ParserMetricsResponse;
};

type Row = {
  label: string;
  valueA: number;
  valueB: number;
};

function highlightClass(value: number, other: number): string {
  if (value > 0 && other > 0 && value >= other * 2) {
    return "bg-emerald-500/10 text-emerald-300";
  }
  return "";
}

function formatMetric(value: number): string {
  if (Number.isInteger(value)) {
    return Intl.NumberFormat().format(value);
  }
  return value.toFixed(2);
}

export function MetricsComparison({
  parserAName,
  parserBName,
  metricsA,
  metricsB
}: MetricsComparisonProps) {
  const a = metricsA.structural_metrics;
  const b = metricsB.structural_metrics;
  const chunkA = metricsA.chunk_simulation;
  const chunkB = metricsB.chunk_simulation;

  const rows: Row[] = [
    { label: "Word count", valueA: a.word_count, valueB: b.word_count },
    { label: "Character count", valueA: a.character_count, valueB: b.character_count },
    { label: "Words per page", valueA: a.words_per_page, valueB: b.words_per_page },
    { label: "Headings", valueA: a.heading_count, valueB: b.heading_count },
    { label: "H1 count", valueA: a.heading_h1_count, valueB: b.heading_h1_count },
    { label: "H2 count", valueA: a.heading_h2_count, valueB: b.heading_h2_count },
    { label: "H3+ count", valueA: a.heading_h3_plus_count, valueB: b.heading_h3_plus_count },
    { label: "Table count", valueA: a.table_count, valueB: b.table_count },
    { label: "List item count", valueA: a.list_item_count, valueB: b.list_item_count },
    { label: "Code block count", valueA: a.code_block_count, valueB: b.code_block_count },
    { label: "Image refs", valueA: a.image_reference_count, valueB: b.image_reference_count },
    { label: "Noise line count", valueA: a.noise_line_count, valueB: b.noise_line_count },
    { label: "Unicode errors", valueA: a.unicode_error_count, valueB: b.unicode_error_count },
    { label: "Empty line ratio", valueA: a.empty_line_ratio, valueB: b.empty_line_ratio },
    { label: "Chunk count", valueA: chunkA.chunk_count, valueB: chunkB.chunk_count },
    { label: "Avg chunk size", valueA: chunkA.avg_chunk_size_chars, valueB: chunkB.avg_chunk_size_chars },
    { label: "Min chunk size", valueA: chunkA.min_chunk_size_chars, valueB: chunkB.min_chunk_size_chars },
    { label: "Max chunk size", valueA: chunkA.max_chunk_size_chars, valueB: chunkB.max_chunk_size_chars },
    { label: "Chunk size std dev", valueA: chunkA.chunk_size_std_dev, valueB: chunkB.chunk_size_std_dev }
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Metrics Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">Metric</th>
              <th className="px-2 py-2 text-right font-medium">{parserAName}</th>
              <th className="px-2 py-2 text-right font-medium">{parserBName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/40 last:border-b-0">
                <td className="px-2 py-2 text-muted-foreground">{row.label}</td>
                <td className={["px-2 py-2 text-right font-medium", highlightClass(row.valueA, row.valueB)].join(" ")}>
                  {formatMetric(row.valueA)}
                </td>
                <td className={["px-2 py-2 text-right font-medium", highlightClass(row.valueB, row.valueA)].join(" ")}>
                  {formatMetric(row.valueB)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
