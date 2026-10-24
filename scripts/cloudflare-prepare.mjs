// Run locally: node --env-file=.env.local scripts/cloudflare-prepare.mjs
// Files containing private data stay under the git-ignored .data directory.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import path from "node:path";

const directory = path.resolve(".data");
mkdirSync(path.join(directory, "backups"), { recursive: true });
const db = new DatabaseSync(path.join(directory, "school.sqlite"), { readOnly: true });
const backup = path.join(directory, "backups", `cloudflare-${Date.now()}.sqlite`);
db.prepare("VACUUM INTO ?").run(backup);
const row = db.prepare("SELECT data,revision FROM school WHERE id=1").get();
db.close();
if (!row) throw new Error("Nedostaju lokalni podaci.");
const state = JSON.parse(row.data);
const email = "markonedicmath@gmail.com";
let owner = state.employees.find((employee) => employee.email.toLowerCase() === email);
if (!owner) {
  const color = ["#4d5358", "#198038", "#9f1853", "#654522"].find((color) => !state.employees.some((employee) => employee.color === color));
  if (!color) throw new Error("Dodelite slobodnu boju administratoru.");
  owner = { id: "marko-nedic", name: "Marko Nedić", email, color, role: "admin", active: true, canSetPrice: true, canScheduleOthers: true };
  if (state.employees.some((employee) => employee.id === owner.id)) owner.id = randomUUID();
  state.employees.push(owner);
}
owner.role = "admin";
owner.active = true;
state.revision = Number(row.revision) + 1;
const serialized = JSON.stringify(state), revision = state.revision;
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const sql = [];
for (let start = 0, part = 0; start < serialized.length; part++) {
  let end = Math.min(start + 16000, serialized.length);
  const code = serialized.charCodeAt(end - 1);
  if (end < serialized.length && code >= 0xd800 && code <= 0xdbff) end--;
  sql.push(`INSERT OR REPLACE INTO school_chunks(revision,part,data) SELECT ${revision},${part},${quote(serialized.slice(start, end))} WHERE EXISTS(SELECT 1 FROM school_meta WHERE id=1 AND revision=0);`);
  start = end;
}
sql.push(`UPDATE school_meta SET revision=${revision},write_token=${quote(randomUUID())} WHERE id=1 AND revision=0;`);
writeFileSync(path.join(directory, "cloudflare-seed.sql"), sql.join("\n"), { mode: 0o600 });
const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || readFileSync(path.join(directory, "google-token.key")).toString("base64");
if (Buffer.from(key, "base64").length !== 32) throw new Error("Neispravan serverski ključ.");
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("Nedostaje Google OAuth klijent.");
const secretFile = path.join(directory, "cloudflare-secrets.json");
let previous = {};
try { previous = JSON.parse(readFileSync(secretFile, "utf8")); } catch {}
writeFileSync(secretFile, JSON.stringify({ GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret, GOOGLE_TOKEN_ENCRYPTION_KEY: key, CRON_SECRET: previous.CRON_SECRET || randomBytes(32).toString("hex") }), { mode: 0o600 });
const summary = { revision, bytes: Buffer.byteLength(serialized), sha256: createHash("sha256").update(serialized).digest("hex"), employees: state.employees.length, students: state.students.length, lessons: state.lessons.length, payments: state.payments.length, handovers: state.handovers.length, googleConnected: !!state.googleConnection };
writeFileSync(path.join(directory, "cloudflare-migration-summary.json"), JSON.stringify(summary, null, 2));
console.log("Pripremljen prenos u novu praznu bazu:", summary);
