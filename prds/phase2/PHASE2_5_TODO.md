# Phase 2.5 TODO — Frontend: Parser Selection & Progress

- [x] Add parser selection UI component (`parser-selector.tsx`).
- [x] Fetch parser registry from `GET /api/v1/parsers` and render availability states.
- [x] Add select-all and deselect-all actions for available parsers.
- [x] Send selected parser names to `POST /api/v1/jobs/{job_id}/parse`.
- [x] Add parse progress UI component (`parse-progress.tsx`).
- [x] Poll `GET /api/v1/jobs/{job_id}/status` every 1.5s while parsers are queued/running.
- [x] Render per-parser status badges, elapsed time, and parser-level errors.
- [x] Render overall parse completion progress (`completed / total`).
- [x] Add all-results API call (`GET /api/v1/jobs/{job_id}/results`) in frontend client.
- [x] Add tabbed multi-result viewer in `app/page.tsx`.
- [x] Show parser error states in tabs when individual parsers fail.
- [x] Update frontend API and types for Phase 2.3/2.5 payloads and responses.
