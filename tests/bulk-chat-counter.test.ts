import { test } from "node:test";
import assert from "node:assert/strict";
import {
  execute,
  project,
  counter,
  rememberUndo,
  undoLast,
  redoLast,
  financial,
} from "../src/lib/domain";
import { parseDuration } from "../src/lib/duration";
import { demoState } from "../src/lib/seed";
import { previewConflicts, resolveDesk } from "../src/lib/scheduling-preview";
import type { Lesson, SchoolState } from "../src/lib/types";
function setup() {
  const s = demoState();
  s.lessons = [];
  s.counters = [];
  s.payments = [];
  s.handovers = [];
  s.audits = [];
  s.messages = [];
  return s;
}
function action(
  s: SchoolState,
  type: string,
  payload: unknown,
  actor = s.employees[0],
) {
  const before = structuredClone(s),
    r = execute(s, actor, { type, payload });
  rememberUndo(s, before, actor, type);
  return r;
}
function add(s: SchoolState, patch: Partial<Lesson> = {}) {
  return action(s, "saveLesson", {
    studentId: "s1",
    teacherId: "admin",
    date: "2030-01-07",
    start: 600,
    duration: 45,
    desk: 1,
    mode: "in_person",
    topic: "",
    status: "scheduled",
    price: 100000,
    bossBps: 3000,
    shared: false,
    ...patch,
  }).entityId!;
}
test("novi učenik i čas čuvaju se zajedno; konflikt ne ostavlja nepotpun unos", () => {
  const s = setup();
  add(s);
  const before = structuredClone(s);
  const payload = {
    student: {
      name: "Novi učenik",
      level: "8",
      subject: "Matematika",
      channel: "direct",
    },
    lesson: {
      ...s.lessons[0],
      id: undefined,
      studentId: "",
      duration: 90,
      units: 2,
    },
  };
  assert.throws(
    () => action(s, "saveLessonDraft", payload),
    /drugi|termin|zauzet|već/,
  );
  assert.deepEqual(s, before);
  payload.lesson.start = 720;
  action(s, "saveLessonDraft", payload);
  assert.equal(s.lessons.length, 3);
  assert.equal(s.students.length, before.students.length + 1);
  undoLast(s, s.employees[0]);
  assert.equal(s.lessons.filter((l) => l.status !== "cancelled").length, 1);
  redoLast(s, s.employees[0]);
  assert.equal(s.lessons.filter((l) => l.status !== "cancelled").length, 3);
});
test("pregled konflikta prepoznaje sto, predavača i učenika, a dodirni termin je slobodan", () => {
  const s = setup();
  add(s);
  const draft = {
    studentName: "Novi",
    teacherId: "ana",
    date: "2030-01-07",
    start: 600,
    duration: 45,
    units: 1,
    desk: 1 as const,
    mode: "in_person" as const,
  };
  assert.equal(previewConflicts(s.lessons, draft)[0].reason, "Sto je zauzet");
  assert.equal(
    previewConflicts(s.lessons, { ...draft, teacherId: "admin", desk: 2 })[0]
      .reason,
    "Predavač ima drugi čas",
  );
  assert.equal(
    previewConflicts(s.lessons, { ...draft, studentId: "s1", desk: 2 })[0]
      .reason,
    "Učenik ima drugi čas",
  );
  assert.equal(previewConflicts(s.lessons, { ...draft, start: 645 }).length, 0);
});
test("slobodan drugi sto bira se automatski bez upozorenja, uključujući seriju časova", () => {
  const s = setup();
  add(s, { studentId: "s2", teacherId: "marko", start: 645 });
  const result = action(s, "saveLesson", {
    studentId: "s1",
    teacherId: "admin",
    date: "2030-01-07",
    start: 600,
    duration: 90,
    units: 2,
    desk: 1,
    mode: "in_person",
    topic: "",
    status: "scheduled",
    price: null,
    bossBps: null,
    shared: false,
  });
  assert.equal(result.warning, undefined);
  assert(
    s.lessons.filter((l) => l.teacherId === "admin").every((l) => l.desk === 2),
  );
  const first = s.lessons[0],
    draft = {
      studentName: "Novi",
      teacherId: "ana",
      studentId: "s3",
      date: first.date,
      start: first.start,
      duration: first.duration,
      units: 1,
      desk: 1 as const,
      mode: "in_person" as const,
    };
  assert.equal(resolveDesk([first], draft), 2);
  assert.equal(resolveDesk([first], { ...draft, teacherId: "marko" }), 1);
  assert.equal(
    resolveDesk([first], { ...draft, studentId: first.studentId }),
    1,
  );
});
test("trajanje prihvata prazan unos tokom kucanja i izraze za više časova", () => {
  for (const v of ["2x45", "2 x 45", "2*45", "2 *45", "2 × 45", "2х45"])
    assert.deepEqual(parseDuration(v), { duration: 90, units: 2 });
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration("0"), null);
  assert.equal(parseDuration("45+45"), null);
  assert.deepEqual(parseDuration("60"), { duration: 60, units: 1 });
});
test("2 × 45 pravi dva nezavisna časa i brojače 1/4, 2/4, sledeći je 3/4", () => {
  const s = setup();
  add(s, { duration: 90, units: 2 });
  const third = add(s, { date: "2030-01-08" });
  assert.equal(s.lessons.length, 3);
  assert.deepEqual(
    s.lessons.map((l) => [l.start, l.duration, l.units]),
    [
      [600, 45, 1],
      [645, 45, 1],
      [600, 45, 1],
    ],
  );
  const v = project(s, s.employees[0]);
  assert.deepEqual(
    v.lessons.map((l) => ("cycleNumbers" in l ? l.cycleNumbers : [])),
    [[1], [2], [3]],
  );
  for (const lesson of [...s.lessons])
    action(s, "saveLesson", { ...lesson, status: "completed" });
  assert.deepEqual(counter(s, "s1"), { total: 3, cycle: 3 });
  action(s, "saveLesson", {
    ...s.lessons.find((l) => l.id === third)!,
    status: "completed",
  });
  assert.equal(counter(s, "s1").total, 3);
});
test("unos serije se u celini odbija ako drugi čas ima preklapanje", () => {
  const s = setup();
  add(s, { studentId: "s2", start: 645, teacherId: "marko" });
  add(s, { studentId: "s3", start: 645, teacherId: "ana", desk: 2 });
  const before = structuredClone(s);
  assert.throws(() => add(s, { duration: 90, units: 2 }), /zauzet/);
  assert.deepEqual(s, before);
});
test("grupno pomeranje je atomsko i ima zajedničko poništavanje i ponavljanje", () => {
  const s = setup(),
    a = add(s),
    b = add(s, { start: 660 });
  action(s, "moveLessons", {
    moves: [
      { id: a, date: "2030-01-08", start: 600, desk: 2, mode: "in_person" },
      { id: b, date: "2030-01-08", start: 660, desk: 2, mode: "in_person" },
    ],
  });
  assert(s.lessons.every((l) => l.desk === 2 && l.date === "2030-01-08"));
  assert.match(project(s, s.employees[0]).undoLabel!, /pomeranje 2/);
  undoLast(s, s.employees[0]);
  assert(s.lessons.every((l) => l.desk === 1 && l.date === "2030-01-07"));
  assert(project(s, s.employees[0]).redoLabel);
  redoLast(s, s.employees[0]);
  assert(s.lessons.every((l) => l.desk === 2 && l.date === "2030-01-08"));
  add(s, {
    studentId: "s2",
    teacherId: "admin",
    date: "2030-01-09",
    start: 660,
  });
  const before = structuredClone(s);
  assert.throws(
    () =>
      action(s, "moveLessons", {
        moves: [
          { id: a, date: "2030-01-09", start: 600, desk: 1, mode: "in_person" },
          { id: b, date: "2030-01-09", start: 660, desk: 1, mode: "in_person" },
        ],
      }),
    /Predavač|zauzet/,
  );
  assert.deepEqual(s, before);
});
test("brisanje čuva novac, sklanja rezervaciju i brojače, undo i redo rade za grupu", () => {
  const s = setup(),
    a = add(s, { status: "completed" }),
    b = add(s, { start: 660, status: "completed" });
  action(s, "payment", { lessonId: a, date: "2030-01-07", amount: 100000 });
  action(s, "deleteLessons", { ids: [a, b] });
  assert.equal(counter(s, "s1").total, 0);
  assert.equal(financial(s, s.lessons[0]).paid, 100000);
  assert(!project(s, s.employees[2]).lessons.some((l) => l.id === a));
  undoLast(s, s.employees[0]);
  assert.equal(counter(s, "s1").total, 2);
  assert(s.lessons.every((l) => !l.deletedAt));
  redoLast(s, s.employees[0]);
  assert(s.lessons.every((l) => l.deletedAt));
  assert.equal(financial(s, s.lessons[0]).paid, 100000);
});
test("grupne radnje ne dopuštaju tuđe i privatne časove", () => {
  const s = setup(),
    a = add(s),
    b = add(s, {
      studentId: "s2",
      teacherId: "marko",
      start: 660,
      mode: "online",
      desk: null,
    });
  const before = structuredClone(s);
  assert.throws(
    () => action(s, "deleteLessons", { ids: [a, b] }, s.employees[1]),
    /dozvolu/,
  );
  assert.deepEqual(s, before);
  assert.throws(
    () =>
      action(s, "moveLessons", {
        moves: [
          { id: b, date: "2030-01-08", start: 660, desk: null, mode: "online" },
        ],
      }),
    /dozvolu/,
  );
});
test("ponavljanje ne prepisuje nove izmene i nova radnja prazni redo", () => {
  const s = setup(),
    key = add(s);
  action(s, "saveLesson", { ...s.lessons[0], start: 660 });
  undoLast(s, s.employees[0]);
  action(s, "setPackage", { studentId: "s1", packageSize: 5 });
  assert.equal(project(s, s.employees[0]).redoLabel, null);
  assert.throws(() => redoLast(s, s.employees[0]), /Nema radnje/);
  action(s, "saveLesson", {
    ...s.lessons.find((l) => l.id === key)!,
    start: 720,
  });
  undoLast(s, s.employees[0]);
  const lesson = s.lessons[0];
  s.lessons[0] = { ...lesson, topic: "Nova izmena drugog korisnika" };
  assert.throws(() => redoLast(s, s.employees[0]), /noviju izmenu/);
});
test("zbornica ima odgovore, sviđanja i zakačene poruke, uređuje samo autor", () => {
  const s = setup(),
    ana = s.employees[1],
    marko = s.employees[2];
  const id = action(
    s,
    "postMessage",
    { text: "Dogovor za sutra" },
    ana,
  ).entityId!;
  action(s, "likeMessage", { id }, marko);
  action(s, "pinMessage", { id }, marko);
  const reply = action(
    s,
    "postMessage",
    { text: "Važi!", replyTo: id },
    marko,
  ).entityId!;
  assert.equal(project(s, ana).messages.length, 2);
  assert.deepEqual(s.messages![0].likedBy, [marko.id]);
  action(s, "likeMessage", { id, liked: true }, marko);
  action(s, "likeMessage", { id, liked: true }, marko);
  assert.deepEqual(s.messages![0].likedBy, [marko.id]);
  assert(s.messages![0].pinned);
  assert.equal(s.messages![1].replyTo, id);
  assert.throws(
    () => action(s, "editMessage", { id, text: "Tuđa izmena" }, marko),
    /dozvolu/,
  );
  assert.throws(() => action(s, "deleteMessage", { id }, marko), /dozvolu/);
  action(s, "editMessage", { id: reply, text: "Potvrđeno" }, marko);
  action(s, "deleteMessage", { id }, s.employees[0]);
  assert(s.messages![0].deletedAt);
  undoLast(s, s.employees[0]);
  assert(!s.messages![0].deletedAt);
});
