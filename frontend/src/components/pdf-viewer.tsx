"use client";

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { getApiBaseUrl } from "@/lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfViewerProps = {
  jobId: string;
};

export function PdfViewer({ jobId }: PdfViewerProps) {
  const [pageCount, setPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const pdfUrl = useMemo(() => `${getApiBaseUrl()}/api/v1/jobs/${jobId}/pdf`, [jobId]);

  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
        {pageCount > 0 ? `Pages: ${pageCount}` : "Loading PDF..."}
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">
        <Document
          file={pdfUrl}
          loading={<p className="text-sm text-muted-foreground">Loading PDF document...</p>}
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages);
            setError(null);
          }}
          onLoadError={() => {
            setError("Failed to load PDF.");
          }}
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <div key={`page-${index + 1}`} className="mb-4 rounded border border-border p-2">
              <p className="mb-2 text-xs text-muted-foreground">Page {index + 1}</p>
              <Page
                pageNumber={index + 1}
                width={800}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))}
        </Document>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
