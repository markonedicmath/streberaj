import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { authenticate, sameOrigin } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { readState } from "@/lib/store";
import { failure, json } from "@/lib/http";
import {
  callbackUrl,
  oauthConfig,
  OAUTH_COOKIE,
  sealGoogle,
  SHEETS_READ_SCOPE,
} from "@/lib/google-oauth";
export const runtime = "nodejs";
async function authorizationUrl(request: Request) {
  const state = await readState(),
    actor = await authenticate(request, state);
  if (actor.role !== "admin")
    throw new DomainError("Samo administrator može da poveže izvor.", 403);
  if (!state.sync.spreadsheetId)
    throw new DomainError("Najpre sačuvajte link Google tabele.");
  const config = oauthConfig(),
    nonce = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const redirectUri = callbackUrl(request);
  (await cookies()).set(
    OAUTH_COOKIE,
    await sealGoogle(
      JSON.stringify({
        nonce,
        verifier,
        actorId: actor.id,
        spreadsheetId: state.sync.spreadsheetId,
        clientId: config.clientId,
        redirectUri,
        at: Date.now(),
      }),
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: redirectUri.startsWith("https:"),
      maxAge: 600,
      path: "/api/google",
    },
  );
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email " + SHEETS_READ_SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    state: nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const account = new URL(request.url).searchParams.get("account");
  if (account && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account))
    query.set("login_hint", account);
  return "https://accounts.google.com/o/oauth2/v2/auth?" + query;
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return json({ url: await authorizationUrl(request) });
  } catch (e) {
    return failure(e);
  }
}
// Allows an administrator to start linking from a direct browser link as well.
// Cross-site links and subresource requests cannot initiate the flow.
export async function GET(request: Request) {
  try {
    if (
      !["none", "same-origin"].includes(
        request.headers.get("sec-fetch-site") ?? "",
      ) ||
      request.headers.get("sec-fetch-mode") !== "navigate"
    )
      throw new DomainError(
        "Povezivanje pokrenite direktno iz aplikacije.",
        403,
      );
    return new Response(null, {
      status: 303,
      headers: {
        Location: await authorizationUrl(request),
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
