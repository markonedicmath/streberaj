import "server-only";
import { sign, timingSafeEqual } from "node:crypto";
import { DomainError, id } from "./domain";
import { readState, transact } from "./store";
import { parseSheets, reconcileSources, type SheetsDocument } from "./sheets";
import { personalGoogleToken } from "./google-oauth";
import type { SchoolState } from "./types";
import { replaceBoardFromSheets } from "./board-reset";
let cached: { key: string; value: string; expires: number } | undefined;
export function secretEqual(a: string | null, b: string | undefined) {
  return (
    !!a &&
    !!b &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
async function token(state: SchoolState) {
  const connection =
    state.googleConnection?.spreadsheetId === state.sync.spreadsheetId
      ? state.googleConnection
      : undefined;
  const cacheKey = connection
    ? connection.id
    : "service:" + process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (cached?.key === cacheKey && cached.expires > Date.now() + 60000)
    return cached.value;
  if (connection) {
    cached = { key: cacheKey, ...(await personalGoogleToken(connection)) };
    return cached.value;
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key = process.env.GOOGLE_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!email || !key)
    throw new DomainError(
      "Serverski pristup Google tabeli još nije podešen.",
      503,
    );
  const now = Math.floor(Date.now() / 1000),
    encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url"),
    unsigned =
      encode({ alg: "RS256", typ: "JWT" }) +
      "." +
      encode({
        iss: email,
        scope:
          "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    assertion =
      unsigned +
      "." +
      sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(20000),
    }),
    data = await res.json();
  if (!res.ok || !data.access_token)
    throw new DomainError("Google nije odobrio serverski pristup tabeli.", 503);
  cached = {
    key: cacheKey,
    value: data.access_token,
    expires: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
  return cached.value;
}
async function google(
  state: SchoolState,
  url: string,
  options: RequestInit = {},
) {
  const bearer = await token(state),
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: "Bearer " + bearer,
        "Content-Type": "application/json",
        ...options.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  if (!res.ok) {
    if (res.status === 401) cached = undefined;
    throw new DomainError(
      res.status === 429
        ? "Google je privremeno ograničio broj zahteva. Uvoz će se ponoviti."
        : "Google tabela nije dostupna. Proverite sačuvani link i pristup povezanog naloga.",
      503,
    );
  }
  return res.status === 204 ? null : res.json();
}
let running: Promise<{ count: number; lastSuccess: string | null }> | undefined;
export async function synchronize(
  options: {
    onlyIfDue?: boolean;
    resetBoard?: { actorId: string; revision: number };
  } = {},
) {
  if (running) {
    if (options.resetBoard)
      throw new DomainError(
        "Sinhronizacija je u toku. Sačekajte i pokušajte ponovo.",
        409,
      );
    return running;
  }
  const initial = await readState();
  if (running) {
    if (options.resetBoard)
      throw new DomainError(
        "Sinhronizacija je u toku. Sačekajte i pokušajte ponovo.",
        409,
      );
    return running;
  }
  if (
    options.onlyIfDue &&
    initial.sync.lastAttempt &&
    Date.now() - Date.parse(initial.sync.lastAttempt) < 15 * 60 * 1000
  )
    return { count: 0, lastSuccess: initial.sync.lastSuccess };
  const job = runSynchronization(options.resetBoard, options.onlyIfDue);
  running = job;
  try {
    return await job;
  } finally {
    if (running === job) running = undefined;
  }
}
async function runSynchronization(
  resetBoard?: {
    actorId: string;
    revision: number;
  },
  onlyIfDue?: boolean,
) {
  const initial = await readState(),
    sheet = initial.sync.spreadsheetId;
  if (!sheet)
    throw new DomainError("Najpre povežite Google tabelu u administraciji.");
  const leaseId = id();
  const claim = await transact((s) => {
    if (resetBoard && s.revision !== resetBoard.revision)
      throw new DomainError(
        "Podaci su promenjeni. Pregledajte osveženu evidenciju i potvrdite ponovo.",
        409,
      );
    if (s.googleSyncLease && s.googleSyncLease.expires > Date.now()) {
      if (resetBoard)
        throw new DomainError(
          "Sinhronizacija je u toku. Pokušajte ponovo za trenutak.",
          409,
        );
      else return false;
    }
    if (s.sync.spreadsheetId !== sheet)
      throw new DomainError("Izvor je promenjen. Ponovite uvoz.", 409);
    s.googleSyncLease = { id: leaseId, expires: Date.now() + 90000 };
    s.sync.lastAttempt = new Date().toISOString();
    return true;
  });
  if (!claim.result)
    return { count: 0, lastSuccess: claim.state.sync.lastSuccess };
  try {
    const fields =
      "sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(formattedValue,effectiveValue,effectiveFormat(backgroundColor,backgroundColorStyle),userEnteredFormat(backgroundColor)))))";
    const endpoint = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(sheet);
    // The source has formatting far beyond its timetable. Reading the whole
    // workbook can exceed a Worker's memory before JSON parsing even starts.
    const metadata = await google(initial, endpoint + "?fields=sheets(properties(sheetId,title))") as SheetsDocument;
    let year = initial.sync.firstYear, previousMonth = 0;
    const weeks: { title: string; year: number }[] = [];
    for (const tab of metadata.sheets) {
      const match = tab.properties.title.match(/^(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?$/);
      if (!match) continue;
      const month = Number(match[2]);
      if (previousMonth && month < previousMonth) year++;
      previousMonth = month;
      weeks.push({ title: tab.properties.title, year });
    }
    if (!weeks.length) throw new DomainError("Nema nedeljnih kartica oblika 19.10–25.10.");
    const targetWeeks =
      onlyIfDue && !resetBoard && weeks.length > 4 ? weeks.slice(-4) : weeks;
    const blocks: ReturnType<typeof parseSheets> = [];
    for (let offset = 0; offset < targetWeeks.length; offset += 4) {
      const batch = targetWeeks.slice(offset, offset + 4);
      const query = new URLSearchParams({ includeGridData: "true", fields });
      // Two header rows plus 96 quarter-hour rows cover even a full day.
      for (const week of batch) query.append("ranges", "'" + week.title.replaceAll("'", "''") + "'!A1:O110");
      const document = await google(initial, endpoint + "?" + query) as SheetsDocument;
      for (const week of batch) {
        const tab = document.sheets.find((tab) => tab.properties.title === week.title);
        if (!tab) throw new DomainError("Nedeljna kartica je promenjena tokom uvoza. Ponovite uvoz.",409);
        blocks.push(...parseSheets({ sheets: [tab] }, week.year));
      }
    }
    const { state } = await transact((s) => {
      if (
        s.sync.spreadsheetId !== sheet ||
        s.sync.firstYear !== initial.sync.firstYear ||
        s.googleConnection?.id !== initial.googleConnection?.id ||
        s.googleSyncLease?.id !== leaseId ||
        s.googleSyncLease.expires <= Date.now()
      )
        throw new DomainError(
          "Podešavanje izvora je promenjeno tokom uvoza. Ponovite uvoz.",
          409,
        );
      if (resetBoard) {
        if (s.revision !== claim.state.revision)
          throw new DomainError(
            "Neko je promenio podatke tokom preuzimanja. Ništa nije obrisano; pregledajte izmene i pokušajte ponovo.",
            409,
          );
        replaceBoardFromSheets(s, blocks, resetBoard.actorId);
      } else reconcileSources(s, blocks);
    });
    const appUrl = process.env.APP_URL;
    if (
      appUrl?.startsWith("https://") &&
      initial.googleConnection?.spreadsheetId !== sheet &&
      (!state.sync.watchExpires ||
        state.sync.watchExpires < Date.now() + 6 * 3600000)
    ) {
      const watchId = id(),
        watchToken = id() + id(),
        expiration = Date.now() + 23 * 3600000;
      try {
        const watch = await google(
          initial,
          "https://www.googleapis.com/drive/v3/files/" +
            encodeURIComponent(sheet) +
            "/watch",
          {
            method: "POST",
            body: JSON.stringify({
              id: watchId,
              type: "web_hook",
              address: appUrl + "/api/sync/webhook",
              token: watchToken,
              expiration: String(expiration),
            }),
          },
        );
        await transact((s) => {
          if (
            s.sync.spreadsheetId === sheet &&
            s.googleConnection?.id === initial.googleConnection?.id
          )
            Object.assign(s.sync, {
              watchId,
              watchToken,
              resourceId: watch.resourceId,
              watchExpires: Number(watch.expiration ?? expiration),
            });
        });
        if (state.sync.watchId && state.sync.resourceId)
          await google(
            initial,
            "https://www.googleapis.com/drive/v3/channels/stop",
            {
              method: "POST",
              body: JSON.stringify({
                id: state.sync.watchId,
                resourceId: state.sync.resourceId,
              }),
            },
          ).catch(() => {});
      } catch {
        await transact((s) => {
          if (
            s.sync.spreadsheetId === sheet &&
            s.googleConnection?.id === initial.googleConnection?.id
          )
            s.sync.lastError =
              "Uvoz radi; Google obaveštenja nisu aktivna. Rezervna provera nastavlja da radi.";
        });
      }
    }
    return { count: blocks.length, lastSuccess: state.sync.lastSuccess };
  } catch (e) {
    await transact((s) => {
      if (
        s.sync.spreadsheetId === sheet &&
        s.googleConnection?.id === initial.googleConnection?.id &&
        s.googleSyncLease?.id === leaseId
      )
        s.sync.lastError =
          e instanceof DomainError
            ? e.message
            : "Uvoz nije uspeo; prethodni podaci ostaju sačuvani.";
    }).catch(() => {});
    throw e;
  } finally {
    await transact((s) => {
      if (s.googleSyncLease?.id === leaseId) delete s.googleSyncLease;
    }).catch(() => {});
  }
}
