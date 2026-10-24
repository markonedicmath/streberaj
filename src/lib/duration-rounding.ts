import { lessonQuote, TARIFFS } from "./pricing";
import type { SchoolState } from "./types";

export function importedDuration(duration: number, units = 1, enabled = true) {
  if (!enabled) return duration;
  const perClass = duration / units;
  const option = [...TARIFFS]
    .reverse()
    .find((tariff) => tariff.duration <= perClass);
  return option ? option.duration * units : duration;
}

export function applyDurationRounding(
  state: SchoolState,
  enabled: boolean,
  actorId: string,
) {
  const now = new Date().toISOString();
  let count = 0;
  for (const lesson of state.lessons) {
    if (!lesson.sourceId || lesson.deletedAt || lesson.status === "cancelled")
      continue;
    const before = structuredClone(lesson);
    const original =
      lesson.importedDuration &&
      lesson.duration === lesson.importedDuration.rounded
        ? lesson.importedDuration.original
        : lesson.duration;
    const duration = importedDuration(original, lesson.units ?? 1, enabled);
    if (duration === lesson.duration && !lesson.importedDuration) continue;
    lesson.importedDuration =
      duration !== original ? { original, rounded: duration } : undefined;
    if (duration === lesson.duration) continue;
    lesson.duration = duration;
    const student = state.students.find((item) => item.id === lesson.studentId);
    const teacher = state.employees.find(
      (item) => item.id === lesson.teacherId,
    );
    if (student) {
      const quote = lessonQuote(state.rules, lesson, student, teacher);
      if (!lesson.priceManual) {
        lesson.price = quote.price;
        lesson.ruleId = quote.ruleId;
      }
      if (lesson.bossBps === null && !lesson.bossManual)
        lesson.bossBps = quote.bossBps;
    }
    lesson.updatedAt = now;
    state.audits.push({
      id: crypto.randomUUID(),
      actorId,
      at: now,
      action: enabled
        ? "Zaokruženo trajanje uvezenog časa"
        : "Vraćeno izvorno trajanje časa",
      entityId: lesson.id,
      before,
      after: structuredClone(lesson),
    });
    count++;
  }
  return count;
}

export function initializeDurationRounding(state: SchoolState) {
  if (typeof state.sync.roundDurations === "boolean") return false;
  state.sync.roundDurations = true;
  applyDurationRounding(state, true, "system");
  return true;
}
