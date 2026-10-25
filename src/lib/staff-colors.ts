import type { Employee } from "./types";
// Fixed palette: school spreadsheet colors plus IBM Carbon colors.
// Text pairs are verified with the WCAG relative-luminance formula.
export const STAFF_COLORS = [
  { name: "Plava", background: "#3563c1", text: "#ffffff" },
  { name: "Zelena", background: "#198038", text: "#ffffff" },
  { name: "Narandžasta", background: "#a23e00", text: "#ffffff" },
  { name: "Tamnoroze", background: "#9f1853", text: "#ffffff" },
  { name: "Crvena", background: "#ff0000", text: "#000000" },
  { name: "Ljubičasta", background: "#960df2", text: "#ffffff" },
  { name: "Azurna", background: "#0072c3", text: "#ffffff" },
  { name: "Tirkizna", background: "#007d79", text: "#ffffff" },
  { name: "Žuta", background: "#ffd966", text: "#000000" },
  { name: "Svetlonarandžasta", background: "#ff9900", text: "#000000" },
  { name: "Jarkozelena", background: "#34a853", text: "#000000" },
  { name: "Svetlotirkizna", background: "#08bdba", text: "#000000" },
  { name: "Svetloplava", background: "#78a9ff", text: "#000000" },
  { name: "Lila", background: "#be95ff", text: "#000000" },
  { name: "Roze", background: "#ea9999", text: "#000000" },
  { name: "Ledena plava", background: "#82cfff", text: "#000000" },
  { name: "Bordo", background: "#a2191f", text: "#ffffff" },
  { name: "Tamnoljubičasta", background: "#31135e", text: "#ffffff" },
  { name: "Grafitna", background: "#4d5358", text: "#ffffff" },
  { name: "Braon", background: "#654522", text: "#ffffff" },
] as const;
export function luminance(color: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) =>
      v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function textForColor(color: string) {
  return (
    STAFF_COLORS.find((c) => c.background === color.toLowerCase())?.text ??
    (contrast(color, "#ffffff") >= contrast(color, "#000000")
      ? "#ffffff"
      : "#000000")
  );
}
export const isStaffColor = (color: string) =>
  STAFF_COLORS.some((c) => c.background === color.toLowerCase());

export function isMarkoNedic(employee?: { name?: string; email?: string } | null): boolean {
  if (!employee) return false;
  const name = (employee.name || "").toLowerCase().trim();
  const email = (employee.email || "").toLowerCase().trim();
  return (
    name === "marko nedić" ||
    name === "marko nedic" ||
    email.includes("mnedictxt") ||
    email.startsWith("marko.nedic")
  );
}

export function normalizeStaffColors(employees: Employee[]) {
  const legacy: Record<string, string> = {
    "#0043ce": "#3563c1",
    "#9900ff": "#960df2",
    "#da1e28": "#ff0000",
    "#6929c4": "#960df2",
    "#f1c21b": "#ffd966",
    "#ff832b": "#ff9900",
    "#42be65": "#34a853",
    "#ff7eb6": "#ea9999",
    "#2563eb": "#3563c1",
    "#008049": "#198038",
    "#bd5b00": "#a23e00",
    "#be247a": "#9f1853",
    "#526f8a": "#3563c1",
    "#735ca7": "#960df2",
  };
  const used = new Set(
    employees
      .filter((e) => isStaffColor(e.color))
      .map((e) => e.color.toLowerCase()),
  );
  let changed = false;
  for (const employee of employees) {
    if (
      isStaffColor(employee.color) &&
      !employees.some(
        (e) =>
          e !== employee &&
          e.color === employee.color &&
          employees.indexOf(e) < employees.indexOf(employee),
      )
    )
      continue;
    const preferred = legacy[employee.color.toLowerCase()],
      next =
        STAFF_COLORS.find(
          (c) => c.background === preferred && !used.has(c.background),
        ) ?? STAFF_COLORS.find((c) => !used.has(c.background));
    if (!next)
      throw new Error(
        "Paleta podržava najviše 20 jedinstvenih boja zaposlenih.",
      );
    employee.color = next.background;
    used.add(next.background);
    changed = true;
  }
  return changed;
}
