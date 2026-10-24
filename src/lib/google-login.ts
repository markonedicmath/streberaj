import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DomainError } from "./domain";
import { readState } from "./store";
import { oauthConfig, sealGoogle, openGoogle, GOOGLE_TIMEOUT } from "./google-oauth";

const SESSION = "streberaj-session", FLOW = "streberaj-login-flow";
const SESSION_SECONDS = 7 * 24 * 3600;
export const directGoogleAuth = () => process.env.MANOJLO_AUTH === "google";
function origin(request: Request) {
  const base = new URL(process.env.APP_URL ?? request.url);
  if (base.protocol !== "https:" && !["localhost","127.0.0.1"].includes(base.hostname)) throw new DomainError("Prijava zahteva HTTPS adresu.",503);
  return base.origin;
}
function redirect(url: string) {
  return new Response(null,{status:303,headers:{Location:url,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}
export async function startGoogleLogin(request: Request) {
  const config = oauthConfig(), state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const redirectUri = origin(request) + "/auth/callback";
  (await cookies()).set(FLOW, await sealGoogle(JSON.stringify({kind:"login-flow", state, verifier, redirectUri, at:Date.now()})),{httpOnly:true,secure:redirectUri.startsWith("https:"),sameSite:"lax",path:"/auth",maxAge:600});
  const query = new URLSearchParams({client_id:config.clientId,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",prompt:"select_account",state,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"});
  return redirect("https://accounts.google.com/o/oauth2/v2/auth?"+query);
}
export async function finishGoogleLogin(request: Request) {
  const jar = await cookies(), destination = new URL("/",origin(request));
  const sealed = jar.get(FLOW)?.value;
  jar.set(FLOW,"",{path:"/auth",maxAge:0,httpOnly:true,secure:destination.protocol==="https:",sameSite:"lax"});
  try {
    if (!sealed) throw new DomainError("Prijava je istekla. Pokušajte ponovo.",401);
    const flow = JSON.parse(await openGoogle(sealed));
    const url = new URL(request.url), state = url.searchParams.get("state") ?? "";
    const left = Buffer.from(String(flow.state ?? "")), right = Buffer.from(state);
    if (flow.kind !== "login-flow" || left.length !== right.length || !timingSafeEqual(left,right) || !Number.isFinite(flow.at) || Date.now()-flow.at > 600000 || flow.at > Date.now() || flow.redirectUri !== origin(request)+"/auth/callback") throw new DomainError("Prijava nije potvrđena. Pokušajte ponovo.",401);
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) throw new DomainError("Google prijava je otkazana.",401);
    const config = oauthConfig();
    const exchange = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,grant_type:"authorization_code",redirect_uri:flow.redirectUri,code_verifier:flow.verifier}),signal:AbortSignal.timeout(GOOGLE_TIMEOUT),cache:"no-store"});
    const token = await exchange.json();
    if (!exchange.ok || typeof token.access_token !== "string") throw new DomainError("Google prijava nije uspela.",401);
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+token.access_token},signal:AbortSignal.timeout(GOOGLE_TIMEOUT),cache:"no-store"});
    const profile = await response.json();
    if (!response.ok || profile.email_verified !== true || typeof profile.email !== "string" || typeof profile.sub !== "string") throw new DomainError("Google nalog nije potvrđen.",401);
    const stateData = await readState();
    const actor = stateData.employees.find((employee) => employee.active && employee.email.toLowerCase() === profile.email.toLowerCase());
    if (!actor) throw new DomainError("Vaš Google nalog nije na listi odobrenih zaposlenih. Manojlo treba da doda vašu imejl adresu.",403);
    const now = Date.now();
    jar.set(SESSION,await sealGoogle(JSON.stringify({kind:"session",actorId:actor.id,email:profile.email.toLowerCase(),sub:profile.sub,at:now,expires:now+SESSION_SECONDS*1000})),{httpOnly:true,secure:destination.protocol==="https:",sameSite:"lax",path:"/",maxAge:SESSION_SECONDS});
  } catch (error) {
    destination.searchParams.set("login","error");
    destination.searchParams.set("message",error instanceof DomainError ? error.message : "Prijava nije uspela. Pokušajte ponovo.");
  }
  return redirect(destination.toString());
}
export async function googleSession() {
  try {
    const sealed = (await cookies()).get(SESSION)?.value;
    if (!sealed) throw new Error();
    const value = JSON.parse(await openGoogle(sealed));
    if (value.kind !== "session" || typeof value.actorId !== "string" || typeof value.email !== "string" || typeof value.sub !== "string" || !Number.isFinite(value.at) || !Number.isFinite(value.expires) || value.expires <= Date.now() || value.at > Date.now()+60000 || value.expires-value.at > SESSION_SECONDS*1000) throw new Error();
    return {actorId:value.actorId as string,email:value.email as string};
  } catch { throw new DomainError("Prijavite se Google nalogom.",401); }
}
export async function endGoogleSession() {
  (await cookies()).set(SESSION,"",{httpOnly:true,secure:process.env.APP_URL?.startsWith("https://") ?? true,sameSite:"lax",path:"/",maxAge:0});
}
