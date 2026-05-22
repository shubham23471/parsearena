"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ParseProgress } from "@/components/parse-progress";
import { ParserPanel } from "@/components/parser-panel";
import { ParserSelector } from "@/components/parser-selector";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getAllResults, triggerParse } from "@/api";
import type { JobStatus, ParseResult, UploadResponse, ViewMode } from "@/types";

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
  const [activeParserTab, setActiveParserTab] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [linkedScrollingEnabled, setLinkedScrollingEnabled] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tab");
  const [secondaryParserTab, setSecondaryParserTab] = useState<string | null>(null);
  const [jobInfoExpanded, setJobInfoExpanded] = useState(true);
  const scrollingSourceRef = useRef<string | null>(null);
  const scrollingSourceTimeoutRef = useRef<number | null>(null);

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
    setParseState("idle");
    setParseError(null);
    setJobStatus(null);
    setAllResults({});
    setActiveParserTab(null);
    setSecondaryParserTab(null);
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

    setParseState("completed");
    setActiveParserTab(errorParsers[0]?.[0] ?? null);
    setParseError(errorParsers[0]?.[1].error ?? "All selected parsers failed.");
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
    if (!isLargeViewport && (viewMode === "tab" || viewMode === "compare" || viewMode === "diff")) {
      setViewMode("tab");
      return;
    }
    if (viewMode === "diff") {
      setViewMode("tab");
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
  const hasSecondaryPanel = viewMode === "split" || viewMode === "compare";
  const showPdfPanel = viewMode === "tab" || viewMode === "split";

  useEffect(() => {
    if (parserTabsForSelection.length === 0) {
      setActiveParserTab(null);
      return;
    }
    if (!activeParserTab || !parserTabsForSelection.includes(activeParserTab)) {
      setActiveParserTab(parserTabsForSelection[0] ?? null);
    }
  }, [activeParserTab, parserTabsForSelection]);

  useEffect(() => {
    if (!hasSecondaryPanel) {
      return;
    }
    const fallbackParser = parserTabsForSelection.find((parserName) => parserName !== activeParserTab) ?? null;
    if (!secondaryParserTab || !parserTabsForSelection.includes(secondaryParserTab)) {
      setSecondaryParserTab(fallbackParser);
      return;
    }
    if (secondaryParserTab === activeParserTab) {
      setSecondaryParserTab(fallbackParser);
    }
  }, [activeParserTab, hasSecondaryPanel, parserTabsForSelection, secondaryParserTab]);

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
    };
  }, []);

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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm text-muted-foreground">
                <ViewModeToggle
                  viewMode={viewMode}
                  onChange={setViewMode}
                  isLargeViewport={isLargeViewport}
                  isExtraLargeViewport={isExtraLargeViewport}
                />
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
              </div>

              {parseState === "idle" && !hasAnyRenderedResult && (
                <p className="text-sm text-muted-foreground">
                  Select parsers and start parsing to view comparison results.
                </p>
              )}
              {parseState === "parsing" && !hasAnyRenderedResult && (
                <p className="text-sm text-muted-foreground">
                  Parsing in progress. Live per-parser status is shown above.
                </p>
              )}
              {parseState === "error" && !hasAnyRenderedResult && (
                <p className="text-sm text-red-400">{parseError ?? "Parse failed."}</p>
              )}

              {(parseState === "completed" ||
                hasAnyRenderedResult ||
                (parseState === "parsing" && activeParserResult)) && (
                <div className="space-y-3">
                  {parseState === "parsing" && (
                    <p className="text-xs text-muted-foreground">
                      Parsing is in progress. Previously completed parser outputs remain available.
                    </p>
                  )}

                  {viewMode === "tab" && parserTabsForSelection.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {parserTabsForSelection.map((parserName) => {
                        const isActive = activeParserTab === parserName;
                        return (
                          <button
                            key={parserName}
                            type="button"
                            onClick={() => {
                              setActiveParserTab(parserName);
                            }}
                            className={[
                              "rounded border px-3 py-1.5 text-xs",
                              isActive
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground"
                            ].join(" ")}
                          >
                            {parserName}
                          </button>
                        );
                      })}
                    </div>
                  )}

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
                      parserNames={parserTabsForSelection}
                      activeParser={activeParserTab}
                      onParserChange={setActiveParserTab}
                      parserStatuses={parserStatusMap}
                      result={activeParserResult}
                      activePage={activePdfPage}
                      totalPages={pdfPageCount}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      onActivePageChange={handleSyncedPageChange}
                      scrollSourceId="parser-primary"
                      showParserSelector={viewMode === "compare"}
                    />

                    {hasSecondaryPanel && (
                      <ParserPanel
                        title={viewMode === "compare" ? "Parser B" : "Secondary Parser"}
                        parserNames={parserTabsForSelection}
                        activeParser={secondaryParserTab}
                        onParserChange={setSecondaryParserTab}
                        parserStatuses={parserStatusMap}
                        result={secondaryParserResult}
                        activePage={activePdfPage}
                        totalPages={pdfPageCount}
                        linkedScrollingEnabled={linkedScrollingEnabled}
                        onActivePageChange={handleSyncedPageChange}
                        scrollSourceId="parser-secondary"
                        showParserSelector
                      />
                    )}
                  </div>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
