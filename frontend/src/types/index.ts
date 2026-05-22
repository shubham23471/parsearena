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
