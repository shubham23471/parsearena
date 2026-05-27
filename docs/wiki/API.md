# ParseArena API Wiki

Short reference for the backend API exposed by ParseArena.

**Base URL**
- Local dev: `http://localhost:8000`
- API prefix: `/api/v1`

## Endpoints

| Method | Endpoint | Purpose | Request Body / Fields | Response | Possible Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health check | - | `{"status": "ok"}` | - |
| `POST` | `/api/v1/upload` | Upload PDF file | `multipart/form-data` with `file` field (PDF only) | `UploadResponse` (`job_id`, `filename`, `page_count`, `size_bytes`, `created_at`) | `422` (invalid file type, empty file, file too large) |
| `GET` | `/api/v1/parsers` | List parser registry & availability | - | `list[ParserInfoResponse]` (`name`, `display_name`, `description`, `is_local`, `is_available`, `install_command`) | - |
| `GET` | `/api/v1/jobs/{job_id}` | Fetch job metadata | - | `JobMetadata` | `404` (job does not exist) |
| `GET` | `/api/v1/jobs/{job_id}/pdf` | Download original uploaded PDF | - | PDF file stream | `404` (job/PDF does not exist) |
| `POST` | `/api/v1/jobs/{job_id}/parse` | Queue one or more parsers for a job | `ParseRequest` (`parsers: string[]`). Empty defaults to all available. | `202` + `ParseTriggerResponse` (`job_id`, `parsers: { "<parser_name>": "queued" }`) | `404` (job not found), `409` (invalid parser selection / already running) |
| `GET` | `/api/v1/jobs/{job_id}/status` | Poll per-parser progress | - | `JobStatus` (overall `status`, plus `parsers` map with `status`, `elapsed_seconds`, `error`, timings) | - |
| `GET` | `/api/v1/jobs/{job_id}/results` | Fetch all parser results for a job | - | `AllResultsResponse` (map of parser name to `ParseResultResponse` or `null`) | - |
| `GET` | `/api/v1/jobs/{job_id}/results/{parser_name}`| Fetch one parser result | - | `ParseResultResponse` (`markdown`, `elapsed_seconds`) | `404` (parser result missing) |

## Typical Flow

1. `POST /upload` -> get `job_id`
2. `GET /parsers` -> choose available parsers
3. `POST /jobs/{job_id}/parse` with selected parser list
4. Poll `GET /jobs/{job_id}/status` until all parsers finish
5. Read results from:
   - `GET /jobs/{job_id}/results` (all), or
   - `GET /jobs/{job_id}/results/{parser_name}` (single)
