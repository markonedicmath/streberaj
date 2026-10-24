import { authClient, sameOrigin } from "@/lib/auth";
import { json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await (await authClient()).auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
