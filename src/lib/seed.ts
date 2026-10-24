import { addDays, weekStart, lessonHasEnded } from "./time";
import type { SchoolState, SchoolView } from "./types";
import { applySchoolDefaults } from "./school-defaults";
export function emptyState(): SchoolState {
  return {
    revision: 0,
    employees: [],
    students: [],
    lessons: [],
    rules: [],
    payments: [],
    handovers: [],
    attachments: [],
    counters: [],
    audits: [],
    sourceBlocks: [],
    sync: {
      spreadsheetId: "",
      firstYear: new Date().getUTCFullYear(),
      colorMap: {},
      studentMap: {},
      lastSuccess: null,
      lastError: null,
    },
  };
}
export function demoState(): SchoolState {
  const s = emptyState(),
    week = weekStart(),
    now = new Date().toISOString();
  s.employees = [
    {
      id: "admin",
      name: "Manojlo",
      email: "manojlo@primer.rs",
      role: "admin",
      color: "#0043ce",
      canSetPrice: true,
      canScheduleOthers: true,
      active: true,
    },
    {
      id: "ana",
      name: "Ana Petrović",
      email: "ana@primer.rs",
      role: "teacher",
      color: "#198038",
      canSetPrice: true,
      canScheduleOthers: true,
      active: true,
    },
    {
      id: "marko",
      name: "Marko Jovanović",
      email: "marko@primer.rs",
      role: "teacher",
      color: "#a23e00",
      canSetPrice: true,
      canScheduleOthers: true,
      active: true,
    },
    {
      id: "jelena",
      name: "Jelena Nikolić",
      email: "jelena@primer.rs",
      role: "teacher",
      color: "#9f1853",
      canSetPrice: true,
      canScheduleOthers: true,
      active: true,
    },
  ];
  s.students = [
    {
      id: "s1",
      name: "Mila Simić",
      level: "7. razred",
      subject: "Matematika",
      channel: "direct",
      ownerIds: ["ana"],
    },
    {
      id: "s2",
      name: "Luka Ilić",
      level: "Student",
      subject: "Matematika",
      channel: "referral",
      ownerIds: ["marko"],
    },
    {
      id: "s3",
      name: "Sara Marković",
      level: "2. srednje",
      subject: "Fizika",
      channel: "direct",
      ownerIds: ["jelena"],
    },
    {
      id: "s4",
      name: "Petar Pavlović",
      level: "8. razred",
      subject: "Matematika",
      channel: "other",
      ownerIds: ["admin"],
    },
    {
      id: "s5",
      name: "Nina Jović",
      level: "6. razred",
      subject: "Matematika",
      channel: "referral",
      ownerIds: ["ana"],
    },
  ];
  const slots: [
    string,
    string,
    string,
    number,
    number,
    1 | 2,
    "in_person" | "online",
  ][] = [
    ["l1", "s1", "ana", 0, 9 * 60, 1, "in_person"],
    ["l2", "s2", "marko", 0, 10 * 60 + 30, 1, "in_person"],
    ["l3", "s3", "jelena", 0, 15 * 60, 1, "in_person"],
    ["l4", "s4", "admin", 1, 9 * 60 + 30, 1, "in_person"],
    ["l5", "s1", "ana", 1, 16 * 60, 1, "in_person"],
    ["l6", "s2", "marko", 1, 16 * 60, 2, "in_person"],
    ["l7", "s5", "ana", 2, 10 * 60, 1, "in_person"],
    ["l8", "s3", "jelena", 2, 14 * 60 + 30, 1, "in_person"],
    ["l9", "s4", "admin", 3, 11 * 60, 1, "in_person"],
    ["l10", "s1", "ana", 3, 15 * 60, 1, "in_person"],
    ["l11", "s2", "marko", 4, 10 * 60, 1, "in_person"],
    ["l12", "s3", "jelena", 4, 16 * 60, 1, "in_person"],
    ["l13", "s5", "ana", 5, 10 * 60, 1, "in_person"],
    ["l14", "s4", "admin", 2, 18 * 60, 1, "online"],
  ];
  s.lessons = slots.map(
    ([id, studentId, teacherId, day, start, desk, mode], i) => ({
      id,
      studentId,
      teacherId,
      date: addDays(week, day),
      start,
      duration: i % 3 === 0 ? 90 : 60,
      desk: mode === "online" ? null : desk,
      mode,
      topic: [
        "Linearne jednačine",
        "Priprema za kontrolni",
        "Vežbanje zadataka",
      ][i % 3],
      status: i < 3 ? "completed" : "scheduled",
      price: i % 3 === 0 ? 240000 : 180000,
      bossBps: 3000,
      ruleId: null,
      shared: mode !== "online",
      createdAt: now,
      updatedAt: now,
    }),
  );
  s.counters = s.lessons
    .filter((l) => l.status === "completed")
    .map((l) => ({
      id: "c" + l.id,
      studentId: l.studentId,
      type: "completed",
      lessonId: l.id,
      actorId: l.teacherId,
      at: now,
    }));
  s.payments = [
    {
      id: "p1",
      lessonId: "l1",
      amount: 240000,
      date: addDays(week, 0),
      note: "Gotovina",
      actorId: "ana",
    },
  ];
  s.rules = [
    {
      id: "r1",
      name: "Primer · 60 minuta",
      priority: 10,
      active: true,
      teacherId: null,
      duration: 60,
      mode: null,
      level: null,
      channel: null,
      price: 180000,
      bossBps: 3000,
    },
    {
      id: "r2",
      name: "Primer · 90 minuta",
      priority: 20,
      active: true,
      teacherId: null,
      duration: 90,
      mode: null,
      level: null,
      channel: null,
      price: 240000,
      bossBps: 3000,
    },
  ];
  applySchoolDefaults(s);
  return s;
}
export function localState(): SchoolState {
  const s = emptyState();
  s.employees.push({
    id: "admin",
    name: "Manojlo",
    email: "",
    role: "admin",
    color: "#007d79",
    canSetPrice: true,
    canScheduleOthers: true,
    active: true,
  });
  applySchoolDefaults(s);
  s.sampleDataCleanupVersion = 2;
  return s;
}
export function previewView(): SchoolView {
  const s = demoState();
  return {
    ...s,
    messages: s.messages ?? [],
    actor: s.employees[0],
    students: s.students.map((st) => ({
      ...st,
      total: s.lessons.filter((l) => l.studentId === st.id && lessonHasEnded(l))
        .length,
      cycle: s.lessons.filter((l) => l.studentId === st.id && lessonHasEnded(l))
        .length,
    })),
    demo: true,
  };
}
