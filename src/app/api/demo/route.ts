import { cookies } from "next/headers";
import { isDemo, readState } from "@/lib/store";
import { localRequest, sameOrigin } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!isDemo() || !localRequest(request))
      throw new DomainError("Nije dostupno.", 404);
    const { actorId } = await request.json(),
      state = await readState();
    if (!state.employees.some((e) => e.id === actorId && e.active))
      throw new DomainError("Nalog nije pronađen.", 404);
    (await cookies()).set("demo-actor", actorId, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86400,
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
