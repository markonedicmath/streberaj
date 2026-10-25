CREATE TABLE IF NOT EXISTS app_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,write_token TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS school_records(collection TEXT NOT NULL,id TEXT NOT NULL,position INTEGER NOT NULL,data TEXT NOT NULL,updated_revision INTEGER NOT NULL,actor_id TEXT,undone INTEGER,PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS school_records_order ON school_records(collection,position);
CREATE INDEX IF NOT EXISTS school_records_delta ON school_records(updated_revision);
CREATE INDEX IF NOT EXISTS school_records_actor ON school_records(collection,actor_id,undone,position);
CREATE TABLE IF NOT EXISTS school_archive(revision INTEGER NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(revision,collection,id));
