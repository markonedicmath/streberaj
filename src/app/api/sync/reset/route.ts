import { z } from "zod";
import { authenticate, sameOrigin } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { synchronize } from "@/lib/google";
import { boundedBody } from "@/lib/files";
import { failure, json } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await authenticate(request);
    if (actor.role !== "admin")
      throw new DomainError("Samo Manojlo može da zameni raspored.", 403);
    const { revision } = z
      .object({ revision: z.number().int().nonnegative() })
      .parse(JSON.parse((await boundedBody(request, 4096)).toString("utf8")));
    return json(
      await synchronize({ resetBoard: { actorId: actor.id, revision } }),
    );
  } catch (error) {
    return failure(error);
  }
}
