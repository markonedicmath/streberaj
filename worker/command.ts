import { createHash } from "node:crypto";
import { context } from "./context";
import { readState, transact } from "./store";
import { authenticate, sameOrigin } from "./auth";
import { DomainError, execute, rememberUndo, snapshotForUndo } from "../src/lib/domain";
import { boundedBody } from "../src/lib/files";
import { json } from "../src/lib/http";

export async function commandResponse(request: Request) {
  sameOrigin(request);
  const command = JSON.parse((await boundedBody(request,250000)).toString("utf8"));
  if(!command || typeof command!=="object")throw new DomainError("Zahtev nije ispravan.");
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw new DomainError("Nedostaje ključ zahteva.");
  const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  if(command.type==="saveProfile")context().writeScope="profile";
  else if(["postMessage","editMessage","deleteMessage","likeMessage","pinMessage"].includes(command.type))context().writeScope="messages";
  const initial = await readState();
  const actor = await authenticate(request,initial);
  const saved = await transact(state => {
    const current = state.employees.find(employee => employee.id===actor.id && employee.active);
    if (!current) throw new DomainError("Nalog je isključen.",403);
    const previous = state.operations?.find(operation => operation.key===key && operation.actorId===actor.id);
    if (previous) {
      if (previous.hash!==hash) throw new DomainError("Ključ zahteva već je upotrebljen.",409);
      return {};
    }
    const before = snapshotForUndo(state);
    const result = execute(state,current,command);
    rememberUndo(state,before,current,command.type);
    state.operations=[...(state.operations??[]),{key,actorId:actor.id,hash}];
    return result;
  },initial);
  if(request.headers.get("x-view-mode")==="deferred")return json({revision:saved.state.revision,...saved.result});
  // Compatibility with already-open tabs; new clients fetch their own updated view.
  const {env}=context();
  const response = await env.WORKER_SELF_REFERENCE.fetch(new Request(new URL("/api/state",env.APP_URL),{
    headers:{Cookie:request.headers.get("cookie")??""},
  }));
  if (!response.ok) return response;
  return json({view:await response.json(),...saved.result});
}
