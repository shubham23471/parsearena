"use client";

import { useEffect, useMemo, useState } from "react";

import { getParserMarkdownDownloadUrl } from "@/api";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import type { ParseResult, ParserMetricsResponse, ParserStatus, ViewMode } from "@/types";

type ParserPanelProps = {
  jobId: string;
  title: string;
  parserNames: string[];
  activeParser: string | null;
  onParserChange: (parserName: string) => void;
  parserStatuses: Record<string, ParserStatus>;
  result: ParseResult | null | undefined;
  activePage: number;
  totalPages: number;
  linkedScrollingEnabled: boolean;
  isScrollSource: boolean;
  onPageChange: (page: number) => void;
  viewMode: ViewMode;
  metrics: ParserMetricsResponse | null;
  otherVisibleParsers?: string[];
  emptyMessage?: string;
  emptyIsError?: boolean;
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

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(1)}s`;
}

function toExecutionDevice(
  value: string | null | undefined
): "cuda" | "mps" | "cpu" | null {
  if (value === "cuda" || value === "mps" || value === "cpu") {
    return value;
  }
  return null;
}

function getParserCaveat(parserName: string | null): string | null {
  if (!parserName) {
    return null;
  }
  const normalized = parserName.toLowerCase();
  if (normalized === "unstructured") {
    return "Running with strategy='auto'. For higher quality, Unstructured recommends strategy='hi_res'.";
  }
  if (normalized === "marker") {
    return "Running full ML pipeline with default model weights.";
  }
  if (normalized === "docling") {
    return "Running with default pipeline options. Table structure extraction uses default model.";
  }
  if (normalized === "pymupdf4llm") {
    return "Rule-based extraction, no ML models. Fastest but no OCR capability.";
  }
  if (normalized === "markitdown") {
    return "Microsoft's converter with PDF plugins enabled.";
  }
  return null;
}

export function ParserPanel({
  jobId,
  title,
  parserNames,
  activeParser,
  onParserChange,
  parserStatuses,
  result,
  activePage,
  totalPages,
  linkedScrollingEnabled,
  isScrollSource,
  onPageChange,
  viewMode,
  metrics,
  otherVisibleParsers = [],
  emptyMessage,
  emptyIsError = false
}: ParserPanelProps) {
  const [contentVisible, setContentVisible] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const parserStatus = activeParser ? parserStatuses[activeParser] : undefined;
  const parserMetadata = result?.metadata ?? null;
  const hasParserChoices = parserNames.length > 0;
  const showTabBar = viewMode === "tab";
  const showParserSelector = viewMode === "split" || viewMode === "compare";

  const completedParserOptions = useMemo(
    () => parserNames.filter((parserName) => parserStatuses[parserName]?.status === "completed"),
    [parserNames, parserStatuses]
  );

  useEffect(() => {
    setContentVisible(false);
    const timeoutId = window.setTimeout(() => {
      setContentVisible(true);
    }, 80);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeParser]);

  useEffect(() => {
    setDetailsExpanded(false);
    setMetricsExpanded(false);
  }, [activeParser]);

  const dropdownOptions = completedParserOptions.length > 0 ? completedParserOptions : parserNames;
  const parserDownloadUrl = activeParser ? getParserMarkdownDownloadUrl(jobId, activeParser) : null;
  const canDownloadParserOutput = Boolean(activeParser && result && parserStatus?.status === "completed");
  const parserCaveat = getParserCaveat(activeParser);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{title}</span>
          {activeParser && <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{activeParser}</span>}
          {parserCaveat && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-border text-[10px] text-muted-foreground"
              title={parserCaveat}
              aria-label="Parser caveat"
            >
              ⓘ
            </span>
          )}
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
          {activeParser && (
            <button
              type="button"
              onClick={() => {
                setDetailsExpanded((previous) => !previous);
              }}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              ⓘ Details
            </button>
          )}
          {activeParser && (
            <button
              type="button"
              onClick={() => {
                setMetricsExpanded((previous) => !previous);
              }}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              Metrics
            </button>
          )}
        </div>

        {showParserSelector && hasParserChoices && (
          <div className="flex items-center gap-2">
            {canDownloadParserOutput && parserDownloadUrl && (
              <a
                href={parserDownloadUrl}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                Download .md
              </a>
            )}
            <select
              value={activeParser ?? parserNames[0] ?? ""}
              onChange={(event) => {
                onParserChange(event.target.value);
              }}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {dropdownOptions.map((parserName) => {
                const status = parserStatuses[parserName];
                const isVisibleElsewhere = otherVisibleParsers.includes(parserName) && parserName !== activeParser;
                const timing =
                  status?.elapsed_seconds !== null && status?.elapsed_seconds !== undefined
                    ? ` · ${status.elapsed_seconds.toFixed(1)}s`
                    : "";
                return (
                  <option key={parserName} value={parserName} disabled={isVisibleElsewhere}>
                    {`${parserName}${timing}${isVisibleElsewhere ? " · Already visible" : ""}`}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      <div
        className={[
          "overflow-hidden border-b border-border bg-muted/10 transition-all duration-200",
          detailsExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-b-0"
        ].join(" ")}
      >
        <div className="space-y-3 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Run Details</span>
            <span className="rounded border border-border px-2 py-0.5">
              Version:{" "}
              {parserMetadata?.library_version ??
                parserStatus?.library_version ??
                "unknown"}
            </span>
            <span className="rounded border border-border px-2 py-0.5">
              Device: {getDeviceLabel(toExecutionDevice(parserMetadata?.execution_device ?? parserStatus?.execution_device))}
            </span>
          </div>

          <p>
            {parserMetadata?.is_warm_start
              ? `Model Load: cached | Parse: ${formatSeconds(parserMetadata.parse_only_seconds)} | Total: ${formatSeconds(result?.elapsed_seconds)}`
              : `Model Load: ${formatSeconds(parserMetadata?.model_load_seconds)} | Parse: ${formatSeconds(parserMetadata?.parse_only_seconds)} | Total: ${formatSeconds(result?.elapsed_seconds)}`}
          </p>

          {parserMetadata?.gpu_fallback && (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
              ⚠ GPU failed — fell back to CPU
            </p>
          )}

          <div className="space-y-1">
            <p className="font-medium text-foreground">Config Summary</p>
            <pre className="overflow-x-auto rounded border border-border bg-background px-2 py-2 text-[11px] text-muted-foreground">
              {JSON.stringify(parserMetadata?.config_summary ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div
        className={[
          "overflow-hidden border-b border-border bg-muted/5 transition-all duration-200",
          metricsExpanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0 border-b-0"
        ].join(" ")}
      >
        <div className="px-4 pb-3">
          <MetricsPanel parserName={activeParser ?? "parser"} metrics={metrics} />
        </div>
      </div>

      {showTabBar && hasParserChoices && (
        <div className="overflow-x-auto border-b border-border px-2">
          <div className="flex min-w-max items-stretch gap-1">
            {parserNames.map((parserName) => {
              const status = parserStatuses[parserName];
              const isActive = activeParser === parserName;
              const statusDotClassName =
                status?.status === "completed"
                  ? "bg-emerald-400"
                  : status?.status === "error"
                    ? "bg-red-400"
                    : "bg-muted-foreground/50";
              return (
                <button
                  key={parserName}
                  type="button"
                  onClick={() => {
                    onParserChange(parserName);
                  }}
                  className={[
                    "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs transition-colors",
                    isActive
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  ].join(" ")}
                >
                  <span className={["h-2 w-2 rounded-full", statusDotClassName].join(" ")} />
                  <span className="font-medium">{parserName}</span>
                  {status?.elapsed_seconds !== null && status?.elapsed_seconds !== undefined && (
                    <span className="text-[11px]">{status.elapsed_seconds.toFixed(1)}s</span>
                  )}
                  <span className="text-[11px]">{getDeviceLabel(status?.execution_device)}</span>
                </button>
              );
            })}
          </div>
          {canDownloadParserOutput && parserDownloadUrl && (
            <div className="flex justify-end pb-2 pr-1">
              <a
                href={parserDownloadUrl}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                Download .md
              </a>
            </div>
          )}
        </div>
      )}

      <div className="p-4 flex-grow overflow-auto">
        {!activeParser && (
          emptyIsError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-400">{emptyMessage ?? "Parse failed."}</p>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center opacity-80">
              <div className="mb-4 rounded-full bg-muted/40 p-5">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {emptyMessage ?? (hasParserChoices ? "Select a parser to view output." : "No parser results available yet.")}
              </p>
            </div>
          )
        )}

        {activeParser && parserStatus?.status === "error" && (
          <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-400">{parserStatus.error ?? "Parser failed."}</p>
          </div>
        )}

        {activeParser && result && (
          <div className={["transition-opacity duration-200", contentVisible ? "opacity-100" : "opacity-0"].join(" ")}>
            <div className="relative">
              <MarkdownViewer
                markdown={result.markdown}
                activePage={activePage}
                totalPages={totalPages}
                linkedScrollingEnabled={linkedScrollingEnabled}
                isScrollSource={isScrollSource}
                onPageChange={onPageChange}
              />
              {linkedScrollingEnabled && (
                <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
                  Page {activePage} / {Math.max(totalPages, 1)}
                </div>
              )}
            </div>
          </div>
        )}

        {activeParser && !result && parserStatus?.status !== "error" && (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? "Result not available for this parser."}
          </p>
        )}
      </div>
    </section>
  );
}
