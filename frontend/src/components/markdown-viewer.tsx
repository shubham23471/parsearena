"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownViewerProps = {
  markdown: string;
  activePage: number;
  totalPages: number;
  linkedScrollingEnabled: boolean;
  isScrollSource: boolean;
  onPageChange: (page: number) => void;
};

type PageSection = {
  pageNumber: number;
  content: string;
  isEmpty: boolean;
};

function parseMarkdownIntoPages(markdown: string, totalPages: number): PageSection[] {
  // Check if markdown has form feed characters (page breaks)
  const hasPageBreaks = markdown.includes("\f");
  
  if (hasPageBreaks) {
    // Split by form feed, keeping empty sections to maintain page alignment
    const rawSections = markdown.split("\f");
    const sections: PageSection[] = [];
    
    for (let i = 0; i < totalPages; i++) {
      const content = rawSections[i]?.trim() ?? "";
      sections.push({
        pageNumber: i + 1,
        content,
        isEmpty: content.length === 0
      });
    }
    
    // If there are extra sections beyond totalPages, merge them into last page
    if (rawSections.length > totalPages) {
      const extraContent = rawSections.slice(totalPages).map(s => s.trim()).filter(s => s).join("\n\n");
      if (extraContent && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        lastSection.content = lastSection.content 
          ? `${lastSection.content}\n\n${extraContent}` 
          : extraContent;
        lastSection.isEmpty = false;
      }
    }
    
    return sections;
  }
  
  // No page breaks - create one section per PDF page
  // Put all content in the first section, mark rest as "content continues from page 1"
  const sections: PageSection[] = [];
  const trimmedMarkdown = markdown.trim();
  
  for (let i = 0; i < totalPages; i++) {
    if (i === 0) {
      sections.push({
        pageNumber: 1,
        content: trimmedMarkdown,
        isEmpty: trimmedMarkdown.length === 0
      });
    } else {
      sections.push({
        pageNumber: i + 1,
        content: "",
        isEmpty: true
      });
    }
  }
  
  return sections;
}

function getVisiblePageNumber(
  container: HTMLElement,
  totalPages: number
): number {
  const containerRect = container.getBoundingClientRect();
  const pageElements = container.querySelectorAll<HTMLElement>("[data-page-number]");
  
  if (pageElements.length === 0) {
    return 1;
  }

  let bestPage = 1;
  let bestVisibility = 0;

  for (const element of pageElements) {
    const pageNum = Number(element.dataset.pageNumber);
    if (!Number.isFinite(pageNum)) continue;

    const rect = element.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, containerRect.top);
    const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibility = visibleHeight / Math.max(rect.height, 1);

    // Prefer the page that has more than 50% visible
    if (visibility > 0.5) {
      return pageNum;
    }
    if (visibility > bestVisibility) {
      bestVisibility = visibility;
      bestPage = pageNum;
    }
  }

  return Math.min(Math.max(bestPage, 1), totalPages);
}

export function MarkdownViewer({
  markdown,
  activePage,
  totalPages,
  linkedScrollingEnabled,
  isScrollSource,
  onPageChange
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScrollingProgrammatically = useRef(false);
  const lastScrolledToPage = useRef<number | null>(null);
  
  const sections = useMemo(
    () => parseMarkdownIntoPages(markdown, totalPages),
    [markdown, totalPages]
  );
  
  const hasRealPageBreaks = useMemo(
    () => markdown.includes("\f"),
    [markdown]
  );

  // Handle user scroll - detect which page is visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !linkedScrollingEnabled) {
      return;
    }

    let rafId: number | null = null;

    const handleScroll = () => {
      if (isScrollingProgrammatically.current) {
        return;
      }

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const visiblePage = getVisiblePageNumber(container, totalPages);
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
  }, [linkedScrollingEnabled, activePage, onPageChange, totalPages]);

  // Scroll to page when activePage changes from another source
  useLayoutEffect(() => {
    if (!linkedScrollingEnabled) {
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

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const targetPage = Math.min(Math.max(activePage, 1), totalPages);
    const targetElement = container.querySelector<HTMLElement>(
      `[data-page-number="${targetPage}"]`
    );

    if (!targetElement) {
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
  }, [activePage, linkedScrollingEnabled, totalPages, isScrollSource]);

  return (
    <div ref={containerRef} className="max-h-[75vh] space-y-2 overflow-y-auto p-4">
      {!hasRealPageBreaks && totalPages > 1 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          This parser does not output page-level markers. All content is shown on page 1.
          Linked scrolling will sync scroll position but pages may not align exactly.
        </div>
      )}
      {sections.map((section) => (
        <article
          key={`markdown-page-${section.pageNumber}`}
          data-page-number={section.pageNumber}
          className="min-h-[120px] space-y-4 rounded-md border border-border/60 p-3 text-sm leading-6"
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            Page {section.pageNumber}
          </p>
          {section.isEmpty ? (
            <p className="text-sm italic text-muted-foreground/80">
              {section.pageNumber === 1
                ? "No content extracted for this page."
                : hasRealPageBreaks
                  ? "No content extracted for this page."
                  : "Content shown on page 1 (no page markers in parser output)."}
            </p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-semibold">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
                p: ({ children }) => <p className="text-foreground/90">{children}</p>,
                ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
                code: ({ children }) => (
                  <code className="rounded bg-muted px-1.5 py-1 text-xs text-foreground">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{children}</pre>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                th: ({ children }) => (
                  <th className="border border-border px-3 py-2 text-left font-medium">{children}</th>
                ),
                td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
                tr: ({ children }) => <tr className="odd:bg-background even:bg-muted/30">{children}</tr>
              }}
            >
              {section.content}
            </ReactMarkdown>
          )}
        </article>
      ))}
    </div>
  );
}
