"use client";

import { useEffect, useMemo, useState } from "react";

import { MarkdownViewer } from "@/components/markdown-viewer";
import type { ParseResult, ParserStatus, ViewMode } from "@/types";

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
  viewMode: ViewMode;
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
  viewMode,
  otherVisibleParsers = [],
  emptyMessage,
  emptyIsError = false
}: ParserPanelProps) {
  const [contentVisible, setContentVisible] = useState(true);
  const parserStatus = activeParser ? parserStatuses[activeParser] : undefined;
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

  const dropdownOptions = completedParserOptions.length > 0 ? completedParserOptions : parserNames;

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
        )}
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
        </div>
      )}

      <div className="p-4">
        {!activeParser && (
          emptyIsError ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-sm text-red-300">{emptyMessage ?? "Parse failed."}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {emptyMessage ?? (hasParserChoices ? "Select a parser to view output." : "No parser results available yet.")}
            </p>
          )
        )}

        {activeParser && parserStatus?.status === "error" && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-sm text-red-300">{parserStatus.error ?? "Parser failed."}</p>
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
                onActivePageChange={onActivePageChange}
                scrollSourceId={scrollSourceId}
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
