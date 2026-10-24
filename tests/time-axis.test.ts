import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRows,
  position,
  minuteAt,
  normalizeRows,
} from "../src/lib/time-axis";
test("promena visine jednog reda čuva tačno mapiranje vremena i trajanja", () => {
  const rows = defaultRows();
  rows[0] = 48;
  assert.equal(position(360, rows), 0);
  assert.equal(position(375, rows), 48);
  assert.equal(position(390, rows), 64);
  assert.equal(minuteAt(24, rows), 367.5);
  assert.equal(minuteAt(64, rows), 390);
  for (let t = 360; t <= 1380; t += 5)
    assert(Math.abs(minuteAt(position(t, rows), rows) - t) < 0.000001);
});
test("raspored ima granice 06:00–23:00, a visina reda je ograničena", () => {
  const rows = normalizeRows(Array.from({ length: 68 }, () => 1000));
  assert.equal(rows[0], 80);
  assert.equal(position(1380, rows), 68 * 80);
  assert.equal(minuteAt(-10, rows), 360);
  assert.equal(minuteAt(99999, rows), 1380);
  assert.equal(normalizeRows(null).length, 68);
});
