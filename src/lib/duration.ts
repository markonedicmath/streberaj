export function parseDuration(text: string) {
  const match = text.trim().match(/^(\d+)\s*(?:[xх×*]\s*(\d+))?$/i);
  if (!match) return null;
  const units = match[2] ? Number(match[1]) : 1;
  const minutes = Number(match[2] ?? match[1]);
  const duration = units * minutes;
  return units >= 1 && units <= 20 && minutes >= 1 && duration <= 1020
    ? { duration, units }
    : null;
}
export function durationText(duration: number, units = 1) {
  return units > 1 ? `${units} × ${duration / units}` : String(duration);
}
