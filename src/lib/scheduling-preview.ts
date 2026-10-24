import type { Lesson, BusyLesson, LessonPreview } from "./types";
export function resolveDesk(
  lessons: (Lesson | BusyLesson)[],
  draft: LessonPreview,
) {
  if (draft.mode === "online" || draft.desk === null) return null;
  const conflicts = previewConflicts(lessons, draft);
  if (!conflicts.length || conflicts.some((c) => c.reason !== "Sto je zauzet"))
    return draft.desk;
  const other = draft.desk === 1 ? 2 : 1;
  return previewConflicts(lessons, { ...draft, desk: other }).length
    ? draft.desk
    : other;
}
export function previewConflicts(
  lessons: (Lesson | BusyLesson)[],
  draft: LessonPreview,
) {
  return lessons
    .filter(
      (l) =>
        l.id !== draft.id &&
        (!("status" in l) || l.status !== "cancelled") &&
        (!("deletedAt" in l) || !l.deletedAt) &&
        l.date === draft.date &&
        l.start < draft.start + draft.duration &&
        l.start + l.duration > draft.start,
    )
    .flatMap((lesson) => {
      const reason =
        lesson.teacherId === draft.teacherId
          ? "Predavač ima drugi čas"
          : draft.studentId &&
              "studentId" in lesson &&
              lesson.studentId === draft.studentId
            ? "Učenik ima drugi čas"
            : draft.mode === "in_person" &&
                lesson.mode === "in_person" &&
                lesson.desk === draft.desk
              ? "Sto je zauzet"
              : null;
      return reason ? [{ lesson, reason }] : [];
    });
}
