import type { Employee, Lesson, RateRule, SchoolState, Student } from "./types";

export function isManojlo(teacher?: Pick<Employee, "id" | "name">) {
  return (
    teacher?.id === "admin" || /^manojlo(?:\s|$)/i.test(teacher?.name ?? "")
  );
}

export const TARIFFS = [
  { duration: 45, price: 100000 },
  { duration: 60, price: 150000 },
  { duration: 90, price: 200000 },
  { duration: 120, price: 250000 },
] as const;
export const allowedDuration = (duration: number) =>
  TARIFFS.some((r) => r.duration === duration);
export function universityStudent(
  student: Pick<Student, "level" | "university">,
) {
  return (
    student.university ??
    /(?:fakultet|student|studij|univerzitet|master|doktor|\b(?:etf|fon|pmf|ftn|matf|raf)\b)/i.test(
      student.level,
    )
  );
}
type Booking = Pick<
  Lesson,
  "teacherId" | "mode" | "duration" | "university" | "referral"
>;
export function matchingRule(
  rules: RateRule[],
  lesson: Booking,
  student: Student,
) {
  return [...rules]
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .find(
      (r) =>
        r.active &&
        (!r.teacherId || r.teacherId === lesson.teacherId) &&
        (!r.duration || r.duration === lesson.duration) &&
        (!r.mode || r.mode === lesson.mode) &&
        (!r.level ||
          (universityStudent({ level: r.level })
            ? universityStudent(student)
            : r.level === student.level)) &&
        (!r.channel || r.channel === student.channel),
    );
}
export function lessonQuote(
  rules: RateRule[],
  lesson: Booking,
  student: Student,
  teacher?: Pick<Employee, "id" | "name">,
) {
  student = {
    ...student,
    university: lesson.university ?? student.university,
    channel:
      lesson.referral === undefined
        ? student.channel
        : lesson.referral
          ? "referral"
          : student.channel === "referral"
            ? "direct"
            : student.channel,
  };
  const rule = matchingRule(rules, lesson, student);
  const bonuses = [
    lesson.mode === "online" ? "Online" : "",
    universityStudent(student) ? "Fakultet" : "",
    student.channel === "referral" ? "Preporuka" : "",
  ].filter(Boolean);
  const bossBps = isManojlo(teacher ?? { id: lesson.teacherId, name: "" })
    ? 10000
    : (rule?.bossBps ?? 4000 - bonuses.length * 1000);
  return {
    price:
      rule?.price ??
      TARIFFS.find((r) => r.duration === lesson.duration)?.price ??
      null,
    bossBps,
    teacherBps: 10000 - bossBps,
    ruleId: rule?.id ?? null,
    bonuses,
  };
}
export function snapDuration(requested: number, available: number) {
  const options = TARIFFS.filter((r) => r.duration <= available);
  return options.reduce<number | undefined>(
    (best, r) =>
      best === undefined ||
      Math.abs(r.duration - requested) <= Math.abs(best - requested)
        ? r.duration
        : best,
    undefined,
  );
}
export function stepDuration(
  current: number,
  direction: number,
  available: number,
) {
  const options = TARIFFS.map((r) => r.duration).filter((d) => d <= available);
  return direction > 0
    ? (options.find((d) => d > current) ?? current)
    : ([...options].reverse().find((d) => d < current) ?? current);
}
export function activatePricing(s: SchoolState) {
  if ((s.pricingVersion ?? 0) >= 2) return false;
  const now = new Date().toISOString();
  for (const lesson of s.lessons) {
    if (lesson.deletedAt || lesson.status === "cancelled") continue;
    const student = s.students.find((st) => st.id === lesson.studentId);
    if (!student) continue;
    const teacher = s.employees.find((e) => e.id === lesson.teacherId);
    const quote = lessonQuote(s.rules, lesson, student, teacher);
    const before = { price: lesson.price, bossBps: lesson.bossBps };
    if (lesson.price === null && !lesson.priceManual)
      lesson.price = quote.price;
    if (lesson.bossBps === null && !lesson.bossManual)
      lesson.bossBps = quote.bossBps;
    if (isManojlo(teacher)) {
      lesson.bossBps = 10000;
      lesson.bossManual = false;
    }
    if (before.price !== lesson.price || before.bossBps !== lesson.bossBps) {
      lesson.updatedAt = now;
      s.audits.push({
        id: crypto.randomUUID(),
        actorId: "system",
        entityId: lesson.id,
        at: now,
        action: "Primenjen osnovni cenovnik i procenat",
        before,
        after: { price: lesson.price, bossBps: lesson.bossBps },
      });
    }
  }
  s.pricingVersion = 2;
  return true;
}
