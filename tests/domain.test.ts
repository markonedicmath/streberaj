import { test } from "node:test";
import assert from "node:assert/strict";
import {
  counter,
  execute,
  financial,
  project,
  selectRule,
} from "../src/lib/domain";
import { demoState } from "../src/lib/seed";
import { addDays, belgradeToday, weekStart } from "../src/lib/time";
import type { SchoolState, Employee, Lesson } from "../src/lib/types";
function setup() {
  const s = demoState();
  s.lessons = [];
  s.payments = [];
  s.handovers = [];
  s.counters = [];
  s.audits = [];
  s.attachments = [];
  return s;
}
function add(s: SchoolState, actor: Employee, patch: Partial<Lesson> = {}) {
  const payload = {
    studentId: actor.id === "marko" ? "s2" : "s1",
    teacherId: actor.id,
    date: "2030-01-07",
    start: 600,
    duration: 60,
    desk: 1,
    mode: "in_person",
    topic: "",
    status: "scheduled",
    price: 180000,
    bossBps: 3000,
    shared: false,
    ...patch,
  };
  const result = execute(s, actor, { type: "saveLesson", payload });
  return s.lessons.find((l) => l.id === result.entityId)!;
}
const admin = (s: SchoolState) => s.employees[0],
  ana = (s: SchoolState) => s.employees[1],
  marko = (s: SchoolState) => s.employees[2];
