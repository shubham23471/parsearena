"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { getApiBaseUrl } from "@/api";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfViewerProps = {
  jobId: string;
  activePage: number;
  linkedScrollingEnabled: boolean;
  isScrollSource: boolean;
  onPageChange: (page: number) => void;
  onPageCountChange?: (count: number) => void;
};

function getVisiblePageNumber(
  container: HTMLElement,
  pageElements: Map<number, HTMLElement>,
  pageCount: number
): number {
  const containerRect = container.getBoundingClientRect();
  const containerTop = containerRect.top;
  let bestPage = 1;
  let bestVisibility = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const element = pageElements.get(pageNum);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, containerTop);
    const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibility = visibleHeight / rect.height;

    // Prefer the page that has more than 50% visible, or the one with most visibility
    if (visibility > 0.5) {
      return pageNum;
    }
    if (visibility > bestVisibility) {
      bestVisibility = visibility;
      bestPage = pageNum;
    }
  }

  return bestPage;
}

export function PdfViewer({
  jobId,
  activePage,
  linkedScrollingEnabled,
  isScrollSource,
  onPageChange,
  onPageCountChange
}: PdfViewerProps) {
  const [pageCount, setPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingProgrammatically = useRef(false);
  const lastScrolledToPage = useRef<number | null>(null);
  const pdfUrl = useMemo(() => `${getApiBaseUrl()}/api/v1/jobs/${jobId}/pdf`, [jobId]);

  // Report page count when it changes
  useEffect(() => {
    if (pageCount > 0 && onPageCountChange) {
      onPageCountChange(pageCount);
    }
  }, [onPageCountChange, pageCount]);

  // Handle user scroll - detect which page is visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0 || !linkedScrollingEnabled) {
      return;
    }

    let rafId: number | null = null;

    const handleScroll = () => {
      // Skip if we're in the middle of a programmatic scroll
      if (isScrollingProgrammatically.current) {
        return;
      }

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const visiblePage = getVisiblePageNumber(container, pageRefs.current, pageCount);
        if (visiblePage !== activePage) {
          onPageChange(visiblePage);
        }
        rafId = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [pageCount, linkedScrollingEnabled, activePage, onPageChange]);

  // Scroll to page when activePage changes from another source
  useLayoutEffect(() => {
    if (!linkedScrollingEnabled || pageCount === 0) {
      return;
    }

    // Don't scroll if we are the scroll source
    if (isScrollSource) {
      lastScrolledToPage.current = activePage;
      return;
    }

    // Don't scroll to same page twice
    if (lastScrolledToPage.current === activePage) {
      return;
    }

    const targetPage = Math.min(Math.max(activePage, 1), pageCount);
    const targetElement = pageRefs.current.get(targetPage);
    const container = containerRef.current;

    if (!targetElement || !container) {
      return;
    }

    lastScrolledToPage.current = activePage;
    isScrollingProgrammatically.current = true;

    // Calculate scroll position relative to container
    const containerRect = container.getBoundingClientRect();
    const elementRect = targetElement.getBoundingClientRect();
    const scrollTop = container.scrollTop + (elementRect.top - containerRect.top);

    container.scrollTo({
      top: scrollTop,
      behavior: "auto"
    });

    // Release programmatic scroll lock after scroll settles (longer delay)
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 300);
  }, [activePage, linkedScrollingEnabled, pageCount, isScrollSource]);

  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted-foreground">
        <span>{pageCount > 0 ? `Pages: ${pageCount}` : "Loading PDF..."}</span>
        {linkedScrollingEnabled && pageCount > 0 && (
          <span className="rounded bg-muted px-2 py-1 text-xs">
            Page {activePage}
          </span>
        )}
      </div>
      <div ref={containerRef} className="max-h-[75vh] overflow-y-auto p-4">
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
