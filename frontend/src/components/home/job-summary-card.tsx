"use client";

type JobSummaryCardProps = {
  jobId: string;
  jobInfoExpanded: boolean;
  onToggleExpanded: () => void;
  parseError: string | null;
  parseState: "idle" | "parsing" | "completed" | "error";
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  uploadedFileName: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  uploading: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  idle: "bg-muted text-muted-foreground",
  parsing: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300"
};

function statusStyle(status: string): string {
  return STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
}

export function JobSummaryCard({
  jobId,
  jobInfoExpanded,
  onToggleExpanded,
  parseError,
  parseState,
  uploadState,
  uploadedFileName
}: JobSummaryCardProps) {
  const fileName = uploadedFileName ?? "PDF file";

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Document</p>
          <p className="mt-1 max-w-full truncate text-base font-semibold text-foreground" title={fileName}>
            {fileName}
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
          onClick={onToggleExpanded}
        >
          {jobInfoExpanded ? "Hide metadata" : "View metadata"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={["rounded px-2 py-1 font-medium capitalize", statusStyle(uploadState)].join(" ")}>
          Upload {uploadState}
        </span>
        <span className={["rounded px-2 py-1 font-medium capitalize", statusStyle(parseState)].join(" ")}>
          Parse {parseState}
        </span>
        <span className="rounded border border-border bg-background px-2 py-1 font-mono text-muted-foreground">
          {jobId.slice(0, 8)}
        </span>
      </div>

      {jobInfoExpanded && (
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">File</dt>
            <dd className="truncate text-foreground" title={fileName}>
              {fileName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job ID</dt>
            <dd className="break-all font-mono text-foreground">{jobId}</dd>
          </div>
        </dl>
      )}

      {parseError && <p className="mt-3 text-sm text-red-400">{parseError}</p>}
    </section>
  );
}
