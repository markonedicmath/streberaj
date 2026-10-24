import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { localState } from "./seed";

export function localDatabase(directory: string) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "school.sqlite"));
  db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS school (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL)");
  db.prepare("INSERT OR IGNORE INTO school VALUES (1,0,?)").run(JSON.stringify(localState()));
  return db;
}
