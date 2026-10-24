import { readState, isDemo } from "@/lib/store";
import { authenticate } from "@/lib/auth";
import { project } from "@/lib/domain";
import { json, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const state = await readState(),
      actor = await authenticate(request, state);
    return json(project(state, actor, isDemo()));
  } catch (e) {
    return failure(e);
  }
}
