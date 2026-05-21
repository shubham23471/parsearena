"use client";

import { useState } from "react";

import { PdfUpload } from "@/components/pdf-upload";
import { PdfViewer } from "@/components/pdf-viewer";
import type { UploadResponse } from "@/types";

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ParseState = "idle" | "parsing" | "completed" | "error";

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parseState] = useState<ParseState>("idle");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function handleUploaded(response: UploadResponse): void {
    setJobId(response.job_id);
    setUploadedFileName(response.filename);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Phase 1.5</p>
          <h1 className="text-4xl font-semibold">ParseArena</h1>
          <p className="text-sm text-muted-foreground">
            Upload a PDF and preview it directly in the browser.
          </p>
        </div>

        {!jobId ? (
          <PdfUpload onUploaded={handleUploaded} onUploadStateChange={setUploadState} />
        ) : (
          <section className="space-y-3">
            <div className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
              <p>Uploaded: {uploadedFileName ?? "PDF file"}</p>
              <p>Job ID: {jobId}</p>
              <p>Upload status: {uploadState}</p>
              <p>Parse status: {parseState}</p>
            </div>
            <PdfViewer jobId={jobId} />
          </section>
        )}
      </div>
    </main>
  );
}
