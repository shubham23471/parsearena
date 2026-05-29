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
  library_version: string | null;
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
  metadata: ParserMetadata | null;
};

export type ParserMetadata = {
  library_version: string | null;
  execution_device: string | null;
  is_warm_start: boolean | null;
  model_load_seconds: number | null;
  parse_only_seconds: number | null;
  gpu_fallback: boolean | null;
  config_summary: Record<string, unknown> | null;
  element_types?: Record<string, number>;
  strategy?: string;
  plugins_enabled?: boolean;
};

export type StructuralMetrics = {
  word_count: number;
  character_count: number;
  heading_count: number;
  heading_h1_count: number;
  heading_h2_count: number;
  heading_h3_plus_count: number;
  table_count: number;
  list_item_count: number;
  code_block_count: number;
  image_reference_count: number;
  empty_line_ratio: number;
  noise_line_count: number;
  unicode_error_count: number;
  words_per_page: number;
};

export type ChunkSimulationResult = {
  chunk_count: number;
  avg_chunk_size_chars: number;
  min_chunk_size_chars: number;
  max_chunk_size_chars: number;
  chunk_size_std_dev: number;
  preview_chunks: string[];
};

export type ParserMetricsResponse = {
  structural_metrics: StructuralMetrics;
  chunk_simulation: ChunkSimulationResult;
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
  library_version: string | null;
};
