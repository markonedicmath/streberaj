import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_COLORS,
  contrast,
  normalizeStaffColors,
  textForColor,
} from "../src/lib/staff-colors";
import { demoState } from "../src/lib/seed";
import { execute, project } from "../src/lib/domain";
test("tačno 20 jedinstvenih parova pozadine i teksta ima najmanje WCAG 4.5:1 kontrast", () => {
  assert.equal(STAFF_COLORS.length, 20);
  assert.equal(new Set(STAFF_COLORS.map((c) => c.background)).size, 20);
  for (const color of STAFF_COLORS) {
    assert(contrast(color.background, color.text) >= 4.5, color.name);
    assert.equal(textForColor(color.background), color.text);
  }
  assert.equal(textForColor("#a23e00"), "#ffffff");
});
test("stare boje migriraju se jednom, bez promene ostalih podataka zaposlenih", () => {
  const s = demoState();
  s.employees[0].color = "#2563eb";
  s.employees[1].color = "#008049";
  s.employees[2].color = "#bd5b00";
  s.employees[3].color = "#be247a";
  const before = structuredClone(s.employees);
  assert(normalizeStaffColors(s.employees));
  assert(!normalizeStaffColors(s.employees));
  assert.equal(new Set(s.employees.map((e) => e.color)).size, 4);
  assert.equal(s.employees[2].color, "#a23e00");
  s.employees.forEach((e, index) =>
    assert.deepEqual({ ...e, color: before[index].color }, before[index]),
  );
});
test("server odbija boju izvan palete i zauzetu boju", () => {
  const s = demoState(),
    admin = s.employees[0],
    employee = s.employees[1];
  assert.throws(() =>
    execute(s, admin, {
      type: "saveEmployee",
      payload: { ...employee, color: "#abcdef" },
    }),
  );
  assert.throws(
    () =>
      execute(s, admin, {
        type: "saveEmployee",
        payload: { ...employee, color: admin.color },
      }),
    /već pripada/,
  );
});
test("objašnjenja i beleške učenika su opciona; datum kreiranja je serverski i ne menja se", () => {
  const s = demoState(),
    admin = s.employees[0],
    id = execute(s, admin, {
      type: "saveStudent",
      payload: {
        name: "Novi učenik",
        level: "8",
        subject: "Matematika",
        channel: "other",
      },
    }).entityId!;
  const created = s.students.find((st) => st.id === id)!;
  assert(created.createdAt);
  assert.equal(created.otherNote, "");
  const at = created.createdAt;
  execute(s, admin, {
    type: "saveStudent",
    payload: {
      ...created,
      channel: "referral",
      referralNote: "Preporučila Ana",
      otherNote: "Preko takmičenja",
      notes: "Priprema za prijemni.\nDodatni zadaci.",
      createdAt: "1900-01-01T00:00:00Z",
    },
  });
  let student = s.students.find((st) => st.id === id)!;
  assert.equal(student.createdAt, at);
  assert.equal(student.referralNote, "Preporučila Ana");
  assert.match(student.notes!, /Dodatni zadaci/);
  execute(s, admin, {
    type: "saveStudent",
    payload: {
      id,
      name: "Izmenjeno ime",
      level: "8",
      subject: "Matematika",
      channel: "other",
    },
  });
  student = s.students.find((st) => st.id === id)!;
  assert.equal(student.otherNote, "Preko takmičenja");
  assert.equal(student.referralNote, "Preporučila Ana");
  assert.equal(student.createdAt, at);
  assert(!project(s, s.employees[2]).students.some((st) => st.id === id));
});
test("stari datum kreiranja se vraća iz istorije umesto izmišljanja datuma", () => {
  const s = demoState(),
    student = s.students[0];
  delete student.createdAt;
  s.audits.push({
    id: "create",
    actorId: "ana",
    action: "Sačuvan učenik",
    entityId: student.id,
    at: "2026-01-20T15:10:00Z",
    before: null,
    after: { ...student },
  });
  assert.equal(
    project(s, s.employees[1]).students.find((st) => st.id === student.id)
      ?.createdAt,
    "2026-01-20T15:10:00Z",
  );
});
