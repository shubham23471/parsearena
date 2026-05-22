export type ParserState = "pending" | "queued" | "running" | "completed" | "error";
export type JobState = "uploaded" | "parsing" | "completed" | "error";

export type UploadResponse = {
  job_id: string;
  filename: string;
  page_count: number;
  size_bytes: number;
  created_at: string;
};

export type ParserStatus = {
  name: string;
  status: ParserState;
  elapsed_seconds: number | null;
  error: string | null;
  execution_device: "cuda" | "mps" | "cpu" | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type JobMetadata = {
  job_id: string;
  filename: string;
  page_count: number;
  size_bytes: number;
  created_at: string;
  status: JobState;
  parsers: Record<string, ParserStatus>;
};

export type JobStatus = {
  job_id: string;
  status: JobState;
  parsers: Record<string, ParserStatus>;
};

export type ViewMode = "tab" | "split" | "compare" | "diff";

export type DiffBlockType = "heading" | "paragraph" | "table" | "list" | "code" | "page_break" | "other";

export type DiffStatus = "matched" | "added" | "removed" | "changed";

export type InlineDiff = {
  text: string;
  status: "equal" | "added" | "removed";
};

export type DiffBlock = {
  type: DiffBlockType;
  status: DiffStatus;
  contentA: string | null;
  contentB: string | null;
  inlineDiff?: InlineDiff[];
};

export type DiffSummary = {
  matched: number;
  added: number;
  removed: number;
  changed: number;
  headingsA: number;
  headingsB: number;
  tablesA: number;
  tablesB: number;
  paragraphsA: number;
  paragraphsB: number;
};

export type DiffResult = {
  blocks: DiffBlock[];
  summary: DiffSummary;
};

export type ParseResult = {
  markdown: string;
  elapsed_seconds: number | null;
};

export type ParseRequest = {
  parsers: string[];
};

export type ParseTriggerResponse = {
  job_id: string;
  parsers: Record<string, "queued">;
};

export type AllResultsResponse = {
  job_id: string;
  results: Record<string, ParseResult | null>;
};

export type ParserInfo = {
  name: string;
  display_name: string;
  description: string;
  is_local: boolean;
  requires_api_key: boolean;
  api_key_env_var: string | null;
  install_command: string;
  is_available: boolean;
};
