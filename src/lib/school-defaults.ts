import type { SchoolState } from "./types";

// Names and exact colors from the school's existing spreadsheet legend.
export const DEFAULT_TEACHERS = [
  {
    id: "admin",
    name: "Manojlo Stanarević",
    color: "#007d79",
    sourceColor: "#9900ff",
  },
  { id: "tijana-strbac", name: "Tijana Štrbac", color: "#ffd966" },
  { id: "jelisaveta-letic", name: "Jelisaveta Letić", color: "#34a853" },
  { id: "tijana", name: "Tijana", color: "#ff0000" },
  { id: "zoja", name: "Zoja", color: "#ea9999" },
  { id: "milica-lapov", name: "Milica Lapov", color: "#ff9900" },
  { id: "nikodin", name: "Nikodin", color: "#3563c1", sourceColor: "#0000ff" },
] as const;

export function applySchoolDefaults(s: SchoolState) {
  const version = s.defaultsVersion ?? 0;
  if (version >= 3) return false;
  if (version === 2) {
    const manojlo = s.employees.find(
      (e) =>
        e.id === s.sync.colorMap["#9900ff"] || e.name === "Manojlo Stanarević",
    );
    if (manojlo) manojlo.color = "#007d79";
    s.defaultsVersion = 3;
    return true;
  }
  for (const item of DEFAULT_TEACHERS) {
    if (version >= 1 && item.id !== "nikodin") {
      if (item.id === "admin") {
        const manojlo = s.employees.find((e) => e.name === item.name);
        if (manojlo) manojlo.color = item.color;
      }
      continue;
    }
    let employee = s.employees.find(
      (e) =>
        e.name.toLocaleLowerCase("sr-Latn") ===
        item.name.toLocaleLowerCase("sr-Latn"),
    );
    if (!employee && item.id === "admin")
      employee = s.employees.find(
        (e) => e.role === "admin" && e.name === "Manojlo",
      );
    if (!employee) {
      employee = {
        id: s.employees.some((e) => e.id === item.id)
          ? crypto.randomUUID()
          : item.id,
        name: item.name,
        email: "", // Scheduling profile; Google access requires a real approved email.
        role: "teacher",
        color: item.color,
        canSetPrice: true,
        canScheduleOthers: true,
        active: true,
      };
      s.employees.push(employee);
    }
    employee.name = item.name;
    employee.color = item.color;
    employee.active = true;
    s.sync.colorMap["sourceColor" in item ? item.sourceColor : item.color] =
      employee.id;
  }
  // Keep historical sample records and their lessons, but retire them from scheduling.
  for (const e of s.employees)
    if (
      ["ana@primer.rs", "marko@primer.rs", "jelena@primer.rs"].includes(e.email)
    )
      e.active = false;
  s.defaultsVersion = 3;
  return true;
}
