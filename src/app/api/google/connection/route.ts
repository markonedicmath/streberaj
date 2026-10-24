import { authenticate, sameOrigin } from "@/lib/auth";
import { DomainError, audit } from "@/lib/domain";
import { readState, transact } from "@/lib/store";
import { googleStatus, callbackUrl } from "@/lib/google-oauth";
import { failure, json } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const state = await readState(),
      actor = await authenticate(request, state);
    if (actor.role !== "admin")
      throw new DomainError("Nedozvoljen pristup.", 403);
    return json({ ...googleStatus(state), redirectUri: callbackUrl(request) });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const actor = await authenticate(request);
    await transact((s) => {
      if (
        !s.employees.some(
          (e) => e.id === actor.id && e.active && e.role === "admin",
        )
      )
        throw new DomainError("Nedozvoljen pristup.", 403);
      delete s.googleConnection;
      Object.assign(s.sync, {
        watchId: undefined,
        watchToken: undefined,
        resourceId: undefined,
        watchExpires: undefined,
      });
      audit(
        s,
        actor.id,
        "Isključen Google nalog za uvoz",
        actor.id,
        null,
        null,
      );
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
