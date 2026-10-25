import { context } from "./context";
import { googleSession } from "../src/lib/google-login";
import { readState } from "./store";
import { DomainError } from "../src/lib/domain";
import type { SchoolState } from "../src/lib/types";
export const localRequest = () => false;
export async function authClient(): Promise<any> { throw new DomainError("Prijavite se Google nalogom.",401); }
export async function authenticate(_request: Request, state?: SchoolState) {
  const current = context();
  const session = current.session ??= await googleSession();
  const school = state ?? await readState();
  const actor = school.employees.find(e=>e.id===session.actorId && e.active && e.email.toLowerCase()===session.email);
  if (!actor) throw new DomainError("Vaš nalog nije na listi odobrenih zaposlenih.",403);
  return actor;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(context().env.APP_URL).origin)
    throw new DomainError("Zahtev nije poslat iz aplikacije.",403);
}
