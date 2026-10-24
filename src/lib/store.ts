import "server-only";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { SchoolState } from "./types";
import { localState, emptyState } from "./seed";
import { DomainError, id } from "./domain";
import { normalizeStaffColors, STAFF_COLORS } from "./staff-colors";
import { applySchoolDefaults } from "./school-defaults";
import { clearSampleData } from "./sample-cleanup";
import { activatePricing } from "./pricing";
import { initializeDurationRounding } from "./duration-rounding";
import { activateSharedFinance } from "./shared-finance";
export const isDemo = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.MANOJLO_LOCAL_DEMO === "1";
export const configured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dataDirectory = () => {
  const namespace = process.env.MANOJLO_DATA_NAMESPACE ?? "";
  if (!/^[a-zA-Z0-9_-]*$/.test(namespace))
    throw new DomainError("Neispravan naziv lokalne baze.", 503);
  return path.join(process.cwd(), ".data", namespace);
};
export function service() {
  if (!configured())
    throw new DomainError(
      "Google prijava i baza još nisu podešene. Pogledajte uputstvo za pokretanje.",
      503,
    );
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
async function sqlite() {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(dataDirectory(), { recursive: true });
  const db = new DatabaseSync(path.join(dataDirectory(), "school.sqlite"));
  db.exec(
    "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS school (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO school VALUES (1,0,?)").run(
    JSON.stringify(localState()),
  );
  return db;
}
export async function readState(): Promise<SchoolState> {
  if (isDemo()) {
    const db = await sqlite();
    try {
      const row = db
        .prepare("SELECT data,revision FROM school WHERE id=1")
        .get() as { data: string; revision: number };
      const state = {
        ...JSON.parse(row.data),
        revision: row.revision,
      } as SchoolState;
      const defaultsChanged = applySchoolDefaults(state);
      const samplesCleared = clearSampleData(state);
      const pricingActivated = activatePricing(state);
      const durationsRounded = initializeDurationRounding(state);
      const financeActivated = activateSharedFinance(state);
      if (
        normalizeStaffColors(state.employees) ||
        defaultsChanged ||
        samplesCleared ||
        pricingActivated ||
        durationsRounded ||
        financeActivated
      ) {
        if (await compareAndSwap(state, state.revision))
          return { ...state, revision: state.revision + 1 };
        return readState();
      }
      return state;
    } finally {
      db.close();
    }
  }
  const { data, error } = await service()
    .from("school_state")
    .select("data,revision")
    .eq("id", true)
    .single();
  if (error)
    throw new DomainError(
      "Baza nije spremna. Primenite Supabase migraciju.",
      503,
    );
  const state = {
    ...emptyState(),
    ...data.data,
    revision: Number(data.revision),
  } as SchoolState;
  if (!state.employees.length && process.env.MANOJLO_ADMIN_EMAIL) {
    state.employees.push({
      id: id(),
      email: process.env.MANOJLO_ADMIN_EMAIL.toLowerCase(),
      name: "Manojlo",
      role: "admin",
      color: STAFF_COLORS[0].background,
      canSetPrice: true,
      active: true,
    });
    if (await compareAndSwap(state, state.revision))
      return { ...state, revision: state.revision + 1 };
    return readState();
  }
  const defaultsChanged = applySchoolDefaults(state);
  const samplesCleared = clearSampleData(state);
  const pricingActivated = activatePricing(state);
  const durationsRounded = initializeDurationRounding(state);
  const financeActivated = activateSharedFinance(state);
  if (
    normalizeStaffColors(state.employees) ||
    defaultsChanged ||
    samplesCleared ||
    pricingActivated ||
    durationsRounded ||
    financeActivated
  ) {
    if (await compareAndSwap(state, state.revision))
      return { ...state, revision: state.revision + 1 };
    return readState();
  }
  return state;
}
export async function compareAndSwap(
  state: SchoolState,
  revision: number,
): Promise<boolean> {
  if (isDemo()) {
    const db = await sqlite();
    try {
      const result = db
        .prepare(
          "UPDATE school SET data=?, revision=revision+1 WHERE id=1 AND revision=?",
        )
        .run(JSON.stringify({ ...state, revision: revision + 1 }), revision);
      return Number(result.changes) === 1;
    } finally {
      db.close();
    }
  }
  const { data, error } = await service().rpc("save_school_state", {
    p_expected_revision: revision,
    p_data: { ...state, revision: revision + 1 },
  });
  if (error)
    throw new DomainError("Čuvanje u bazi nije uspelo. Pokušajte ponovo.", 503);
  return data === true;
}
export async function transact<T>(
  fn: (s: SchoolState) => T,
): Promise<{ state: SchoolState; result: T }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await readState(),
      revision = state.revision;
    const result = fn(state);
    if (await compareAndSwap(state, revision))
      return { state: { ...state, revision: revision + 1 }, result };
  }
  throw new DomainError(
    "Drugi korisnik upravo menja evidenciju. Osvežite i pokušajte ponovo.",
    409,
  );
}
