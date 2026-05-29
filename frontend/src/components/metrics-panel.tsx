"use client";

import { useState } from "react";

import type { ParserMetricsResponse } from "@/types";

type MetricsPanelProps = {
  parserName: string;
  metrics: ParserMetricsResponse | null;
};

function formatNumber(value: number): string {
  return Intl.NumberFormat().format(value);
}

function formatFloat(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function MetricsPanel({ parserName, metrics }: MetricsPanelProps) {
  const [chunkPreviewExpanded, setChunkPreviewExpanded] = useState(false);
  if (!metrics) {
    return (
      <section className="mt-4 rounded-lg border border-border bg-muted/10 p-3">
        <p className="text-xs text-muted-foreground">
          Metrics are not available yet for <span className="font-medium">{parserName}</span>.
        </p>
      </section>
    );
  }

  const structural = metrics.structural_metrics;
  const chunks = metrics.chunk_simulation;

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-muted/10 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Output Metrics</h3>
        <span className="text-[11px] text-muted-foreground">{parserName}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Words" value={formatNumber(structural.word_count)} />
        <MetricCard label="Characters" value={formatNumber(structural.character_count)} />
        <MetricCard label="Words/Page" value={formatFloat(structural.words_per_page, 1)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        <MetricCard label="Headings" value={formatNumber(structural.heading_count)} />
        <MetricCard label="H1 / H2 / H3+" value={`${structural.heading_h1_count}/${structural.heading_h2_count}/${structural.heading_h3_plus_count}`} />
        <MetricCard label="Tables" value={formatNumber(structural.table_count)} />
        <MetricCard label="Lists" value={formatNumber(structural.list_item_count)} />
        <MetricCard label="Code Blocks" value={formatNumber(structural.code_block_count)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Images" value={formatNumber(structural.image_reference_count)} />
        <MetricCard label="Noise Lines" value={formatNumber(structural.noise_line_count)} />
        <MetricCard label="Unicode Errors" value={formatNumber(structural.unicode_error_count)} />
      </div>

      <div className="rounded border border-border bg-background p-2">
        <p className="text-xs text-muted-foreground">
          Empty line ratio: <span className="font-medium text-foreground">{formatFloat(structural.empty_line_ratio, 3)}</span>
        </p>
      </div>

      <div className="rounded border border-border bg-background p-2">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground"
          onClick={() => {
            setChunkPreviewExpanded((prev) => !prev);
          }}
        >
          <span>Chunk Preview</span>
          <span className="text-muted-foreground">{chunkPreviewExpanded ? "Hide" : "Show"}</span>
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          Count {chunks.chunk_count} • Avg {chunks.avg_chunk_size_chars} • Min {chunks.min_chunk_size_chars} • Max {chunks.max_chunk_size_chars}
        </p>
        {chunkPreviewExpanded && (
          <div className="mt-2 space-y-2">
            {chunks.preview_chunks.length === 0 && (
              <p className="text-xs text-muted-foreground">No chunk previews available.</p>
            )}
            {chunks.preview_chunks.map((chunk, index) => (
              <pre key={`${index}-${chunk.slice(0, 24)}`} className="whitespace-pre-wrap rounded border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                {chunk}
              </pre>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
