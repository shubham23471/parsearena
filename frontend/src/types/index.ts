export type ParserState = "pending" | "parsing" | "completed" | "error";
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

export type ParseResult = {
  markdown: string;
  elapsed_seconds: number | null;
};
