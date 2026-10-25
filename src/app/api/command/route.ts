import { createHash } from "node:crypto";
import { z } from "zod";
import { transact, isDemo } from "@/lib/store";
import { authenticate, sameOrigin } from "@/lib/auth";
import { execute, project, DomainError, rememberUndo, snapshotForUndo } from "@/lib/domain";
import { boundedBody } from "@/lib/files";
import { json, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 250_000)
      throw new DomainError("Zahtev je prevelik.");
    const command = JSON.parse(
        (await boundedBody(request, 250000)).toString("utf8"),
      ),
      key = z.uuid().parse(request.headers.get("idempotency-key")),
      hash = createHash("sha256").update(JSON.stringify(command)).digest("hex"),
      actor = await authenticate(request);
    const { state, result } = await transact((s) => {
      const current = s.employees.find((e) => e.id === actor.id && e.active);
      if (!current) throw new DomainError("Nalog je isključen.", 403);
      const old = s.operations?.find(
        (o) => o.key === key && o.actorId === actor.id,
      );
      if (old) {
        if (old.hash !== hash)
          throw new DomainError("Ključ zahteva već je upotrebljen.", 409);
        return {};
      }
      const before = snapshotForUndo(s),
        result = execute(s, current, command);
      rememberUndo(s, before, current, command.type);
      s.operations = [
        ...(s.operations ?? []),
        { key, actorId: actor.id, hash },
      ];
      return result;
    });
    return json({
      view: project(
        state,
        state.employees.find((e) => e.id === actor.id)!,
        isDemo(),
      ),
      ...result,
    });
  } catch (e) {
    return failure(e);
  }
}
