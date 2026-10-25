CREATE TABLE IF NOT EXISTS school_import_cache (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
