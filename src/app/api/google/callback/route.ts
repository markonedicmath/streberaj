import { cookies } from "next/headers";
import { authenticate } from "@/lib/auth";
import { DomainError, audit, id } from "@/lib/domain";
import { readState, transact } from "@/lib/store";
import { secretEqual } from "@/lib/google";
import {
  callbackUrl,
  oauthConfig,
  OAUTH_COOKIE,
  openGoogle,
  sealGoogle,
  SHEETS_READ_SCOPE,
  GOOGLE_TIMEOUT,
} from "@/lib/google-oauth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const destination = new URL("/", callbackUrl(request));
  try {
    const jar = await cookies(),
      sealed = jar.get(OAUTH_COOKIE)?.value;
    jar.set(OAUTH_COOKIE, "", {
      path: "/api/google",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: callbackUrl(request).startsWith("https:"),
    });
    if (!sealed)
      throw new DomainError(
        "Povezivanje je isteklo. Pokrenite ga ponovo iz administracije.",
      );
    const pending = JSON.parse(await openGoogle(sealed)) as {
      nonce: string;
      verifier: string;
      actorId: string;
      spreadsheetId: string;
      clientId: string;
      redirectUri: string;
      at: number;
    };
    const url = new URL(request.url),
      state = await readState(),
      actor = await authenticate(request, state),
      config = oauthConfig();
    if (
      !secretEqual(url.searchParams.get("state"), pending.nonce) ||
      !Number.isFinite(pending.at) ||
      Date.now() - pending.at > 600000 ||
      pending.at > Date.now() ||
      actor.role !== "admin" ||
      actor.id !== pending.actorId ||
      pending.spreadsheetId !== state.sync.spreadsheetId ||
      pending.clientId !== config.clientId ||
      pending.redirectUri !== callbackUrl(request)
    )
      throw new DomainError(
        "Povezivanje nije potvrđeno za ovaj nalog i tabelu. Pokrenite ga ponovo.",
      );
    if (url.searchParams.has("error"))
      throw new DomainError("Google povezivanje nije odobreno.");
    const code = url.searchParams.get("code");
    if (!code) throw new DomainError("Google nije poslao potvrdu povezivanja.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: pending.redirectUri,
        code_verifier: pending.verifier,
      }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT),
      cache: "no-store",
    });
    const token = await response.json();
    if (
      !response.ok ||
      typeof token.access_token !== "string" ||
      typeof token.refresh_token !== "string" ||
      !String(token.scope ?? "")
        .split(" ")
        .includes(SHEETS_READ_SCOPE)
    )
      throw new DomainError(
        "Google nije odobrio trajni pristup za čitanje tabela. Ponovo pokrenite povezivanje i odobrite čitanje.",
      );
    const headers = { Authorization: "Bearer " + token.access_token };
    const [profileResponse, sheetResponse] = await Promise.all([
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT),
      }),
      fetch(
        "https://sheets.googleapis.com/v4/spreadsheets/" +
          encodeURIComponent(pending.spreadsheetId) +
          "?fields=spreadsheetId",
        {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(GOOGLE_TIMEOUT),
        },
      ),
    ]);
    const profile = await profileResponse.json();
    if (
      !profileResponse.ok ||
      typeof profile.email !== "string" ||
      profile.email_verified !== true
    )
      throw new DomainError("Google nalog nije potvrđen.");
    if (!sheetResponse.ok)
      throw new DomainError(
        "Izabrani Google nalog nema API pristup ovoj tabeli. Proverite da li je tabela podeljena sa tim nalogom.",
      );
    const sealedRefreshToken = await sealGoogle(token.refresh_token),
      connectedAt = new Date().toISOString(),
      connectionId = id();
    await transact((s) => {
      if (
        !s.employees.some(
          (e) => e.id === actor.id && e.active && e.role === "admin",
        ) ||
        s.sync.spreadsheetId !== pending.spreadsheetId
      )
        throw new DomainError(
          "Nalog ili izvor je promenjen. Ponovo pokrenite povezivanje.",
          409,
        );
      s.googleConnection = {
        id: connectionId,
        spreadsheetId: pending.spreadsheetId,
        clientId: config.clientId,
        email: profile.email,
        sealedRefreshToken,
        connectedAt,
        actorId: actor.id,
      };
      Object.assign(s.sync, {
        watchId: undefined,
        watchToken: undefined,
        resourceId: undefined,
        watchExpires: undefined,
        lastError: null,
      });
      audit(
        s,
        actor.id,
        "Povezan Google nalog za čitanje tabele",
        actor.id,
        null,
        { email: profile.email, connectedAt },
      );
    });
    destination.searchParams.set("google", "connected");
  } catch (e) {
    destination.searchParams.set("google", "error");
    destination.searchParams.set(
      "message",
      e instanceof DomainError
        ? e.message
        : "Povezivanje nije uspelo. Pokušajte ponovo.",
    );
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
