"use client";

import { useEffect, useMemo, useState } from "react";

import { MarkdownViewer } from "@/components/markdown-viewer";
import { ParseProgress } from "@/components/parse-progress";
import { ParserSelector } from "@/components/parser-selector";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import { getAllResults, triggerParse } from "@/api";
import type { JobStatus, ParseResult, UploadResponse } from "@/types";

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ParseState = "idle" | "parsing" | "completed" | "error";

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

export default function HomePage() {
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

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
    setParseState("idle");
    setParseError(null);
    setJobStatus(null);
    setAllResults({});
    setActiveParserTab(null);
    setActivePdfPage(1);
    setPdfPageCount(1);
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
  const activeParserStatus = activeParserTab ? jobStatus?.parsers[activeParserTab] : undefined;
  const activeParserResult = activeParserTab ? allResults[activeParserTab] : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-10">
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
            <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                <p>Uploaded: {uploadedFileName ?? "PDF file"}</p>
                <p>Job ID: {jobId}</p>
                <p>Upload status: {uploadState}</p>
                <p>Parse status: {parseState}</p>
              </div>
              {parseError && <p className="text-sm text-red-400">{parseError}</p>}
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

            <div className="grid gap-4 lg:grid-cols-2">
              <PdfViewer
                jobId={jobId}
                activePage={activePdfPage}
                linkedScrollingEnabled={linkedScrollingEnabled}
                onActivePageChange={setActivePdfPage}
                onPageCountChange={setPdfPageCount}
              />

              <section className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted-foreground">
                  <span>Parse Result</span>
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
                <div className="p-4">
                  {parseState === "idle" && !hasAnyRenderedResult && (
                    <p className="text-sm text-muted-foreground">
                      Select parsers and start parsing to view results.
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
                      <div className="flex flex-wrap gap-2">
                        {parserTabs.map((parserName) => {
                          const parserStatus = jobStatus?.parsers[parserName];
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
                              {parserStatus?.elapsed_seconds !== null &&
                                parserStatus?.elapsed_seconds !== undefined &&
                                ` · ${parserStatus.elapsed_seconds.toFixed(1)}s`}
                              {` · ${getDeviceLabel(parserStatus?.execution_device)}`}
                            </button>
                          );
                        })}
                      </div>

                      {activeParserTab && activeParserStatus?.status === "error" && (
                        <p className="text-sm text-red-400">
                          {activeParserStatus.error ?? "Parser failed."}
                        </p>
                      )}

                      {activeParserTab && activeParserResult && (
                        <MarkdownViewer
                          markdown={activeParserResult.markdown}
                          activePage={activePdfPage}
                          totalPages={pdfPageCount}
                          linkedScrollingEnabled={linkedScrollingEnabled}
                          onActivePageChange={setActivePdfPage}
                        />
                      )}

                      {activeParserTab && !activeParserResult && activeParserStatus?.status !== "error" && (
                        <p className="text-sm text-muted-foreground">
                          Result not available for this parser.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
