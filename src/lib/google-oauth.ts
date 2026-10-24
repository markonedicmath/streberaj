import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "./domain";
import { dataDirectory, isDemo } from "./store";
import type { SchoolState } from "./types";

export const SHEETS_READ_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
export const OAUTH_COOKIE = "streberaj-google-connect";
export const GOOGLE_TIMEOUT = 20000;

export function oauthConfigured() {
  return (
    !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
    !!process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    (isDemo() ||
      Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "", "base64")
        .length === 32)
  );
}
export function oauthConfig() {
  if (!oauthConfigured())
    throw new DomainError(
      "Povezivanje Google naloga još nije podešeno. Potrebni su OAuth klijent aplikacije i serverski ključ; lozinka Google naloga nije potrebna.",
      503,
    );
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
  };
}
async function encryptionKey() {
  const configured = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32)
      throw new DomainError(
        "Serverski ključ za Google povezivanje mora imati 32 bajta u Base64 formatu.",
        503,
      );
    return key;
  }
  if (!isDemo())
    throw new DomainError(
      "Nedostaje serverski ključ za Google povezivanje.",
      503,
    );
  const file = path.join(dataDirectory(), "google-token.key");
  await mkdir(dataDirectory(), { recursive: true });
  try {
    await writeFile(file, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const key = await readFile(file);
  if (key.length !== 32)
    throw new DomainError(
      "Lokalni ključ za Google povezivanje nije ispravan.",
      503,
    );
  return key;
}
export async function sealGoogle(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", await encryptionKey(), iv);
  cipher.setAAD(Buffer.from("streberaj-google-v1"));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export async function openGoogle(value: string) {
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      await encryptionKey(),
      data.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from("streberaj-google-v1"));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DomainError(
      "Google vezu treba ponovo odobriti. Sačuvani pristup nije dostupan.",
      409,
    );
  }
}
export function callbackUrl(request: Request) {
  const base = new URL(process.env.APP_URL ?? request.url);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  )
    throw new DomainError(
      "Google povezivanje zahteva HTTPS adresu aplikacije.",
      503,
    );
  return new URL("/api/google/callback", base).toString();
}
export function googleStatus(state: SchoolState) {
  const connection = state.googleConnection;
  const personal =
    !!connection && connection.spreadsheetId === state.sync.spreadsheetId;
  const service =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    !!process.env.GOOGLE_PRIVATE_KEY;
  return {
    oauthConfigured: oauthConfigured(),
    connected: personal || service,
    mode: personal ? "oauth" : service ? "service" : null,
    email: personal
      ? connection.email
      : service
        ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        : null,
    connectedAt: personal ? connection.connectedAt : null,
    spreadsheetId: state.sync.spreadsheetId,
  };
}
export type GoogleConnectionStatus = ReturnType<typeof googleStatus>;
export async function personalGoogleToken(
  connection: NonNullable<SchoolState["googleConnection"]>,
) {
  const config = oauthConfig();
  if (connection.clientId !== config.clientId)
    throw new DomainError(
      "Google klijent je promenjen. Ponovo povežite nalog.",
      503,
    );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: await openGoogle(connection.sealedRefreshToken),
    }),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== "string")
    throw new DomainError(
      response.status === 400 || response.status === 401
        ? "Google odobrenje je isteklo ili povučeno. Ponovo povežite nalog."
        : "Google trenutno nije dostupan. Automatski uvoz će pokušati ponovo.",
      503,
    );
  return {
    value: data.access_token as string,
    expires: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
}
