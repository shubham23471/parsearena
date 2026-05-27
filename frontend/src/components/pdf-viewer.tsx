"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { getApiBaseUrl } from "@/api";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfViewerProps = {
  jobId: string;
  activePage?: number;
  linkedScrollingEnabled?: boolean;
  scrollSourceId: string;
  onActivePageChange?: (page: number, sourceId: string) => void;
  onPageCountChange?: (count: number) => void;
};

export function PdfViewer({
  jobId,
  activePage,
  linkedScrollingEnabled = false,
  scrollSourceId,
  onActivePageChange,
  onPageCountChange
}: PdfViewerProps) {
  const [pageCount, setPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastProgrammaticPageRef = useRef<number | null>(null);
  const suppressObserverUntilRef = useRef<number>(0);
  const lastReportedPageRef = useRef<number | null>(null);
  const pdfUrl = useMemo(() => `${getApiBaseUrl()}/api/v1/jobs/${jobId}/pdf`, [jobId]);

  useEffect(() => {
    if (pageCount > 0 && onPageCountChange) {
      onPageCountChange(pageCount);
    }
  }, [onPageCountChange, pageCount]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || pageCount === 0 || !onActivePageChange) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) {
          return;
        }

        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visibleEntries[0];
        const pageAttr = (topEntry.target as HTMLElement).dataset.pageNumber;
        const pageNumber = Number(pageAttr);
        if (Number.isInteger(pageNumber) && pageNumber > 0) {
          if (Date.now() < suppressObserverUntilRef.current) {
            return;
          }
          if (lastReportedPageRef.current === pageNumber) {
            return;
          }
          lastReportedPageRef.current = pageNumber;
          onActivePageChange(pageNumber, scrollSourceId);
        }
      },
      {
        root,
        threshold: [0.5, 0.75]
      }
    );

    for (let index = 1; index <= pageCount; index += 1) {
      const element = pageRefs.current.get(index);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [pageCount, onActivePageChange, scrollSourceId]);

  useEffect(() => {
    if (!linkedScrollingEnabled || !activePage || pageCount === 0) {
      return;
    }
    const targetPage = Math.min(Math.max(activePage, 1), pageCount);
    if (lastProgrammaticPageRef.current === targetPage) {
      return;
    }
    // Ignore page updates that originated from this viewer itself.
    if (lastReportedPageRef.current === targetPage) {
      lastProgrammaticPageRef.current = targetPage;
      return;
    }
    const targetElement = pageRefs.current.get(targetPage);
    if (!targetElement) {
      return;
    }
    lastProgrammaticPageRef.current = targetPage;
    suppressObserverUntilRef.current = Date.now() + 500;
    targetElement.scrollIntoView({ block: "start", behavior: "auto" });
  }, [activePage, linkedScrollingEnabled, pageCount]);

  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
        {pageCount > 0 ? `Pages: ${pageCount}` : "Loading PDF..."}
      </div>
      <div ref={scrollContainerRef} className="max-h-[75vh] overflow-y-auto p-4">
        <Document
          file={pdfUrl}
          loading={<p className="text-sm text-muted-foreground">Loading PDF document...</p>}
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages);
            pageRefs.current.clear();
            setError(null);
          }}
          onLoadError={() => {
            setError("Failed to load PDF.");
          }}
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <div
              key={`page-${index + 1}`}
              ref={(element) => {
                if (element) {
                  pageRefs.current.set(index + 1, element);
                } else {
                  pageRefs.current.delete(index + 1);
                }
              }}
              data-page-number={index + 1}
              className="mb-4 rounded border border-border p-2"
            >
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
