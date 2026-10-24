import type { Lesson } from "./types";
export const ZONE = "Europe/Belgrade";
export function belgradeMinute(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .replace(" ", "T");
}
export function lessonHasEnded(lesson: Lesson, through = belgradeMinute()) {
  return (
    !lesson.deletedAt &&
    lesson.status !== "cancelled" &&
    `${lesson.date}T${clock(lesson.start + lesson.duration)}` <= through
  );
}
export function belgradeToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(date = belgradeToday()) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}
export function clock(minutes: number) {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function dateLabel(date: string, year = false) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function money(amount: number | null) {
  return amount === null
    ? "Nije određeno"
    : new Intl.NumberFormat("sr-Latn-RS", {
        style: "currency",
        currency: "RSD",
        maximumFractionDigits: 2,
      }).format(amount / 100);
}
