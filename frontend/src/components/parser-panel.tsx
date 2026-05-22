"use client";

import { MarkdownViewer } from "@/components/markdown-viewer";
import type { ParseResult, ParserStatus } from "@/types";

type ParserPanelProps = {
  title: string;
  parserNames: string[];
  activeParser: string | null;
  onParserChange: (parserName: string) => void;
  parserStatuses: Record<string, ParserStatus>;
  result: ParseResult | null | undefined;
  activePage: number;
  totalPages: number;
  linkedScrollingEnabled: boolean;
  onActivePageChange: (page: number, sourceId: string) => void;
  scrollSourceId: string;
  showParserSelector?: boolean;
};

function getDeviceLabel(device: "cuda" | "mps" | "cpu" | null | undefined): string {
  if (device === "cuda") {
    return "GPU-CUDA";
  }
  if (device === "mps") {
    return "GPU-MPS";
  }
  if (device === "cpu") {
    return "CPU";
  }
  return "Detecting";
}

export function ParserPanel({
  title,
  parserNames,
  activeParser,
  onParserChange,
  parserStatuses,
  result,
  activePage,
  totalPages,
  linkedScrollingEnabled,
  onActivePageChange,
  scrollSourceId,
  showParserSelector = false
}: ParserPanelProps) {
  const parserStatus = activeParser ? parserStatuses[activeParser] : undefined;
  const hasParserChoices = parserNames.length > 0;

  return (
    <section className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{title}</span>
          {activeParser && <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{activeParser}</span>}
          {parserStatus?.elapsed_seconds !== null &&
            parserStatus?.elapsed_seconds !== undefined &&
            parserStatus.status === "completed" && (
              <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                {parserStatus.elapsed_seconds.toFixed(1)}s
              </span>
            )}
          {parserStatus && (
            <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
              {getDeviceLabel(parserStatus.execution_device)}
            </span>
          )}
        </div>

        {showParserSelector && hasParserChoices && (
          <select
            value={activeParser ?? parserNames[0] ?? ""}
            onChange={(event) => {
              onParserChange(event.target.value);
            }}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {parserNames.map((parserName) => (
              <option key={parserName} value={parserName}>
                {parserName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4">
        {!activeParser && (
          <p className="text-sm text-muted-foreground">
            {hasParserChoices ? "Select a parser to view output." : "No parser results available yet."}
          </p>
        )}

        {activeParser && parserStatus?.status === "error" && (
          <p className="text-sm text-red-400">{parserStatus.error ?? "Parser failed."}</p>
        )}

        {activeParser && result && (
          <MarkdownViewer
            markdown={result.markdown}
            activePage={activePage}
            totalPages={totalPages}
            linkedScrollingEnabled={linkedScrollingEnabled}
            onActivePageChange={onActivePageChange}
            scrollSourceId={scrollSourceId}
          />
        )}

        {activeParser && !result && parserStatus?.status !== "error" && (
          <p className="text-sm text-muted-foreground">Result not available for this parser.</p>
        )}
      </div>
    </section>
  );
}
