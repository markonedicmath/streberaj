export const START = 360,
  END = 1380,
  SLOTS = (END - START) / 15;
export const defaultRows = () => Array.from({ length: SLOTS }, () => 16);
export function normalizeRows(value: unknown) {
  return Array.isArray(value) && value.length === SLOTS
    ? value.map((v) =>
        typeof v === "number" ? Math.max(16, Math.min(80, v)) : 16,
      )
    : defaultRows();
}
export function position(minutes: number, rows: number[]) {
  const offset = Math.max(0, Math.min(END - START, minutes - START)),
    index = Math.floor(offset / 15);
  return (
    rows.slice(0, index).reduce((a, b) => a + b, 0) +
    ((rows[index] ?? 0) * (offset % 15)) / 15
  );
}
export function minuteAt(pixels: number, rows: number[]) {
  let remainder = Math.max(0, pixels);
  for (let i = 0; i < rows.length; i++) {
    if (remainder <= rows[i])
      return START + i * 15 + (remainder / rows[i]) * 15;
    remainder -= rows[i];
  }
  return END;
}
