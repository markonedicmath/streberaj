import { test } from "node:test";
import assert from "node:assert/strict";
import { isDoubleTap, type Tap } from "../src/lib/tap";
const first: Tap = {
  key: "sreda-1",
  x: 100,
  y: 400,
  at: 1000,
  scrollTop: 100,
  scrollLeft: 300,
};
test("dva kratka dodira u istom polju otvaraju brzi unos bez oslanjanja na dblclick", () => {
  assert(!isDoubleTap(null, first));
  assert(isDoubleTap(first, { ...first, at: 1250, x: 105, y: 408 }));
});
test("pomeranje mreže, drugo polje ili spori/udaljeni dodiri nisu dvostruki dodir", () => {
  for (const patch of [
    { key: "sreda-2" },
    { at: 1500 },
    { x: 140 },
    { scrollTop: 120 },
    { scrollLeft: 325 },
  ])
    assert(!isDoubleTap(first, { ...first, at: 1200, ...patch }));
});
