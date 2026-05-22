"use client";

import type { DiffSummary } from "@/types";

type DiffSummaryProps = {
  summary: DiffSummary;
  parserAName: string;
  parserBName: string;
};

function buildQuickVerdict(summary: DiffSummary, parserAName: string, parserBName: string): string {
  if (summary.added === 0 && summary.removed === 0 && summary.changed === 0) {
    return `${parserAName} and ${parserBName} produced structurally identical outputs.`;
  }
  if (summary.added > summary.removed) {
    return `${parserBName} captured more unique blocks than ${parserAName}.`;
  }
  if (summary.removed > summary.added) {
    return `${parserAName} captured more unique blocks than ${parserBName}.`;
  }
  return `Both parsers capture similar structure, with ${summary.changed} changed blocks.`;
}

function categoryLine(label: string, countA: number, countB: number): string {
  const diff = countA - countB;
  if (diff === 0) {
    return `${label}: A ${countA}, B ${countB} (matched)`;
  }
  if (diff > 0) {
    return `${label}: A ${countA}, B ${countB} (${diff} missing in B)`;
  }
  return `${label}: A ${countA}, B ${countB} (${Math.abs(diff)} missing in A)`;
}

export function DiffSummaryCard({ summary, parserAName, parserBName }: DiffSummaryProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {summary.matched} matched · {summary.added} added in B · {summary.removed} missing from B · {summary.changed} changed
      </p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{categoryLine("Headings", summary.headingsA, summary.headingsB)}</p>
        <p>{categoryLine("Tables", summary.tablesA, summary.tablesB)}</p>
        <p>{categoryLine("Paragraphs", summary.paragraphsA, summary.paragraphsB)}</p>
      </div>
      <p className="text-xs text-foreground/80">{buildQuickVerdict(summary, parserAName, parserBName)}</p>
    </section>
  );
}
