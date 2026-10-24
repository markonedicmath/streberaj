import { audit, DomainError, id } from "./domain";
import { reconcileSources } from "./sheets";
import type { SchoolState, SourceBlock } from "./types";

export function replaceBoardFromSheets(
  state: SchoolState,
  blocks: SourceBlock[],
  actorId: string,
) {
  if (
    !state.employees.some(
      (employee) =>
        employee.id === actorId && employee.role === "admin" && employee.active,
    )
  )
    throw new DomainError("Samo Manojlo može da zameni raspored.", 403);
  if (!blocks.length)
    throw new DomainError(
      "Izvorna tabela nema rezervacije. Postojeći podaci nisu obrisani.",
      409,
    );
  state.boardResetBackup = {
    id: id(),
    at: new Date().toISOString(),
    actorId,
    data: structuredClone({
      students: state.students,
      lessons: state.lessons,
      payments: state.payments,
      handovers: state.handovers,
      counters: state.counters,
      messages: state.messages,
      audits: state.audits,
      undoEntries: state.undoEntries,
      attachments: state.attachments,
      sourceBlocks: state.sourceBlocks,
      studentMap: state.sync.studentMap,
    }),
  };
  state.students = [];
  state.lessons = [];
  state.payments = [];
  state.handovers = [];
  state.counters = [];
  state.messages = [];
  state.audits = [];
  state.undoEntries = [];
  state.attachments = [];
  state.sourceBlocks = [];
  state.sync.studentMap = {};
  reconcileSources(state, blocks);
  audit(
    state,
    actorId,
    "Raspored očišćen i ponovo uvezen",
    actorId,
    { backupId: state.boardResetBackup.id },
    { classes: state.lessons.length, students: state.students.length },
  );
}
