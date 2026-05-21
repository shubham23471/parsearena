"use client";

import { useState } from "react";

import { MarkdownViewer } from "@/components/markdown-viewer";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import { getJobStatus, getParseResult, triggerParse } from "@/lib/api";
import type { UploadResponse } from "@/types";

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ParseState = "idle" | "parsing" | "completed" | "error";

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [markdownResult, setMarkdownResult] = useState<string>("");
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [linkedScrollingEnabled, setLinkedScrollingEnabled] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
    setParseState("idle");
    setParseError(null);
    setMarkdownResult("");
    setActivePdfPage(1);
    setPdfPageCount(1);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Parsing failed. Please try again.";
  }

  async function waitForParseCompletion(currentJobId: string): Promise<void> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const jobStatus = await getJobStatus(currentJobId);
      const parserStatus = jobStatus.parsers.pymupdf4llm;

      if (parserStatus?.status === "completed") {
        const parseResult = await getParseResult(currentJobId, "pymupdf4llm");
        setMarkdownResult(parseResult.markdown);
        setParseState("completed");
        return;
      }

      if (parserStatus?.status === "error" || jobStatus.status === "error") {
        throw new Error(parserStatus?.error ?? "Parse failed.");
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 1000);
      });
    }

    throw new Error("Parsing timed out. Please retry.");
  }

  async function handleTriggerParse(): Promise<void> {
    if (!jobId) {
      return;
    }
    try {
      setParseState("parsing");
      setParseError(null);
      setMarkdownResult("");
      await triggerParse(jobId);
      await waitForParseCompletion(jobId);
    } catch (error: unknown) {
      setParseState("error");
      setParseError(getErrorMessage(error));
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Phase 1.6</p>
          <h1 className="text-4xl font-semibold">ParseArena</h1>
          <p className="text-sm text-muted-foreground">
            Upload a PDF, parse it, and review the original document with extracted markdown.
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
              <button
                type="button"
                onClick={() => {
                  void handleTriggerParse();
                }}
                disabled={parseState === "parsing" || parseState === "completed"}
                className="rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-70"
              >
                {parseState === "parsing"
                  ? "Parsing..."
                  : parseState === "completed"
                    ? "Parse Completed"
                    : "Parse"}
              </button>
            </div>

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
                  {parseState === "idle" && (
                    <p className="text-sm text-muted-foreground">
                      Click "Parse" to generate markdown output.
                    </p>
                  )}
                  {parseState === "parsing" && (
                    <div className="space-y-2">
                      <div className="h-2 w-full animate-pulse rounded bg-muted" />
                      <p className="text-sm text-muted-foreground">Parsing in progress...</p>
                    </div>
                  )}
                  {parseState === "error" && (
                    <p className="text-sm text-red-400">{parseError ?? "Parse failed."}</p>
                  )}
                  {parseState === "completed" && (
                    <MarkdownViewer
                      markdown={markdownResult}
                      activePage={activePdfPage}
                      totalPages={pdfPageCount}
                      linkedScrollingEnabled={linkedScrollingEnabled}
                      onActivePageChange={setActivePdfPage}
                    />
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
