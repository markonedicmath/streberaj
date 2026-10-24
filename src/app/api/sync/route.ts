import { authenticate, sameOrigin } from "@/lib/auth";
import { synchronize, secretEqual } from "@/lib/google";
import { DomainError } from "@/lib/domain";
import { failure, json } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const bearer =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
    if (!secretEqual(bearer, process.env.CRON_SECRET)) {
      sameOrigin(request);
      const actor = await authenticate(request);
      if (actor.role !== "admin")
        throw new DomainError("Samo Manojlo može da osveži izvor.", 403);
    }
    return json(
      await synchronize({
        onlyIfDue: new URL(request.url).searchParams.get("automatic") === "1",
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
