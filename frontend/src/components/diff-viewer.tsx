"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { DiffBlock, InlineDiff } from "@/types";

type DiffViewerProps = {
  blocks: DiffBlock[];
};

type ViewRow =
  | { kind: "block"; block: DiffBlock; key: string }
  | { kind: "collapsed"; start: number; end: number; count: number; key: string };

const COLLAPSE_THRESHOLD = 4;

function getBlockBadge(type: DiffBlock["type"]): string {
  if (type === "heading") {
    return "H";
  }
  if (type === "paragraph") {
    return "¶";
  }
  if (type === "table") {
    return "┃";
  }
  if (type === "list") {
    return "•";
  }
  if (type === "code") {
    return "{}";
  }
  if (type === "page_break") {
    return "Pg";
  }
  return "·";
}

function sideStatusClass(block: DiffBlock, side: "A" | "B"): string {
  if (block.status === "changed") {
    return "bg-amber-500/10 border-amber-400/30";
  }
  if (block.status === "added") {
    return side === "A" ? "bg-red-500/10 border-red-400/30" : "bg-emerald-500/10 border-emerald-400/30";
  }
  if (block.status === "removed") {
    return side === "A" ? "bg-emerald-500/10 border-emerald-400/30" : "bg-red-500/10 border-red-400/30";
  }
  return "bg-background border-border";
}

function renderInlineDiff(parts: InlineDiff[] | undefined, side: "A" | "B"): ReactNode {
  if (!parts || parts.length === 0) {
    return null;
  }
  return parts.map((part, index) => {
    if (part.status === "added" && side === "A") {
      return null;
    }
    if (part.status === "removed" && side === "B") {
      return null;
    }
    const className =
      part.status === "added"
        ? "bg-emerald-500/20 text-emerald-200"
        : part.status === "removed"
          ? "bg-red-500/20 text-red-200 line-through"
          : "";
    return (
      <span key={`${side}-inline-${index}`} className={className}>
        {part.text}
      </span>
    );
  });
}

function buildRows(blocks: DiffBlock[], expandedKeys: Set<string>): ViewRow[] {
  const rows: ViewRow[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      break;
    }
    if (block.status !== "matched") {
      rows.push({ kind: "block", block, key: `block-${index}` });
      index += 1;
      continue;
    }

    let end = index;
    while (end < blocks.length && blocks[end]?.status === "matched") {
      end += 1;
    }
    const count = end - index;
    const collapseKey = `collapse-${index}-${end}`;
    if (count >= COLLAPSE_THRESHOLD && !expandedKeys.has(collapseKey)) {
      rows.push({
        kind: "collapsed",
        start: index,
        end,
        count,
        key: collapseKey
      });
      index = end;
      continue;
    }
    for (let i = index; i < end; i += 1) {
      const rowBlock = blocks[i];
      if (rowBlock) {
        rows.push({ kind: "block", block: rowBlock, key: `block-${i}` });
      }
    }
    index = end;
  }

  return rows;
}

export function DiffViewer({ blocks }: DiffViewerProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const syncingRef = useRef<"left" | "right" | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => buildRows(blocks, expandedGroups), [blocks, expandedGroups]);

  const handleScroll = (source: "left" | "right") => {
    const sourceNode = source === "left" ? leftRef.current : rightRef.current;
    const targetNode = source === "left" ? rightRef.current : leftRef.current;
    if (!sourceNode || !targetNode) {
      return;
    }
    if (syncingRef.current && syncingRef.current !== source) {
      return;
    }
    syncingRef.current = source;
    targetNode.scrollTop = sourceNode.scrollTop;
    window.setTimeout(() => {
      syncingRef.current = null;
    }, 20);
  };

  return (
    <section className="rounded-lg border border-border">
      <div className="grid grid-cols-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>Parser A</span>
        <span>Parser B</span>
      </div>
      <div className="grid grid-cols-2 gap-0">
        <div ref={leftRef} onScroll={() => handleScroll("left")} className="max-h-[72vh] overflow-y-auto border-r border-border">
          {rows.map((row) => {
            if (row.kind === "collapsed") {
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    setExpandedGroups((previous) => {
                      const next = new Set(previous);
                      next.add(row.key);
                      return next;
                    });
                  }}
                  className="m-2 w-[calc(100%-1rem)] rounded border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground"
                >
                  Show {row.count} identical blocks
                </button>
              );
            }
            const content = row.block.contentA;
            return (
              <div key={row.key} className={["m-2 rounded border p-2 text-xs", sideStatusClass(row.block, "A")].join(" ")}>
                <p className="mb-1 text-[11px] text-muted-foreground">{getBlockBadge(row.block.type)}</p>
                <div className="whitespace-pre-wrap leading-5">
                  {row.block.status === "changed" ? renderInlineDiff(row.block.inlineDiff, "A") : content ?? "Missing in A"}
                </div>
              </div>
            );
          })}
        </div>

        <div ref={rightRef} onScroll={() => handleScroll("right")} className="max-h-[72vh] overflow-y-auto">
          {rows.map((row) => {
            if (row.kind === "collapsed") {
              return (
                <button
                  key={`${row.key}-right`}
                  type="button"
                  onClick={() => {
                    setExpandedGroups((previous) => {
                      const next = new Set(previous);
                      next.add(row.key);
                      return next;
                    });
                  }}
                  className="m-2 w-[calc(100%-1rem)] rounded border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground"
                >
                  Show {row.count} identical blocks
                </button>
              );
            }
            const content = row.block.contentB;
            return (
              <div key={`${row.key}-right`} className={["m-2 rounded border p-2 text-xs", sideStatusClass(row.block, "B")].join(" ")}>
                <p className="mb-1 text-[11px] text-muted-foreground">{getBlockBadge(row.block.type)}</p>
                <div className="whitespace-pre-wrap leading-5">
                  {row.block.status === "changed" ? renderInlineDiff(row.block.inlineDiff, "B") : content ?? "Missing in B"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
