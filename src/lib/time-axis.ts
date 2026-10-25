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
  const offset = Math.max(0, minutes - START),
    index = Math.floor(offset / 15),
    defaultHeight = rows[rows.length - 1] ?? 16;
  if (index >= rows.length) {
    const sum = rows.reduce((a, b) => a + b, 0);
    return (
      sum +
      (index - rows.length) * defaultHeight +
      ((defaultHeight * (offset % 15)) / 15)
    );
  }
  return (
    rows.slice(0, index).reduce((a, b) => a + b, 0) +
    (((rows[index] ?? defaultHeight) * (offset % 15)) / 15)
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
