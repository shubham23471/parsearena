"use client";

import { useEffect, useMemo, useState } from "react";

import { getParsers } from "@/api";
import type { ParserInfo } from "@/types";

type ParserSelectorProps = {
  disabled?: boolean;
  onSubmitSelection: (parserNames: string[]) => void;
};

export function ParserSelector({ disabled = false, onSubmitSelection }: ParserSelectorProps) {
  const [parsers, setParsers] = useState<ParserInfo[]>([]);
  const [selectedParsers, setSelectedParsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableParsers = useMemo(
    () => parsers.filter((parser) => parser.is_available).map((parser) => parser.name),
    [parsers]
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
        setSelectedParsers(parserList.filter((item) => item.is_available).map((item) => item.name));
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
  }, []);

  function toggleParser(parserName: string): void {
    setSelectedParsers((previous) =>
      previous.includes(parserName)
        ? previous.filter((name) => name !== parserName)
        : [...previous, parserName]
    );
  }

  function selectAllAvailable(): void {
    setSelectedParsers(availableParsers);
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
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Parser Selection</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || availableParsers.length === 0}
            onClick={selectAllAvailable}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Select All Available
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={deselectAll}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {parsers.map((parser) => {
          const isChecked = selectedParsers.includes(parser.name);
          return (
            <label
              key={parser.name}
              className="flex items-start gap-3 rounded border border-border p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled || !parser.is_available}
                onChange={() => {
                  toggleParser(parser.name);
                }}
                className="mt-0.5 h-4 w-4 accent-foreground"
              />
              <span className="space-y-1">
                <span className="block font-medium">{parser.display_name}</span>
                <span className="block text-xs text-muted-foreground">{parser.description}</span>
                <span
                  className={[
                    "inline-flex rounded px-2 py-0.5 text-[11px]",
                    parser.is_available
                      ? "bg-green-500/20 text-green-300"
                      : "bg-muted text-muted-foreground"
                  ].join(" ")}
                >
                  {parser.is_available ? "Ready" : "Not Installed"}
                </span>
                {!parser.is_available && (
                  <span className="block text-[11px] text-muted-foreground">
                    Install: <code>{parser.install_command}</code>
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Selected: {selectedParsers.length} / {parsers.length}
        </p>
        <button
          type="button"
          disabled={disabled || selectedParsers.length === 0}
          onClick={() => {
            onSubmitSelection(selectedParsers);
          }}
          className="rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-70"
        >
          Parse Selected
        </button>
      </div>
    </section>
  );
}
