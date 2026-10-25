import "server-only";
import { cookies } from "next/headers";
import { openGoogle, sealGoogle } from "./google-oauth";

export const OVERRIDE_COOKIE = "streberaj-troubleshoot-actor";
const MAX_AGE = 7 * 24 * 3600;

export async function overrideSession() {
  try {
    const sealed = (await cookies()).get(OVERRIDE_COOKIE)?.value;
    if (!sealed) return null;
    const value = JSON.parse(await openGoogle(sealed));
    if (value.kind !== "worker-override" || typeof value.actorId !== "string" ||
      !Number.isFinite(value.at) || !Number.isFinite(value.expires) ||
      value.at > Date.now() + 60000 || value.expires <= Date.now() ||
      value.expires - value.at > MAX_AGE * 1000) return null;
    return { actorId: value.actorId as string, email: "", override: true as const };
  } catch { return null; }
}

export async function setOverrideSession(actorId: string, request: Request) {
  const at = Date.now();
  (await cookies()).set(OVERRIDE_COOKIE, await sealGoogle(JSON.stringify({
    kind: "worker-override", actorId, at, expires: at + MAX_AGE * 1000,
  })), { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function clearOverrideSession() {
  (await cookies()).set(OVERRIDE_COOKIE, "", { httpOnly: true, secure: process.env.APP_URL?.startsWith("https:") ?? true, sameSite: "lax", path: "/", maxAge: 0 });
}
