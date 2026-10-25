import type { Lesson, SchoolState } from "./types";
import { belgradeMinute, lessonHasEnded } from "./time";
export const lessonUnits = (lesson: Lesson) => lesson.units ?? 1;
export const lessonOrder = (lesson: Lesson) =>
  `${lesson.date}T${String(Math.floor(lesson.start / 60)).padStart(2, "0")}:${String(lesson.start % 60).padStart(2, "0")}:${lesson.id}`;
export function lessonCounterDetails(s: SchoolState, completedOnly = false) {
  const result: Record<string, { numbers: number[]; size: number }> = {};
  const current: Record<string, number> = {};
  const currentSizes: Record<string, number> = {};
  const through = belgradeMinute();
  for (const student of s.students) {
    const events = s.counters
      .filter((e) => e.studentId === student.id && e.type !== "completed")
      .map((e) => {
        const parts = belgradeMinute(new Date(e.at));
        return {
          key: parts.replace(" ", "T"),
          type: e.type,
          value: e.value,
          size: e.size,
          lesson: null as Lesson | null,
        };
      });
    const timeline = [
      ...s.lessons
        .filter(
          (l) =>
            l.studentId === student.id &&
            l.status !== "cancelled" &&
            !l.deletedAt &&
            (!completedOnly || lessonHasEnded(l, through)),
        )
        .map((l) => ({
          key: lessonOrder(l),
          type: "lesson",
          value: undefined,
          size: undefined,
          lesson: l,
        })),
      ...events,
    ].sort(
      (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || (a.type === "lesson" ? 1 : -1),
    );
    let cycle = 0,
      size = student.packageSize ?? 4;
    for (const item of timeline) {
      if (item.type === "reset") cycle = 0;
      else if (item.type === "set") {
        size = item.size ?? size;
        cycle = Math.min(size, item.value ?? 0);
      } else if (item.type === "increment") cycle = Math.min(size, cycle + 1);
      else if (item.lesson) {
        const lesson = item.lesson,
          anchor = lesson.counterOverride ?? lesson.sourceCounter;
        if (lesson.counterOverride?.follow) {
          size = lesson.counterOverride.size;
          result[lesson.id] = {
            numbers: Array.from(
              { length: lessonUnits(lesson) },
              () => (cycle = Math.min(size, cycle + 1)),
            ),
            size,
          };
        } else if (anchor) {
          const numbers = Array.from(
            { length: lessonUnits(lesson) },
            (_, i) =>
              anchor.numbers[i] ?? Math.min(anchor.size, anchor.numbers[0] + i),
          );
          result[lesson.id] = { numbers, size: anchor.size };
          if (!lesson.counterOverride || lesson.counterOverride.propagate) {
            size = anchor.size;
            cycle = numbers[numbers.length - 1];
          } else if (lesson.counterOverride?.baseline) {
            size = lesson.counterOverride.baseline.size;
            cycle =
              lesson.counterOverride.baseline.numbers[
                lesson.counterOverride.baseline.numbers.length - 1
              ];
          } else if (lesson.sourceCounter) {
            size = lesson.sourceCounter.size;
            cycle =
              lesson.sourceCounter.numbers[
                lesson.sourceCounter.numbers.length - 1
              ];
          } else cycle = Math.min(size, cycle + lessonUnits(lesson));
        } else
          result[lesson.id] = {
            numbers: Array.from(
              { length: lessonUnits(lesson) },
              () => (cycle = Math.min(size, cycle + 1)),
            ),
            size,
          };
      }
    }
    current[student.id] = cycle;
    currentSizes[student.id] = size;
  }
  return { lessons: result, current, currentSizes };
}
export function lessonOrdinals(s: SchoolState) {
  return Object.fromEntries(
    Object.entries(lessonCounterDetails(s).lessons).map(([id, c]) => [
      id,
      c.numbers,
    ]),
  );
}
