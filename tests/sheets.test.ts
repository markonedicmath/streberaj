import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSheets,
  reconcileSources,
  type SheetsDocument,
} from "../src/lib/sheets";
import { demoState } from "../src/lib/seed";
import type { SourceBlock } from "../src/lib/types";
function document(): SheetsDocument {
  return {
    sheets: [
      {
        properties: { sheetId: 10, title: "19.10-25.10" },
        merges: [
          {
            startRowIndex: 2,
            endRowIndex: 5,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
        ],
        data: [
          {
            rowData: [
              { values: [] },
              { values: [] },
              ...["08:00", "08:15", "08:30", "08:45"].map((time, i) => ({
                values: [
                  { formattedValue: time },
                  {
                    formattedValue: i === 0 ? "Ime 5/5" : "",
                    effectiveFormat: {
                      backgroundColor: { red: 1, green: 0, blue: 0 },
                    },
                  },
                ],
              })),
            ],
          },
        ],
      },
    ],
  };
}
function setup() {
  const s = demoState();
  s.lessons = [];
  s.payments = [];
  s.handovers = [];
  s.counters = [];
  s.audits = [];
  s.sourceBlocks = [];
  s.sync.colorMap = { "#ff0000": "ana" };
  s.sync.studentMap = { "Ime 5/5": "s1" };
  return s;
}
const block = (patch: Partial<SourceBlock> = {}): SourceBlock => ({
  id: "10:B3:name",
  sheetId: 10,
  range: "B3:B5",
  date: "2026-10-19",
  start: 480,
  duration: 45,
  desk: 1,
  color: "#ff0000",
  text: "Ime 5/5",
  ...patch,
});
test("čita spojene ćelije, boju, 15-minutnu satnicu i izvorni tekst", () => {
  const b = parseSheets(document(), 2026);
  assert.equal(b[0].start, 480);
  assert.equal(b[0].duration, 45);
  assert.equal(b[0].text, "Ime 5/5");
  assert.equal(b[0].color, "#ff0000");
  assert.equal(b[0].desk, 1);
  assert.equal(b[0].date, "2026-10-19");
});
test("čita i obojene blokove bez spajanja, sa imenom na dnu", () => {
  const d = document();
  d.sheets[0].merges = [];
  const rows = d.sheets[0].data![0].rowData!;
  rows[2].values![1].formattedValue = "";
  rows[5].values![1].formattedValue = "Ime 5/5";
  const b = parseSheets(d, 2026);
  assert.equal(b.length, 1);
  assert.equal(b[0].duration, 60);
  assert.equal(b[0].text, "Ime 5/5");
});
test("pogrešna godina se odbija umesto uvoza na pogrešne datume", () => {
  assert.throws(() => parseSheets(document(), 2025), /ponedeljkom/);
});
test("ponovni uvoz ne pravi duple časove i ne zaključuje da su stari časovi održani", () => {
  const s = setup();
  reconcileSources(s, [block()]);
  reconcileSources(s, [block()]);
  assert.equal(s.lessons.length, 1);
  assert.equal(s.lessons[0].status, "scheduled");
  assert.equal(s.lessons[0].price, null);
});
test("nedvosmisleno pomeranje čuva identitet, uplatu i priloge", () => {
  const s = setup();
  reconcileSources(s, [block()]);
  const id = s.lessons[0].id;
  s.payments.push({
    id: "p",
    lessonId: id,
    amount: 100,
    date: "2026-10-19",
    note: "",
    actorId: "ana",
  });
  reconcileSources(s, [
    block({ id: "10:B7:name", range: "B7:B9", start: 540 }),
  ]);
  assert.equal(s.lessons.length, 1);
  assert.equal(s.lessons[0].id, id);
  assert.equal(s.lessons[0].start, 540);
  assert.equal(s.payments[0].lessonId, id);
});
test("lokalna izmena nije prepisana promenom u izvoru", () => {
  const s = setup();
  reconcileSources(s, [block()]);
  s.lessons[0].localOverride = true;
  s.lessons[0].start = 600;
  reconcileSources(s, [block({ id: "10:B7:name", start: 540 })]);
  assert.equal(s.lessons[0].start, 600);
  assert.match(s.lessons[0].conflict!, /lokalna izmena/);
});
test("brisanje izvora čuva čas, istoriju i uplate", () => {
  const s = setup();
  reconcileSources(s, [block()]);
  const id = s.lessons[0].id;
  s.payments.push({
    id: "p",
    lessonId: id,
    amount: 100,
    date: "2026-10-19",
    note: "",
    actorId: "ana",
  });
  reconcileSources(s, []);
  assert.equal(s.lessons.length, 1);
  assert.equal(s.payments.length, 1);
  assert.equal(s.lessons[0].sourceMissing, true);
  assert(s.sourceBlocks[0].missing);
});
test("nepoznata boja ili učenik ne stvaraju pogrešno povezan čas", () => {
  const s = setup();
  s.sync.colorMap = {};
  reconcileSources(s, [block()]);
  assert.equal(s.lessons.length, 0);
  assert.match(s.sourceBlocks[0].issue!, /boju/);
});
test("dvosmislena pomeranja idu na proveru bez prevezivanja novca", () => {
  const s = setup();
  reconcileSources(s, [block(), block({ id: "second", start: 600 })]);
  const ids = s.lessons.map((l) => l.id);
  reconcileSources(s, [block({ id: "moved", start: 700 })]);
  assert.equal(s.lessons.length, 2);
  assert.deepEqual(
    s.lessons.map((l) => l.id),
    ids,
  );
  assert.match(s.sourceBlocks[0].issue!, /jednoznačno/);
});
test("uvoz pri konfliktu zadržava izvornu rezervaciju i jasno označava problem", () => {
  const s = setup();
  reconcileSources(s, [block(), block({ id: "second", start: 495 })]);
  assert.equal(s.lessons.length, 2);
  assert(s.lessons.some((l) => l.conflict));
});
test("promena povezivanja na drugog učenika ne prebacuje istoriju", () => {
  const s = setup();
  reconcileSources(s, [block()]);
  s.sync.studentMap["Ime 5/5"] = "s4";
  reconcileSources(s, [block()]);
  assert.equal(s.lessons.length, 1);
  assert.equal(s.lessons[0].studentId, "s1");
  assert.match(s.sourceBlocks[0].issue!, /učenikom/);
});
