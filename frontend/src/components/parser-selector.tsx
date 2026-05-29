"use client";

import { useEffect, useMemo, useState } from "react";

import { getParsers } from "@/api";
import type { ParserInfo } from "@/types";

type ParserSelectorProps = {
  disabled?: boolean;
  lockedParserNames?: string[];
  onSubmitSelection: (parserNames: string[]) => void;
};

export function ParserSelector({
  disabled = false,
  lockedParserNames = [],
  onSubmitSelection
}: ParserSelectorProps) {
  const [parsers, setParsers] = useState<ParserInfo[]>([]);
  const [selectedParsers, setSelectedParsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockedParsersSet = useMemo(() => new Set(lockedParserNames), [lockedParserNames]);

  const runnableParsers = useMemo(
    () =>
      parsers
        .filter((parser) => parser.is_available && !lockedParsersSet.has(parser.name))
        .map((parser) => parser.name),
    [lockedParsersSet, parsers]
  );

  useEffect(() => {
    let mounted = true;

    async function loadParsers(): Promise<void> {
      try {
        const parserList = await getParsers();
        if (!mounted) {
          return;
        }
        setParsers(parserList);
        setSelectedParsers(
          parserList
            .filter((item) => item.is_available && !lockedParsersSet.has(item.name))
            .map((item) => item.name)
        );
      } catch (loadError: unknown) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load parser registry.";
        setError(message);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadParsers();
    return () => {
      mounted = false;
    };
  }, [lockedParsersSet]);

  useEffect(() => {
    setSelectedParsers((previous) =>
      previous.filter((parserName) => runnableParsers.includes(parserName))
    );
  }, [runnableParsers]);

  function toggleParser(parserName: string): void {
    if (lockedParsersSet.has(parserName)) {
      return;
    }
    setSelectedParsers((previous) =>
      previous.includes(parserName)
        ? previous.filter((name) => name !== parserName)
        : [...previous, parserName]
    );
  }

  function selectAllAvailable(): void {
    setSelectedParsers(runnableParsers);
  }

  function deselectAll(): void {
    setSelectedParsers([]);
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Loading available parsers...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-red-400">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/50 bg-card/30 p-4 shadow-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Parser Selection</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || runnableParsers.length === 0}
            onClick={selectAllAvailable}
            className="rounded border border-border/50 bg-background/50 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={deselectAll}
            className="rounded border border-border/50 bg-background/50 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {parsers.map((parser) => {
          const isLocked = lockedParsersSet.has(parser.name);
          const isChecked = selectedParsers.includes(parser.name);
          const shouldAppearChecked = isChecked || isLocked;
          return (
            <label
              key={parser.name}
              className={[
                "flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                shouldAppearChecked ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30",
                !parser.is_available || isLocked ? "opacity-60 cursor-not-allowed" : ""
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={shouldAppearChecked}
                disabled={disabled || !parser.is_available || isLocked}
                onChange={() => {
                  toggleParser(parser.name);
                }}
                className="mt-1 h-4 w-4 accent-primary rounded border-border"
              />
              <div className="space-y-1 w-full overflow-hidden">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-sm truncate">
                    {parser.display_name}
                    {parser.library_version ? ` v${parser.library_version}` : ""}
                  </span>
                  <span
                    className={[
                      "shrink-0 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                      isLocked
                        ? "bg-muted text-muted-foreground"
                        : parser.is_available
                        ? "bg-green-500/10 text-green-500"
                        : "bg-muted text-muted-foreground"
                    ].join(" ")}
                  >
                    {isLocked
                      ? "Completed"
                      : parser.is_available
                        ? parser.library_version
                          ? `v${parser.library_version} • Ready`
                          : "Ready"
                        : "Missing"}
                  </span>
                </div>
                {isLocked ? (
                  <span className="block text-xs text-muted-foreground line-clamp-2">
                    Already completed for this job. Start a new upload to run it again.
                  </span>
                ) : parser.is_available ? (
                  <span className="block text-xs text-muted-foreground line-clamp-2" title={parser.description}>{parser.description}</span>
                ) : (
                  <span className="block text-[10px] text-muted-foreground mt-1">
                    Install: <code className="bg-muted px-1 rounded text-foreground">{parser.install_command}</code>
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
        <p className="text-xs text-muted-foreground font-medium">
          {selectedParsers.length} selected
          {lockedParserNames.length > 0 ? ` • ${lockedParserNames.length} completed` : ""}
        </p>
        <button
          type="button"
          disabled={disabled || selectedParsers.length === 0}
          onClick={() => {
            onSubmitSelection(selectedParsers);
          }}
          className="rounded-lg border border-primary/50 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          Run Parser
        </button>
      </div>
    </section>
  );
}
