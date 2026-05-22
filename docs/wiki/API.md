# ParseArena API Wiki

Short reference for the backend API exposed by ParseArena.

## Base URL

- Local dev: `http://localhost:8000`
- API prefix: `/api/v1`

## Endpoint Index

- `GET /api/v1/health`
- `POST /api/v1/upload`
- `GET /api/v1/parsers`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `POST /api/v1/jobs/{job_id}/parse`
- `GET /api/v1/jobs/{job_id}/status`
- `GET /api/v1/jobs/{job_id}/results`
- `GET /api/v1/jobs/{job_id}/results/{parser_name}`

## Health

### `GET /api/v1/health`

- Purpose: service health check
- Response: `{"status": "ok"}`

## Upload

### `POST /api/v1/upload`

- Content type: `multipart/form-data`
- Field: `file` (PDF only)
- Returns: `UploadResponse`
  - `job_id`, `filename`, `page_count`, `size_bytes`, `created_at`
- Common errors:
  - `422` invalid file type
  - `422` empty file
  - `422` file too large

## Parsers

### `GET /api/v1/parsers`

- Purpose: list parser registry + runtime availability
- Returns: `list[ParserInfoResponse]`
  - `name`, `display_name`, `description`
  - `is_local`, `is_available`
  - `install_command`

## Jobs

### `GET /api/v1/jobs/{job_id}`

- Purpose: fetch job metadata
- Returns: `JobMetadata`
- Error: `404` if job does not exist

### `GET /api/v1/jobs/{job_id}/pdf`

- Purpose: download original uploaded PDF
- Returns: PDF file stream
- Error: `404` if job/PDF does not exist

### `POST /api/v1/jobs/{job_id}/parse`

- Purpose: queue one or more parsers for a job
- Request body: `ParseRequest`
  - `parsers: string[]`
  - Empty or omitted list defaults to all available parsers
- Returns `202` + `ParseTriggerResponse`
  - `job_id`
  - `parsers: { "<parser_name>": "queued" }`
- Errors:
  - `404` job not found
  - `409` invalid parser selection or parser already running

### `GET /api/v1/jobs/{job_id}/status`

- Purpose: poll per-parser progress
- Returns: `JobStatus`
  - `status`: `uploaded | parsing | completed | error`
  - `parsers`: parser map with:
    - `status`: `pending | queued | running | completed | error`
    - `elapsed_seconds`, `error`
    - `queued_at`, `started_at`, `completed_at`

### `GET /api/v1/jobs/{job_id}/results`

- Purpose: fetch all parser results for a job
- Returns: `AllResultsResponse`
  - `results` map: parser name -> `ParseResultResponse | null`
  - Incomplete/errored parsers return `null`

### `GET /api/v1/jobs/{job_id}/results/{parser_name}`

- Purpose: fetch one parser result
- Returns: `ParseResultResponse`
  - `markdown`, `elapsed_seconds`
- Error: `404` if parser result is missing

## Typical Flow

1. `POST /upload` -> get `job_id`
2. `GET /parsers` -> choose available parsers
3. `POST /jobs/{job_id}/parse` with selected parser list
4. Poll `GET /jobs/{job_id}/status` until all parsers finish
5. Read results from:
   - `GET /jobs/{job_id}/results` (all), or
   - `GET /jobs/{job_id}/results/{parser_name}` (single)
