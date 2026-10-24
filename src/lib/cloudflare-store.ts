import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SchoolState } from "./types";
import { DomainError } from "./domain";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]>;
}
let cached: { revision: number; state: SchoolState } | undefined;
function database() {
  const env = getCloudflareContext().env as unknown as { DB?: Database };
  if (!env.DB) throw new DomainError("Baza aplikacije nije povezana.", 503);
  return env.DB;
}
export async function readCloudflareState(): Promise<SchoolState | null> {
  const db = database();
  const meta = await db.prepare("SELECT revision FROM school_meta WHERE id=1").first<{ revision: number }>();
  if (!meta) throw new DomainError("Baza nije pripremljena.", 503);
  if (cached?.revision === meta.revision) return structuredClone(cached.state);
  const { results } = await db.prepare("SELECT m.revision,c.part,c.data FROM school_meta m JOIN school_chunks c ON c.revision=m.revision WHERE m.id=1 ORDER BY c.part").all<{ revision: number; part: number; data: string }>();
  if (!results.length) {
    if (meta.revision === 0) return null;
    throw new DomainError("Podaci u bazi nisu kompletni.", 503);
  }
  const state = JSON.parse(results.map((row) => row.data).join("")) as SchoolState;
  state.revision = results[0].revision;
  cached = { revision: state.revision, state: structuredClone(state) };
  return state;
}
export async function saveCloudflareState(state: SchoolState, expected: number) {
  const db = database(), token = crypto.randomUUID(), revision = expected + 1;
  const data = JSON.stringify({ ...state, revision });
  const statements = [db.prepare("UPDATE school_meta SET revision=?,write_token=? WHERE id=1 AND revision=?").bind(revision, token, expected)];
  for (let start = 0, part = 0; start < data.length; part++) {
    let end = Math.min(start + 20000, data.length);
    const last = data.charCodeAt(end - 1);
    if (end < data.length && last >= 0xd800 && last <= 0xdbff) end--;
    statements.push(db.prepare("INSERT INTO school_chunks(revision,part,data) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM school_meta WHERE id=1 AND write_token=?)").bind(revision, part, data.slice(start,end), token));
    start = end;
  }
  statements.push(db.prepare("DELETE FROM school_chunks WHERE revision<>? AND EXISTS(SELECT 1 FROM school_meta WHERE id=1 AND write_token=?)").bind(revision,token));
  const result = await db.batch(statements);
  const saved = result[0].meta.changes === 1;
  if (saved) cached = { revision, state: structuredClone({ ...state, revision }) };
  return saved;
}
