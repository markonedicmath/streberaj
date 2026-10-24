import type { SchoolState } from "./types";

export function activateSharedFinance(state: SchoolState) {
  if ((state.financeConfirmationVersion ?? 0) >= 1) return false;
  const at = new Date().toISOString();
  for (const handover of state.handovers) {
    if (handover.voidedAt || handover.confirmed) continue;
    const before = structuredClone(handover);
    handover.confirmed = true;
    handover.confirmedBy = handover.actorId;
    state.audits.push({
      id: crypto.randomUUID(),
      actorId: "system",
      at,
      action: "Potvrđena predaja novca",
      entityId: handover.lessonId,
      before,
      after: structuredClone(handover),
    });
  }
  state.financeConfirmationVersion = 1;
  return true;
}
