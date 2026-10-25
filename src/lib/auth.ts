import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DomainError } from "./domain";
import { isDemo, configured, readState } from "./store";
import type { SchoolState } from "./types";
import { directGoogleAuth, googleSession } from "./google-login";
import { overrideSession } from "./override-login";
export function localRequest(request: Request) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(request.url).hostname,
  );
}
export async function authClient() {
  if (!configured())
    throw new DomainError("Google prijava još nije podešena.", 503);
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values) {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        },
      },
    },
  );
}
export async function authenticate(request: Request, state?: SchoolState) {
  const s = state ?? (await readState());
  const override = await overrideSession();
  if (override) {
    const actor = s.employees.find((e) => e.id === override.actorId && e.active);
    if (actor) return actor;
  }
  if (isDemo() && localRequest(request)) {
    const selected = (await cookies()).get("demo-actor")?.value ?? "admin";
    const actor = s.employees.find((e) => e.id === selected && e.active);
    if (actor) return actor;
    // A retired sample account should not lock the local preview out.
    const administrator = s.employees.find(
      (e) => e.role === "admin" && e.active,
    );
    if (administrator) return administrator;
  }
  if (directGoogleAuth()) {
    const session = await googleSession();
    const actor = s.employees.find((employee) => employee.id === session.actorId && employee.active && employee.email.toLowerCase() === session.email);
    if (!actor) throw new DomainError("Vaš nalog nije na listi odobrenih zaposlenih.",403);
    return actor;
  }
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email)
    throw new DomainError("Prijavite se Google nalogom.", 401);
  const actor = s.employees.find(
    (e) => e.active && e.email.toLowerCase() === user.email!.toLowerCase(),
  );
  if (!actor)
    throw new DomainError("Vaš nalog nije na listi odobrenih zaposlenih.", 403);
  return actor;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"),
    expected = process.env.APP_URL
      ? new URL(process.env.APP_URL).origin
      : new URL(request.url).origin;
  if (
    !origin ||
    (origin !== expected &&
      !(
        isDemo() &&
        localRequest(request) &&
        ["http://localhost:3000", "http://127.0.0.1:3000"].includes(origin)
      ))
  )
    throw new DomainError("Zahtev nije poslat iz aplikacije.", 403);
}
