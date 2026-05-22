"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownViewerProps = {
  markdown: string;
  activePage: number;
  totalPages: number;
  linkedScrollingEnabled: boolean;
  scrollSourceId: string;
  onActivePageChange?: (page: number, sourceId: string) => void;
};

function splitMarkdownByPage(markdown: string): string[] {
  if (markdown.includes("\f")) {
    return markdown
      .split("\f")
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
  }
  return [markdown];
}

export function MarkdownViewer({
  markdown,
  activePage,
  totalPages,
  onActivePageChange,
  linkedScrollingEnabled,
  scrollSourceId
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sections = useMemo(() => splitMarkdownByPage(markdown), [markdown]);
  const usesPageSections = sections.length > 1 && sections.length === totalPages;
  const isProgrammaticScrollRef = useRef(false);
  const lastReportedPageRef = useRef<number>(1);

  useEffect(() => {
    if (!linkedScrollingEnabled) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const targetPage = Math.min(Math.max(activePage, 1), Math.max(totalPages, 1));
    isProgrammaticScrollRef.current = true;

    if (usesPageSections) {
      const target = container.querySelector<HTMLElement>(`[data-page-number="${targetPage}"]`);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    } else {
      const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
      const scrollRatio = totalPages > 1 ? (targetPage - 1) / (totalPages - 1) : 0;
      container.scrollTo({ top: maxScrollTop * scrollRatio, behavior: "smooth" });
    }

    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 350);
  }, [activePage, linkedScrollingEnabled, sections.length, totalPages, usesPageSections]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !linkedScrollingEnabled || !onActivePageChange) {
      return;
    }

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      let page = 1;
      if (usesPageSections) {
        const sectionElements = Array.from(
          container.querySelectorAll<HTMLElement>("[data-page-number]")
        );
        if (sectionElements.length > 0) {
          const scrollTop = container.scrollTop;
          const closestSection = sectionElements.reduce((closest, current) => {
            const distance = Math.abs(current.offsetTop - scrollTop);
            const bestDistance = Math.abs(closest.offsetTop - scrollTop);
            return distance < bestDistance ? current : closest;
          });
          page = Number(closestSection.dataset.pageNumber ?? "1");
        }
      } else {
        const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
        const ratio = maxScrollTop > 0 ? container.scrollTop / maxScrollTop : 0;
        page = Math.round(ratio * Math.max(totalPages - 1, 0)) + 1;
      }

      page = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
      if (page !== lastReportedPageRef.current) {
        lastReportedPageRef.current = page;
        onActivePageChange(page, scrollSourceId);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [linkedScrollingEnabled, onActivePageChange, scrollSourceId, totalPages, usesPageSections]);

  return (
    <div ref={containerRef} className="max-h-[75vh] space-y-5 overflow-y-auto p-4">
      {sections.map((section, index) => (
        <article
          key={`markdown-page-${index + 1}`}
          data-page-number={index + 1}
          className="space-y-4 rounded-md border border-border/60 p-3 text-sm leading-6"
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Page {index + 1}</p>
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
            {section}
          </ReactMarkdown>
        </article>
      ))}
    </div>
  );
}
