import { authClient, sameOrigin } from "@/lib/auth";
import { json, failure } from "@/lib/http";
import { directGoogleAuth, endGoogleSession } from "@/lib/google-login";
import { clearOverrideSession } from "@/lib/override-login";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await clearOverrideSession();
    if (directGoogleAuth()) { await endGoogleSession(); return json({ok:true}); }
    await (await authClient()).auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
