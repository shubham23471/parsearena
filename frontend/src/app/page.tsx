"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ParseProgress } from "@/components/parse-progress";
import { DiffSummaryCard } from "@/components/diff-summary";
import { DiffViewer } from "@/components/diff-viewer";
import { ParserPanel } from "@/components/parser-panel";
import { ParserSelector } from "@/components/parser-selector";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { useMediaQuery } from "@/hooks/use-media-query";
import { computeStructuralDiff } from "@/lib/diff";
import { getAllResults, triggerParse } from "@/api";
import type { JobStatus, ParseResult, UploadResponse, ViewMode } from "@/types";

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ParseState = "idle" | "parsing" | "completed" | "error";

function isTypingInInput(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }
  const tag = activeElement.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || activeElement.hasAttribute("contenteditable");
}

export default function HomePage() {
  const isLargeViewport = useMediaQuery("(min-width: 1024px)");
  const isExtraLargeViewport = useMediaQuery("(min-width: 1280px)");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [allResults, setAllResults] = useState<Record<string, ParseResult | null>>({});
  const [activeParserTab, setActiveParserTab] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [linkedScrollingEnabled, setLinkedScrollingEnabled] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tab");
  const [secondaryParserTab, setSecondaryParserTab] = useState<string | null>(null);
  const [diffParserA, setDiffParserA] = useState<string | null>(null);
  const [diffParserB, setDiffParserB] = useState<string | null>(null);
  const [jobInfoExpanded, setJobInfoExpanded] = useState(true);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const scrollingSourceRef = useRef<string | null>(null);
  const scrollingSourceTimeoutRef = useRef<number | null>(null);
  const viewShortcutPendingRef = useRef(false);
  const viewShortcutTimerRef = useRef<number | null>(null);

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
    setParseState("idle");
    setParseError(null);
    setJobStatus(null);
    setAllResults({});
    setActiveParserTab(null);
    setSecondaryParserTab(null);
    setDiffParserA(null);
    setDiffParserB(null);
    setActivePdfPage(1);
    setPdfPageCount(1);
    setJobInfoExpanded(true);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Parsing failed. Please try again.";
  }

  async function handleTriggerParse(selectedParsers: string[]): Promise<void> {
    if (!jobId) {
      return;
    }
    if (selectedParsers.length === 0) {
      setParseState("error");
      setParseError("Select at least one parser.");
      return;
    }

    try {
      setParseState("parsing");
      setParseError(null);
      await triggerParse(jobId, selectedParsers);
    } catch (error: unknown) {
      setParseState("error");
      setParseError(getErrorMessage(error));
    }
  }

  async function handleParseFinished(status: JobStatus): Promise<void> {
    if (!jobId) {
      return;
    }
    setJobStatus(status);
    const parserList = Object.entries(status.parsers);
    const hasIncompleteParsers = parserList.some(([, parser]) =>
      ["pending", "queued", "running"].includes(parser.status)
    );
    if (parserList.length === 0 || hasIncompleteParsers) {
      return;
    }
    const completedParsers = parserList.filter(([, parser]) => parser.status === "completed");
    const errorParsers = parserList.filter(([, parser]) => parser.status === "error");

    try {
      const response = await getAllResults(jobId);
      setAllResults(response.results);
    } catch (error: unknown) {
      setParseState("error");
      setParseError(getErrorMessage(error));
      return;
    }

    if (completedParsers.length > 0) {
      setParseState("completed");
      setParseError(null);
      setActiveParserTab(completedParsers[0]?.[0] ?? null);
      return;
    }

    const allEndedWithError = parserList.length > 0 && errorParsers.length === parserList.length;
    setParseState("completed");
    setActiveParserTab(errorParsers[0]?.[0] ?? null);
    setParseError(allEndedWithError ? errorParsers[0]?.[1].error ?? "All selected parsers failed." : null);
  }

  useEffect(() => {
    if (activeParserTab) {
      return;
    }
    const parserNames = Object.keys(allResults);
    if (parserNames.length > 0) {
      setActiveParserTab(parserNames[0]);
    }
  }, [activeParserTab, allResults]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedMode = window.localStorage.getItem("parsearena:view-mode");
    if (savedMode === "tab" || savedMode === "split" || savedMode === "compare" || savedMode === "diff") {
      setViewMode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("parsearena:view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (parseState === "completed") {
      setJobInfoExpanded(false);
    }
  }, [parseState]);

  useEffect(() => {
    if (!isExtraLargeViewport && viewMode === "split") {
      setViewMode("tab");
      return;
    }
    if (!isLargeViewport && (viewMode === "compare" || viewMode === "diff")) {
      setViewMode("tab");
      return;
    }
  }, [isExtraLargeViewport, isLargeViewport, viewMode]);

  const parserTabs = useMemo(() => {
    if (!jobStatus) {
      return [];
    }
    return Object.keys(jobStatus.parsers);
  }, [jobStatus]);

  const hasAnyRenderedResult = useMemo(
    () => Object.values(allResults).some((result) => result !== null),
    [allResults]
  );
  const parserStatusMap = jobStatus?.parsers ?? {};
  const activeParserResult = activeParserTab ? allResults[activeParserTab] : null;
  const secondaryParserResult = secondaryParserTab ? allResults[secondaryParserTab] : null;
  const parserTabsForSelection = parserTabs.length > 0 ? parserTabs : Object.keys(allResults);
  const completedParserTabs = useMemo(
    () => parserTabsForSelection.filter((parserName) => parserStatusMap[parserName]?.status === "completed"),
    [parserStatusMap, parserTabsForSelection]
  );
  const completedParserWithResults = useMemo(
    () => completedParserTabs.filter((parserName) => Boolean(allResults[parserName]?.markdown)),
    [allResults, completedParserTabs]
  );
  const diffResult = useMemo(() => {
    if (viewMode !== "diff" || !diffParserA || !diffParserB) {
      return null;
    }
    const markdownA = allResults[diffParserA]?.markdown;
    const markdownB = allResults[diffParserB]?.markdown;
    if (!markdownA || !markdownB) {
      return null;
    }
    return computeStructuralDiff(markdownA, markdownB);
  }, [allResults, diffParserA, diffParserB, viewMode]);
  const activeParserChoices = viewMode === "tab" ? parserTabsForSelection : completedParserTabs;
  const hasSecondaryPanel = viewMode === "split" || viewMode === "compare";
  const showPdfPanel = viewMode === "tab" || viewMode === "split";

  useEffect(() => {
    if (activeParserChoices.length === 0) {
      setActiveParserTab(null);
      return;
    }
    if (!activeParserTab || !activeParserChoices.includes(activeParserTab)) {
      setActiveParserTab(activeParserChoices[0] ?? null);
    }
  }, [activeParserChoices, activeParserTab]);

  useEffect(() => {
    if (!hasSecondaryPanel) {
      return;
    }
    const fallbackParser = completedParserTabs.find((parserName) => parserName !== activeParserTab) ?? null;
    if (!secondaryParserTab || !completedParserTabs.includes(secondaryParserTab)) {
      setSecondaryParserTab(fallbackParser);
      return;
    }
    if (secondaryParserTab === activeParserTab) {
      setSecondaryParserTab(fallbackParser);
    }
  }, [activeParserTab, completedParserTabs, hasSecondaryPanel, secondaryParserTab]);

  useEffect(() => {
    if (viewMode !== "diff") {
      return;
    }
    const first = completedParserWithResults[0] ?? null;
    const second = completedParserWithResults.find((parserName) => parserName !== first) ?? null;

    if (!diffParserA || !completedParserWithResults.includes(diffParserA)) {
      setDiffParserA(first);
    }
    if (!diffParserB || !completedParserWithResults.includes(diffParserB) || diffParserB === diffParserA) {
      setDiffParserB(second);
    }
  }, [completedParserWithResults, diffParserA, diffParserB, viewMode]);

  useEffect(() => {
    if (activePdfPage <= pdfPageCount) {
      return;
    }
    setActivePdfPage(Math.max(pdfPageCount, 1));
  }, [activePdfPage, pdfPageCount]);

  useEffect(() => {
    return () => {
      if (scrollingSourceTimeoutRef.current !== null) {
        window.clearTimeout(scrollingSourceTimeoutRef.current);
      }
      if (viewShortcutTimerRef.current !== null) {
        window.clearTimeout(viewShortcutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const switchModeFromShortcut = (mode: ViewMode) => {
      if (mode === "split" && !isExtraLargeViewport) {
        return;
      }
      if (mode === "compare" && !isLargeViewport) {
        return;
      }
      setViewMode(mode);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingInInput()) {
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShortcutHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === "l") {
        event.preventDefault();
        setLinkedScrollingEnabled((prev) => !prev);
        return;
      }

      if (viewShortcutPendingRef.current) {
        const shortcutMap: Record<string, ViewMode> = {
          t: "tab",
          s: "split",
          c: "compare"
        };
        const mode = shortcutMap[event.key.toLowerCase()];
        viewShortcutPendingRef.current = false;
        if (viewShortcutTimerRef.current !== null) {
          window.clearTimeout(viewShortcutTimerRef.current);
        }
        if (mode) {
          event.preventDefault();
          switchModeFromShortcut(mode);
        }
        return;
      }

      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        viewShortcutPendingRef.current = true;
        if (viewShortcutTimerRef.current !== null) {
          window.clearTimeout(viewShortcutTimerRef.current);
        }
        viewShortcutTimerRef.current = window.setTimeout(() => {
          viewShortcutPendingRef.current = false;
        }, 1200);
        return;
      }

      if (viewMode !== "tab" || parserTabsForSelection.length === 0) {
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const parserIndex = Number(event.key) - 1;
        const parserName = parserTabsForSelection[parserIndex];
        if (parserName) {
          event.preventDefault();
          setActiveParserTab(parserName);
        }
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const currentIndex = activeParserTab ? parserTabsForSelection.indexOf(activeParserTab) : 0;
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const direction = event.key === "]" ? 1 : -1;
        const nextIndex = (safeCurrentIndex + direction + parserTabsForSelection.length) % parserTabsForSelection.length;
        setActiveParserTab(parserTabsForSelection[nextIndex] ?? null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeParserTab, isExtraLargeViewport, isLargeViewport, parserTabsForSelection, viewMode]);

  function handleSyncedPageChange(page: number, sourceId: string): void {
    if (!linkedScrollingEnabled) {
      return;
    }
    if (scrollingSourceRef.current !== null && scrollingSourceRef.current !== sourceId) {
      return;
    }
    scrollingSourceRef.current = sourceId;
    setActivePdfPage(page);
    if (scrollingSourceTimeoutRef.current !== null) {
      window.clearTimeout(scrollingSourceTimeoutRef.current);
    }
    scrollingSourceTimeoutRef.current = window.setTimeout(() => {
      scrollingSourceRef.current = null;
    }, 250);
  }

  const comparisonGridClassName = useMemo(() => {
    if (viewMode === "split") {
      return "grid-cols-1 xl:grid-cols-[minmax(0,30fr)_minmax(0,35fr)_minmax(0,35fr)]";
    }
    if (viewMode === "compare") {
      return "grid-cols-1 lg:grid-cols-2";
    }
    if (viewMode === "diff") {
      return "grid-cols-1";
    }
    return "grid-cols-1 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]";
  }, [viewMode]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-10 xl:max-w-[1600px] 2xl:max-w-[2400px]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Phase 1.6</p>
          <h1 className="text-4xl font-semibold">ParseArena</h1>
          <p className="text-sm text-muted-foreground">
            Upload a PDF, choose parsers, track progress, and compare markdown output.
          </p>
        </div>

        {!jobId ? (
          <PdfUpload onUploaded={handleUploaded} onUploadStateChange={setUploadState} />
        ) : (
          <section className="space-y-4">
            <div className="rounded-lg border border-border px-4 py-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => {
                  setJobInfoExpanded((prev) => !prev);
                }}
              >
                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">{uploadedFileName ?? "PDF file"}</span>
                    {" · "}
                    <span>Job {jobId}</span>
                    {" · "}
                    <span>Upload: {uploadState}</span>
                    {" · "}
                    <span>Parse: {parseState}</span>
                  </p>
                  {jobInfoExpanded && (
                    <div className="mt-2 space-y-1 text-xs">
                      <p>Uploaded file: {uploadedFileName ?? "PDF file"}</p>
                      <p>Job ID: {jobId}</p>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{jobInfoExpanded ? "Collapse" : "Expand"}</span>
              </button>
              {parseError && <p className="mt-3 text-sm text-red-400">{parseError}</p>}
            </div>

            {parseState === "parsing" ? (
              <ParseProgress
                jobId={jobId}
                onStatusUpdate={(status) => {
                  setJobStatus(status);
                }}
                onFinished={(status) => {
                  void handleParseFinished(status);
                }}
              />
            ) : (
              <ParserSelector
                disabled={false}
                onSubmitSelection={(selectedParsers) => {
                  void handleTriggerParse(selectedParsers);
                }}
              />
            )}

            <section className="space-y-4 rounded-lg border border-border p-4">
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <ViewModeToggle
                    viewMode={viewMode}
                    onChange={setViewMode}
                    isLargeViewport={isLargeViewport}
                    isExtraLargeViewport={isExtraLargeViewport}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShortcutHelpOpen((prev) => !prev);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-xs hover:bg-muted/40"
                    aria-label="Show keyboard shortcuts"
                    title="Keyboard shortcuts"
                  >
                    ?
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={linkedScrollingEnabled}
                    onChange={(event) => {
                      setLinkedScrollingEnabled(event.target.checked);
                    }}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  Linked Scrolling
                </label>
                {shortcutHelpOpen && (
                  <div className="absolute right-0 top-11 z-10 w-72 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg">
                    <p className="mb-2 font-medium text-foreground">Keyboard Shortcuts</p>
                    <p>`1`-`n`: switch parser tab (Tab mode)</p>
                    <p>`[` / `]`: previous or next parser</p>
                    <p>`v` then `t` / `s` / `c`: switch view mode</p>
                    <p>`l`: toggle linked scrolling</p>
                    <p>`?`: toggle this help</p>
                  </div>
                )}
              </div>

              {viewMode === "diff" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">Parser A</label>
                    <select
                      value={diffParserA ?? ""}
                      onChange={(event) => {
                        setDiffParserA(event.target.value || null);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Select parser</option>
                      {completedParserWithResults.map((parserName) => {
                        const elapsed = parserStatusMap[parserName]?.elapsed_seconds;
                        const label =
                          elapsed !== null && elapsed !== undefined
                            ? `${parserName} · ${elapsed.toFixed(1)}s`
                            : parserName;
                        return (
                          <option key={`diff-a-${parserName}`} value={parserName}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setDiffParserA(diffParserB);
                        setDiffParserB(diffParserA);
                      }}
                      className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
                      title="Swap parsers"
                    >
                      ↔
                    </button>
                    <label className="text-xs text-muted-foreground">Parser B</label>
                    <select
                      value={diffParserB ?? ""}
                      onChange={(event) => {
                        setDiffParserB(event.target.value || null);
                      }}
                      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Select parser</option>
                      {completedParserWithResults.map((parserName) => {
                        const elapsed = parserStatusMap[parserName]?.elapsed_seconds;
                        const label =
                          elapsed !== null && elapsed !== undefined
                            ? `${parserName} · ${elapsed.toFixed(1)}s`
                            : parserName;
                        return (
                          <option key={`diff-b-${parserName}`} value={parserName} disabled={parserName === diffParserA}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {!diffResult && (
                    <p className="text-sm text-muted-foreground">
                      {completedParserWithResults.length < 2
                        ? "Complete at least two parsers to use structural diff."
                        : "Select two parsers to view structural differences."}
                    </p>
                  )}

                  {diffResult && diffParserA && diffParserB && (
                    <div className="space-y-3">
                      <DiffSummaryCard summary={diffResult.summary} parserAName={diffParserA} parserBName={diffParserB} />
                      <DiffViewer blocks={diffResult.blocks} />
                    </div>
                  )}
                </div>
              ) : (
                <div className={["grid gap-4 transition-all duration-300", comparisonGridClassName].join(" ")}>
                  {showPdfPanel && (
                    <PdfViewer
                      jobId={jobId}
                      activePage={activePdfPage}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      scrollSourceId="pdf"
                      onActivePageChange={handleSyncedPageChange}
                      onPageCountChange={setPdfPageCount}
                    />
                  )}

                  <ParserPanel
                    title={viewMode === "compare" ? "Parser A" : "Parse Result"}
                    parserNames={activeParserChoices}
                    activeParser={activeParserTab}
                    onParserChange={setActiveParserTab}
                    parserStatuses={parserStatusMap}
                    result={activeParserResult}
                    activePage={activePdfPage}
                    totalPages={pdfPageCount}
                    linkedScrollingEnabled={linkedScrollingEnabled}
                    onActivePageChange={handleSyncedPageChange}
                    scrollSourceId="parser-primary"
                    viewMode={viewMode}
                    otherVisibleParsers={secondaryParserTab ? [secondaryParserTab] : []}
                    emptyMessage={
                      parseState === "idle"
                        ? "Select parsers above and run to see results."
                        : parseState === "parsing"
                          ? "Parsing in progress — results will appear here when ready."
                          : parseState === "error" && !hasAnyRenderedResult
                            ? (parseError ?? "Parse failed.")
                            : undefined
                    }
                    emptyIsError={parseState === "error" && !hasAnyRenderedResult}
                  />

                  {hasSecondaryPanel && (
                    <ParserPanel
                      title={viewMode === "compare" ? "Parser B" : "Secondary Parser"}
                      parserNames={completedParserTabs}
                      activeParser={secondaryParserTab}
                      onParserChange={setSecondaryParserTab}
                      parserStatuses={parserStatusMap}
                      result={secondaryParserResult}
                      activePage={activePdfPage}
                      totalPages={pdfPageCount}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      onActivePageChange={handleSyncedPageChange}
                      scrollSourceId="parser-secondary"
                      viewMode={viewMode}
                      otherVisibleParsers={activeParserTab ? [activeParserTab] : []}
                      emptyMessage={
                        completedParserTabs.length < 2
                          ? "Waiting for another parser to complete..."
                          : "Select a parser to view output."
                      }
                    />
                  )}
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
