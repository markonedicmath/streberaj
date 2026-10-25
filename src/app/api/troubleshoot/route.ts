import { sameOrigin } from "@/lib/auth";
import { setOverrideSession, clearOverrideSession } from "@/lib/override-login";
import { boundedBody } from "@/lib/files";
import { readState } from "@/lib/store";
import { DomainError } from "@/lib/domain";
import { json, failure } from "@/lib/http";

export const runtime = "nodejs";

const PASS = "bojanbasic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "").trim().toLowerCase();
    if (code !== PASS) {
      throw new DomainError("Neispravna lozinka za proveru.", 401);
    }
    const state = await readState();
    const workers = state.employees
      .filter((e) => e.active)
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        color: e.color,
      }));
    return json({ ok: true, workers });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = JSON.parse((await boundedBody(request,4096)).toString("utf8")) as {
      code?: string;
      actorId?: string;
    };
    const code = (body.code || "").trim().toLowerCase();
    if (code !== PASS) {
      throw new DomainError("Neispravna lozinka za proveru.", 401);
    }
    const state = await readState();
    const employee = state.employees.find(
      (e) => e.id === body.actorId && e.active,
    );
    if (!employee) {
      throw new DomainError("Nalog zaposlenog nije pronađen.", 404);
    }

    await setOverrideSession(employee.id, request);

    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await clearOverrideSession();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