test("tekuća nedelja prati Beograd, uključujući promenu sata", () => {
  assert.equal(belgradeToday(new Date("2026-10-25T23:30Z")), "2026-10-26");
  assert.equal(
    weekStart(belgradeToday(new Date("2026-10-25T22:30Z"))),
    "2026-10-19",
  );
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
});
test("privatni online čas se ne šalje ni administratoru", () => {
  const s = setup(),
    l = add(s, ana(s), { mode: "online", desk: null });
  s.payments.push({
    id: "p",
    lessonId: l.id,
    amount: 100,
    date: l.date,
    note: "privatno",
    actorId: "ana",
  });
  s.attachments.push({
    id: "a",
    lessonId: l.id,
    studentId: l.studentId,
    key: "x",
    name: "tajna.png",
    mime: "image/png",
    size: 10,
    kind: "material",
    sentAt: null,
    uploadedBy: "ana",
    createdAt: "x",
  });
  const v = project(s, admin(s));
  assert(!v.lessons.some((x) => x.id === l.id));
  assert.equal(v.payments.length, 0);
  assert.equal(v.attachments.length, 0);
  assert(!v.audits.some((a) => a.entityId === l.id));
  assert.equal(project(s, ana(s)).lessons.length, 1);
});
test("deljenje je po času, a povlačenje čuva primljen novac", () => {
  const s = setup(),
    l = add(s, ana(s), { mode: "online", desk: null });
  execute(s, ana(s), { type: "saveLesson", payload: { ...l, shared: true } });
  assert.equal(project(s, admin(s)).lessons.length, 1);
  execute(s, admin(s), {
    type: "handover",
    payload: { lessonId: l.id, amount: 50000, date: l.date },
  });
  const current = s.lessons[0];
  execute(s, ana(s), {
    type: "saveLesson",
    payload: { ...current, shared: false },
  });
  const v = project(s, admin(s));
  assert.equal(v.lessons.length, 0);
  assert.equal(v.handovers.length, 1);
});
test("drugi predavač dobija samo zauzetost, bez učenika i iznosa", () => {
  const s = setup(),
    l = add(s, ana(s));
  const v = project(s, marko(s));
  assert.deepEqual(v.lessons[0], {
    id: l.id,
    teacherId: "ana",
    date: l.date,
    start: 600,
    duration: 60,
    desk: 1,
    mode: "in_person",
    restricted: true,
  });
  assert.equal(v.payments.length, 0);
  assert(!v.students.some((st) => st.id === "s1"));
});
test("privatan online termin ipak blokira preklapanje predavača", () => {
  const s = setup();
  add(s, ana(s), { mode: "online", desk: null });
  assert.throws(
    () => add(s, admin(s), { teacherId: "ana", studentId: "s4", start: 615 }),
    /Predavač već/,
  );
});
test("učenik ne može kod dva predavača istovremeno", () => {
  const s = setup();
  add(s, ana(s));
  assert.throws(
    () => add(s, admin(s), { studentId: "s1", teacherId: "marko", desk: 2 }),
    /Učenik već/,
  );
});
test("drugi sto je dozvoljen bez upozorenja, treći čas je blokiran", () => {
  const s = setup();
  add(s, ana(s));
  const r = execute(s, marko(s), {
    type: "saveLesson",
    payload: {
      studentId: "s2",
      teacherId: "marko",
      date: "2030-01-07",
      start: 600,
      duration: 60,
      desk: 2,
      mode: "in_person",
      topic: "",
      status: "scheduled",
      price: null,
      bossBps: null,
      shared: false,
    },
  });
  assert.equal(r.warning, undefined);
  assert.throws(
    () => add(s, admin(s), { studentId: "s4", desk: 1 }),
    /sto je zauzet/,
  );
});
test("dodirni termini ne predstavljaju preklapanje", () => {
  const s = setup();
  add(s, ana(s));
  assert.doesNotThrow(() => add(s, ana(s), { start: 660 }));
});
test("svi podrazumevano zakazuju za druge; dozvola može da se isključi", () => {
  const s = setup();
  const l = add(s, ana(s), { teacherId: "marko" });
  assert.equal(l.teacherId, "marko");
  assert("restricted" in project(s, ana(s)).lessons[0]);
  ana(s).canScheduleOthers = false;
  assert.throws(
    () => add(s, ana(s), { teacherId: "marko", start: 800 }),
    /dozvolu/,
  );
});
test("predavač ne može da uređuje tuđi čas koji je zakazao", () => {
  const s = setup(),
    l = add(s, ana(s), { teacherId: "marko" });
  assert.throws(
    () =>
      execute(s, ana(s), { type: "saveLesson", payload: { ...l, start: 700 } }),
    /dozvolu/,
  );
});
test("brzo dodavanje pravi čas za prijavljenog, traje 45 minuta i koristi matematiku", () => {
  const s = setup(),
    r = execute(s, ana(s), {
      type: "quickLesson",
      payload: { name: "Novi učenik", date: "2030-01-07", start: 600, desk: 1 },
    }),
    l = s.lessons.find((l) => l.id === r.entityId)!;
  assert.equal(l.teacherId, "ana");
  assert.equal(l.duration, 45);
  assert.equal(l.price, null);
  assert.equal(
    s.students.find((st) => st.id === l.studentId)?.subject,
    "Matematika",
  );
});
test("brzi unos ne spaja dva učenika istog imena", () => {
  const s = setup();
  s.students.push({ ...s.students[0], id: "duplicate" });
  assert.throws(
    () =>
      execute(s, ana(s), {
        type: "quickLesson",
        payload: {
          name: s.students[0].name,
          date: "2030-01-07",
          start: 600,
          desk: 1,
        },
      }),
    /Više učenika/,
  );
});
test("prevlačenje u online ne zauzima sto i ostaje privatno", () => {
  const s = setup(),
    l = add(s, ana(s));
  execute(s, ana(s), {
    type: "saveLesson",
    payload: { ...l, mode: "online", desk: null, shared: false },
  });
  assert.equal(s.lessons[0].desk, null);
  assert(!project(s, admin(s)).lessons.some((x) => x.id === l.id));
  assert.doesNotThrow(() => add(s, admin(s), { studentId: "s4" }));
});
test("održavanje povećava brojače jednom, uključujući privatne online časove", () => {
  const s = setup(),
    l = add(s, ana(s), { mode: "online", desk: null, status: "completed" });
  execute(s, ana(s), {
    type: "saveLesson",
    payload: { ...l, topic: "Druga beleška" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 1, cycle: 1 });
  execute(s, ana(s), {
    type: "saveLesson",
    payload: { ...s.lessons[0], status: "scheduled" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 0, cycle: 0 });
});
test("ciklus staje na četiri; reset čuva ukupan broj", () => {
  const s = setup();
  for (let i = 0; i < 5; i++)
    add(s, ana(s), { date: addDays("2030-01-07", i), status: "completed" });
  assert.deepEqual(counter(s, "s1"), { total: 5, cycle: 4 });
  execute(s, ana(s), {
    type: "counter",
    payload: { studentId: "s1", action: "reset" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 5, cycle: 0 });
  execute(s, ana(s), {
    type: "counter",
    payload: { studentId: "s1", action: "increment" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 5, cycle: 1 });
});
test("poništenje starog održanog časa ne smanjuje novi ciklus posle reseta", () => {
  const s = setup(),
    old = add(s, ana(s), { status: "completed" });
  execute(s, ana(s), {
    type: "counter",
    payload: { studentId: "s1", action: "reset" },
  });
  add(s, ana(s), { date: "2030-01-08", status: "completed" });
  execute(s, ana(s), {
    type: "saveLesson",
    payload: { ...old, status: "cancelled" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 1, cycle: 1 });
});
test("promena cene zadržava uplate, predaje i obračunava preplatu", () => {
  const s = setup(),
    l = add(s, admin(s), { price: 200000, bossBps: 3000, status: "completed" });
  execute(s, admin(s), {
    type: "payment",
    payload: { lessonId: l.id, amount: 200000, date: l.date },
  });
  execute(s, admin(s), {
    type: "handover",
    payload: { lessonId: l.id, amount: 60000, date: l.date },
  });
  execute(s, admin(s), {
    type: "saveLesson",
    payload: { ...l, price: 150000 },
  });
  assert.deepEqual(financial(s, s.lessons[0]), {
    paid: 200000,
    handed: 60000,
    boss: 45000,
    teacher: 105000,
    studentBalance: -50000,
    bossBalance: -15000,
  });
});
test("procenti se računaju u celim parama bez gubitka ukupnog iznosa", () => {
  const s = setup(),
    l = add(s, admin(s), { price: 10001, bossBps: 3333 }),
    f = financial(s, l);
  assert.equal(f.boss, 3333);
  assert.equal(f.boss! + f.teacher!, 10001);
});
test("predavač ne može promeniti sačuvan Manojlov procenat", () => {
  const s = setup(),
    l = add(s, ana(s));
  assert.throws(
    () =>
      execute(s, ana(s), { type: "saveLesson", payload: { ...l, bossBps: 0 } }),
    /procenat/,
  );
});
test("novi čas predavača dobija serverski procenat čak i uz lažni zahtev", () => {
  const s = setup(),
    l = add(s, ana(s), { bossBps: 0 });
  assert.equal(l.bossBps, 3000);
});
test("zaključana cena se proverava na serveru", () => {
  const s = setup(),
    l = add(s, ana(s));
  ana(s).canSetPrice = false;
  assert.throws(
    () =>
      execute(s, ana(s), { type: "saveLesson", payload: { ...l, price: 1 } }),
    /promenu cene/,
  );
});
test("cenovnik koristi prvo odgovarajuće pravilo i ne menja stare snimke", () => {
  const s = setup(),
    l = add(s, ana(s));
  s.rules.unshift({
    ...s.rules[0],
    id: "specific",
    priority: 0,
    teacherId: "ana",
    price: 70000,
    bossBps: 2000,
  });
  assert.equal(selectRule(s, l, s.students[0])?.id, "specific");
  assert.equal(l.price, 180000);
  assert.equal(l.bossBps, 3000);
});
test("boja i imejl su jedinstveni i korisnik ne može isključiti sebe", () => {
  const s = setup();
  assert.throws(
    () =>
      execute(s, admin(s), {
        type: "saveEmployee",
        payload: { ...ana(s), color: admin(s).color },
      }),
    /boja/,
  );
  assert.throws(
    () =>
      execute(s, admin(s), {
        type: "saveEmployee",
        payload: { ...admin(s), active: false },
      }),
    /svoj administratorski/,
  );
});
test("čas sa novcem ne može se prevezati na drugog učenika", () => {
  const s = setup(),
    l = add(s, admin(s));
  execute(s, admin(s), {
    type: "payment",
    payload: { lessonId: l.id, amount: 100, date: l.date },
  });
  assert.throws(
    () =>
      execute(s, admin(s), {
        type: "saveLesson",
        payload: { ...l, studentId: "s4" },
      }),
    /prevezati/,
  );
});
test("prošli i budući datumi su dozvoljeni, neispravni nisu", () => {
  const s = setup();
  assert.doesNotThrow(() => add(s, admin(s), { date: "2020-01-07" }));
  assert.doesNotThrow(() => add(s, admin(s), { date: "2035-01-07" }));
  assert.throws(() => add(s, admin(s), { date: "2030-02-31" }));
});
test("paket od pet časova nije ograničen na četiri", () => {
  const s = setup();
  s.students[0].packageSize = 5;
  for (let i = 0; i < 6; i++)
    add(s, ana(s), { date: addDays("2030-01-07", i), status: "completed" });
  assert.deepEqual(counter(s, "s1"), { total: 6, cycle: 5 });
  execute(s, ana(s), {
    type: "counter",
    payload: { studentId: "s1", action: "reset" },
  });
  assert.deepEqual(counter(s, "s1"), { total: 6, cycle: 0 });
});
test("veličina paketa može da se smanji bez gubitka istorije", () => {
  const s = setup();
  for (let i = 0; i < 4; i++)
    add(s, ana(s), { date: addDays("2030-01-07", i), status: "completed" });
  execute(s, ana(s), {
    type: "saveStudent",
    payload: { ...s.students[0], packageSize: 2 },
  });
  assert.deepEqual(counter(s, "s1"), { total: 4, cycle: 2 });
});
test("autocomplete bira tačnog učenika čak i kada su imena jednaka", () => {
  const s = setup();
  s.students.push({ ...s.students[0], id: "duplicate" });
  const r = execute(s, ana(s), {
    type: "quickLesson",
    payload: {
      name: s.students[0].name,
      studentId: "duplicate",
      date: "2030-01-07",
      start: 600,
      desk: 1,
    },
  });
  assert.equal(
    s.lessons.find((l) => l.id === r.entityId)?.studentId,
    "duplicate",
  );
});
test("nastava izvan prikazane satnice se odbija", () => {
  const s = setup();
  assert.throws(() => add(s, admin(s), { start: 345 }), /06:00/);
  assert.throws(() => add(s, admin(s), { start: 1350, duration: 60 }), /23:00/);
});
