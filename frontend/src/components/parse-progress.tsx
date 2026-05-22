"use client";

import { useEffect, useMemo, useState } from "react";

import { getJobStatus } from "@/api";
import type { JobStatus, ParserStatus } from "@/types";

type ParseProgressProps = {
  jobId: string;
  onStatusUpdate?: (status: JobStatus) => void;
  onFinished?: (status: JobStatus) => void;
};

function formatElapsed(status: ParserStatus): string {
  if (status.elapsed_seconds !== null) {
    return `${status.elapsed_seconds.toFixed(1)}s`;
  }
  if (status.status === "running" && status.started_at) {
    const startedMs = new Date(status.started_at).getTime();
    const elapsed = Math.max((Date.now() - startedMs) / 1000, 0);
    return `${elapsed.toFixed(1)}s`;
  }
  return "-";
}

function formatExecutionDevice(device: ParserStatus["execution_device"]): string {
  if (device === "cuda") {
    return "GPU (CUDA)";
  }
  if (device === "mps") {
    return "GPU (MPS)";
  }
  if (device === "cpu") {
    return "CPU";
  }
  return "Detecting...";
}

export function ParseProgress({ jobId, onStatusUpdate, onFinished }: ParseProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parserEntries = useMemo(
    () => (status ? Object.entries(status.parsers) : []),
    [status]
  );
  const totalParsers = parserEntries.length;
  const completedParsers = parserEntries.filter(
    ([, parser]) => parser.status === "completed" || parser.status === "error"
  ).length;

  useEffect(() => {
    let intervalId: number | null = null;
    let mounted = true;

    async function pollStatus(): Promise<void> {
      try {
        const latest = await getJobStatus(jobId);
        if (!mounted) {
          return;
        }
        setStatus(latest);
        onStatusUpdate?.(latest);

        const hasActiveParser = Object.values(latest.parsers).some(
          (parser) => parser.status === "queued" || parser.status === "running"
        );
        if (!hasActiveParser) {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
          }
          onFinished?.(latest);
        }
      } catch (pollError: unknown) {
        if (!mounted) {
          return;
        }
        const message = pollError instanceof Error ? pollError.message : "Failed to load parse status.";
        setError(message);
      }
    }

    void pollStatus();
    intervalId = window.setInterval(() => {
      void pollStatus();
    }, 1500);

    return () => {
      mounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [jobId, onFinished, onStatusUpdate]);

  if (error) {
    return (
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-red-400">{error}</p>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Preparing parser progress...</p>
      </section>
    );
  }

  const progressPercent = totalParsers > 0 ? Math.round((completedParsers / totalParsers) * 100) : 0;

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Parser Progress</span>
          <span className="text-muted-foreground">
            {completedParsers}/{totalParsers} completed
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-foreground transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {parserEntries.map(([parserName, parser]) => (
          <div
            key={parserName}
            className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
          >
            <div className="space-y-1">
              <p className="font-medium">{parserName}</p>
              <p className="text-xs text-muted-foreground">
                Device: {formatExecutionDevice(parser.execution_device)}
              </p>
              {parser.error && <p className="text-xs text-red-400">{parser.error}</p>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{formatElapsed(parser)}</span>
              <span
                className={[
                  "rounded px-2 py-0.5",
                  parser.status === "queued" && "bg-muted text-muted-foreground",
                  parser.status === "running" && "bg-blue-500/20 text-blue-300",
                  parser.status === "completed" && "bg-green-500/20 text-green-300",
                  parser.status === "error" && "bg-red-500/20 text-red-300",
                  parser.status === "pending" && "bg-muted text-muted-foreground"
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {parser.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
