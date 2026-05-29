"use client";

import { useEffect, useMemo, useState } from "react";

import { getAllMarkdownDownloadsUrl, getAllResults, getParserMetrics, triggerParse } from "@/api";
import { ParseProgress } from "@/components/parse-progress";
import { DiffSummaryCard } from "@/components/diff-summary";
import { DiffViewer } from "@/components/diff-viewer";
import { HomeHeader } from "@/components/home/home-header";
import { JobSummaryCard } from "@/components/home/job-summary-card";
import { WorkspaceToolbar } from "@/components/home/workspace-toolbar";
import { MetricsComparison } from "@/components/metrics-comparison";
import { ParserPanel } from "@/components/parser-panel";
import { ParserSelector } from "@/components/parser-selector";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import { useHomeKeyboardShortcuts } from "@/hooks/use-home-keyboard-shortcuts";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSyncedPdfPage } from "@/hooks/use-synced-pdf-page";
import { computeStructuralDiff } from "@/lib/diff";
import type {
  JobStatus,
  ParseResult,
  ParserMetricsResponse,
  UploadResponse,
  ViewMode
} from "@/types";

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ParseState = "idle" | "parsing" | "completed" | "error";

export default function HomePage() {
  const isLargeViewport = useMediaQuery("(min-width: 1024px)");
  const isExtraLargeViewport = useMediaQuery("(min-width: 1280px)");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [allResults, setAllResults] = useState<Record<string, ParseResult | null>>({});
  const [parserMetricsByName, setParserMetricsByName] = useState<Record<string, ParserMetricsResponse | null>>({});
  const [activeParserTab, setActiveParserTab] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [linkedScrollingEnabled, setLinkedScrollingEnabled] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tab");
  const [secondaryParserTab, setSecondaryParserTab] = useState<string | null>(null);
  const [diffParserA, setDiffParserA] = useState<string | null>(null);
  const [diffParserB, setDiffParserB] = useState<string | null>(null);
  const [jobInfoExpanded, setJobInfoExpanded] = useState(true);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [showMethodologyBanner, setShowMethodologyBanner] = useState(false);
  const [methodologyHintExpanded, setMethodologyHintExpanded] = useState(false);
  const { activePdfPage, setActivePdfPage, scrollSourceId, handlePageChange } = useSyncedPdfPage({
    linkedScrollingEnabled,
    pdfPageCount
  });

  const handlePdfPageChange = (page: number) => handlePageChange(page, "pdf");
  const handlePrimaryParserPageChange = (page: number) => handlePageChange(page, "parser-primary");
  const handleSecondaryParserPageChange = (page: number) => handlePageChange(page, "parser-secondary");

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
    setParseState("idle");
    setParseError(null);
    setJobStatus(null);
    setAllResults({});
    setParserMetricsByName({});
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
    if (typeof window === "undefined") {
      return;
    }
    const dismissed = window.sessionStorage.getItem("parsearena:methodology-banner-dismissed");
    setShowMethodologyBanner(dismissed !== "1");
  }, []);

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
  const completedParsersForCurrentJob = useMemo(
    () =>
      Object.entries(parserStatusMap)
        .filter(([, parser]) => parser.status === "completed")
        .map(([parserName]) => parserName),
    [parserStatusMap]
  );
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
  const allMarkdownDownloadUrl = useMemo(
    () => (jobId ? getAllMarkdownDownloadsUrl(jobId) : null),
    [jobId]
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
    if (!jobId) {
      return;
    }
    const parserNamesToLoad = completedParserTabs.filter((parserName) => parserMetricsByName[parserName] === undefined);
    if (parserNamesToLoad.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.all(
      parserNamesToLoad.map(async (parserName) => {
        try {
          const metrics = await getParserMetrics(jobId, parserName);
          return [parserName, metrics] as const;
        } catch {
          return [parserName, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setParserMetricsByName((previous) => {
        const next = { ...previous };
        for (const [parserName, metrics] of entries) {
          next[parserName] = metrics;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [completedParserTabs, jobId, parserMetricsByName]);

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

  useHomeKeyboardShortcuts({
    activeParserTab,
    isExtraLargeViewport,
    isLargeViewport,
    parserTabsForSelection,
    setActiveParserTab,
    setLinkedScrollingEnabled,
    setShortcutHelpOpen,
    setViewMode,
    viewMode
  });

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

  const activeParserMetrics = activeParserTab ? parserMetricsByName[activeParserTab] ?? null : null;
  const secondaryParserMetrics = secondaryParserTab ? parserMetricsByName[secondaryParserTab] ?? null : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-8 xl:max-w-[1600px] 2xl:max-w-[2400px]">
        <HomeHeader />

        {!jobId ? (
          <PdfUpload onUploaded={handleUploaded} onUploadStateChange={setUploadState} />
        ) : (
          <section className="space-y-4">
            <JobSummaryCard
              jobId={jobId}
              jobInfoExpanded={jobInfoExpanded}
              onToggleExpanded={() => {
                setJobInfoExpanded((prev) => !prev);
              }}
              parseError={parseError}
              parseState={parseState}
              uploadState={uploadState}
              uploadedFileName={uploadedFileName}
            />

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
                lockedParserNames={completedParsersForCurrentJob}
                onSubmitSelection={(selectedParsers) => {
                  void handleTriggerParse(selectedParsers);
                }}
              />
            )}

            {allMarkdownDownloadUrl && completedParserWithResults.length > 0 && (
              <div className="flex justify-end">
                <a
                  href={allMarkdownDownloadUrl}
                  className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  Download all markdowns (.zip)
                </a>
              </div>
            )}

            {showMethodologyBanner && (
              <section className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    All parsers run with default settings. Results reflect out-of-the-box behavior, not maximum capability.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMethodologyHintExpanded((previous) => !previous);
                      }}
                      className="rounded border border-sky-400/40 bg-sky-500/20 px-2 py-1 text-[11px] hover:bg-sky-500/30"
                    >
                      Learn more
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMethodologyBanner(false);
                        if (typeof window !== "undefined") {
                          window.sessionStorage.setItem("parsearena:methodology-banner-dismissed", "1");
                        }
                      }}
                      className="rounded border border-sky-400/40 bg-sky-500/20 px-2 py-1 text-[11px] hover:bg-sky-500/30"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                {methodologyHintExpanded && (
                  <p className="mt-2 text-[11px] text-sky-100/90">
                    See detailed methodology in <code className="rounded bg-sky-950/40 px-1">docs/wiki/METHODOLOGY.md</code>.
                  </p>
                )}
              </section>
            )}

            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <WorkspaceToolbar
                isExtraLargeViewport={isExtraLargeViewport}
                isLargeViewport={isLargeViewport}
                linkedScrollingEnabled={linkedScrollingEnabled}
                onToggleShortcutHelp={() => {
                  setShortcutHelpOpen((prev) => !prev);
                }}
                onViewModeChange={setViewMode}
                setLinkedScrollingEnabled={setLinkedScrollingEnabled}
                shortcutHelpOpen={shortcutHelpOpen}
                viewMode={viewMode}
              />

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
                <div className={["grid gap-4", comparisonGridClassName].join(" ")}>
                  {showPdfPanel && (
                    <PdfViewer
                      jobId={jobId}
                      activePage={activePdfPage}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      isScrollSource={scrollSourceId === "pdf"}
                      onPageChange={handlePdfPageChange}
                      onPageCountChange={setPdfPageCount}
                    />
                  )}

                  <ParserPanel
                    jobId={jobId}
                    title={viewMode === "compare" ? "Parser A" : "Parse Result"}
                    parserNames={activeParserChoices}
                    activeParser={activeParserTab}
                    onParserChange={setActiveParserTab}
                    parserStatuses={parserStatusMap}
                    result={activeParserResult}
                    activePage={activePdfPage}
                    totalPages={pdfPageCount}
                    linkedScrollingEnabled={linkedScrollingEnabled}
                    isScrollSource={scrollSourceId === "parser-primary"}
                    onPageChange={handlePrimaryParserPageChange}
                    viewMode={viewMode}
                    metrics={activeParserMetrics}
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
                      jobId={jobId}
                      title={viewMode === "compare" ? "Parser B" : "Secondary Parser"}
                      parserNames={completedParserTabs}
                      activeParser={secondaryParserTab}
                      onParserChange={setSecondaryParserTab}
                      parserStatuses={parserStatusMap}
                      result={secondaryParserResult}
                      activePage={activePdfPage}
                      totalPages={pdfPageCount}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      isScrollSource={scrollSourceId === "parser-secondary"}
                      onPageChange={handleSecondaryParserPageChange}
                      viewMode={viewMode}
                      metrics={secondaryParserMetrics}
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

              {(viewMode === "split" || viewMode === "compare") &&
                activeParserTab &&
                secondaryParserTab &&
                activeParserMetrics &&
                secondaryParserMetrics && (
                  <MetricsComparison
                    parserAName={activeParserTab}
                    parserBName={secondaryParserTab}
                    metricsA={activeParserMetrics}
                    metricsB={secondaryParserMetrics}
                  />
                )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
