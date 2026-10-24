import { test } from "node:test";
import assert from "node:assert/strict";
import {
  execute,
  rememberUndo,
  financial,
  counter,
  undoLast,
} from "../src/lib/domain";
import { demoState } from "../src/lib/seed";
import type { Employee, SchoolState } from "../src/lib/types";
function setup() {
  const s = demoState();
  s.lessons = [];
  s.payments = [];
  s.handovers = [];
  s.counters = [];
  s.audits = [];
  return s;
}
function action(
  s: SchoolState,
  actor: Employee,
  type: string,
  payload: unknown,
) {
  const before = structuredClone(s),
    result = execute(s, actor, { type, payload });
  rememberUndo(s, before, actor, type);
  return result;
}
test("poništavanje vraća poslednji sopstveni termin bez promene tuđih podataka", () => {
  const s = setup(),
    a = s.employees[0];
  action(s, a, "quickLesson", {
    name: "Prvi",
    date: "2030-01-07",
    start: 600,
    desk: 1,
  });
  const l = s.lessons[0];
  action(s, a, "saveLesson", { ...l, start: 660 });
  action(s, s.employees[1], "quickLesson", {
    name: "Drugi",
    date: "2030-01-08",
    start: 600,
    desk: 1,
  });
  undoLast(s, a);
  assert.equal(s.lessons.find((x) => x.id === l.id)?.start, 600);
  assert.equal(s.lessons.length, 2);
});
test("novija izmena drugog korisnika ne sme da bude prepisana poništavanjem", () => {
  const s = setup(),
    a = s.employees[1];
  action(s, a, "quickLesson", {
    name: "Prvi",
    date: "2030-01-07",
    start: 600,
    desk: 1,
  });
  const l = s.lessons[0];
  action(s, a, "saveLesson", { ...l, start: 660 });
  action(s, s.employees[0], "saveLesson", { ...s.lessons[0], start: 720 });
  assert.throws(() => undoLast(s, a), /noviju izmenu/);
  assert.equal(s.lessons[0].start, 720);
});
test("poništena uplata ostaje u istoriji i ne ulazi u saldo", () => {
  const s = setup(),
    a = s.employees[0];
  action(s, a, "quickLesson", {
    name: "Prvi",
    date: "2030-01-07",
    start: 600,
    desk: 1,
  });
  action(s, a, "saveLesson", { ...s.lessons[0], price: 100000, bossBps: 3000 });
  const l = s.lessons[0];
  action(s, a, "payment", { lessonId: l.id, amount: 100000, date: l.date });
  undoLast(s, a);
  assert.equal(s.payments.length, 1);
  assert(s.payments[0].voidedAt);
  assert.equal(financial(s, l).paid, 0);
});
test("poništavanje vraća brojače i omogućava više uzastopnih koraka", () => {
  const s = setup(),
    a = s.employees[0];
  action(s, a, "quickLesson", {
    name: "Prvi",
    date: "2030-01-07",
    start: 600,
    desk: 1,
  });
  const id = s.lessons[0].studentId;
  action(s, a, "saveLesson", { ...s.lessons[0], status: "completed" });
  assert.equal(counter(s, id).total, 1);
  undoLast(s, a);
  assert.equal(counter(s, id).total, 0);
  undoLast(s, a);
  assert.equal(s.lessons[0].status, "cancelled");
});
test("poništavanje statusa čuva redosled događaja pre reseta paketa", () => {
  const s = setup(),
    a = s.employees[0];
  action(s, a, "quickLesson", {
    name: "Prvi",
    date: "2030-01-07",
    start: 600,
    desk: 1,
  });
  action(s, a, "saveLesson", { ...s.lessons[0], status: "completed" });
  const l = s.lessons[0];
  action(s, a, "counter", { studentId: l.studentId, action: "reset" });
  action(s, a, "saveLesson", { ...l, status: "scheduled" });
  undoLast(s, a);
  assert.deepEqual(counter(s, l.studentId), { total: 1, cycle: 0 });
});
