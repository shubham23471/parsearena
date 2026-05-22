1. Parser dependencies are optional — only aiosqlite is added to core deps. Users install parsers they want. The registry auto-detects availability.
2. MinerU uses a CLI wrapper instead of its unstable Python API — the mineru CLI is the stable interface.
3. Polling (not WebSockets) for progress tracking — simpler, already established in Phase 1, works fine at 1.5s intervals.
4. Settings stored in SQLite with .env override — API keys set via the UI persist in the DB, but env vars take precedence.