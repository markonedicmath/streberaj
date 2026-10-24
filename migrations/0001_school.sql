CREATE TABLE IF NOT EXISTS school_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  write_token TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO school_meta(id,revision,write_token) VALUES(1,0,'');
CREATE TABLE IF NOT EXISTS school_chunks (
  revision INTEGER NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(revision,part)
);
