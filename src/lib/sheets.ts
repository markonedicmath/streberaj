import { addDays } from "./time";
import { id, schedulingIssue, audit } from "./domain";
import { lessonQuote } from "./pricing";
import { importedDuration } from "./duration-rounding";
import type { Lesson, SchoolState, SourceBlock } from "./types";
import {
  parseSourceLabel,
  studentNameKey,
  canCreateSourceStudent,
} from "./source-label";
interface RGB {
  red?: number;
  green?: number;
  blue?: number;
}
interface Cell {
  formattedValue?: string;
  effectiveValue?: { numberValue?: number; stringValue?: string };
  effectiveFormat?: {
    backgroundColor?: RGB;
    backgroundColorStyle?: { rgbColor?: RGB };
  };
  userEnteredFormat?: { backgroundColor?: RGB };
}
interface Merge {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}
export interface SheetsDocument {
  sheets: {
    properties: { sheetId: number; title: string };
    merges?: Merge[];
    data?: {
      startRow?: number;
      startColumn?: number;
      rowData?: { values?: Cell[] }[];
    }[];
  }[];
}
function hex(c: Cell | undefined) {
  const rgb =
    c?.effectiveFormat?.backgroundColorStyle?.rgbColor ??
    c?.effectiveFormat?.backgroundColor ??
    c?.userEnteredFormat?.backgroundColor;
  if (!rgb) return null;
  const color =
    "#" +
    [rgb.red ?? 0, rgb.green ?? 0, rgb.blue ?? 0]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  return color === "#ffffff" ? null : color;
}
function cellText(c: Cell | undefined) {
  return (c?.formattedValue ?? c?.effectiveValue?.stringValue ?? "").trim();
}
function time(c: Cell | undefined) {
  const text = cellText(c),
    m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (m && Number(m[1]) <= 23 && Number(m[2]) < 60)
    return Number(m[1]) * 60 + Number(m[2]);
  const n = c?.effectiveValue?.numberValue;
  return n !== undefined && n >= 0 && n < 1 ? Math.round(n * 1440) : null;
}
function column(n: number) {
  let s = "";
  for (let v = n + 1; v > 0; v = Math.floor((v - 1) / 26))
    s = String.fromCharCode(65 + ((v - 1) % 26)) + s;
  return s;
}
export function parseSheets(
  doc: SheetsDocument,
  firstYear: number,
): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  let year = firstYear,
    lastMonth = 0,
    weekCount = 0;
  for (const sheet of doc.sheets) {
    const match = sheet.properties.title.match(
      /^(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?$/,
    );
    if (!match) continue;
    const month = Number(match[2]);
    if (lastMonth && month < lastMonth) year++;
    lastMonth = month;
    const start =
      year +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      match[1].padStart(2, "0");
    if (
      new Date(start + "T12:00Z").toISOString().slice(0, 10) !== start ||
      new Date(start + "T12:00Z").getUTCDay() !== 1
    )
      throw new Error(
        "Nedelja " +
          sheet.properties.title +
          " ne počinje ponedeljkom u izabranoj godini.",
      );
    const end = addDays(start, 6);
    if (
      Number(end.slice(8)) !== Number(match[3]) ||
      Number(end.slice(5, 7)) !== Number(match[4])
    )
      throw new Error("Neispravan raspon nedelje: " + sheet.properties.title);
    weekCount++;
    const cells = new Map<string, Cell>(),
      rows = new Set<number>();
    for (const grid of sheet.data ?? [])
      for (const [r, row] of (grid.rowData ?? []).entries()) {
        const ri = r + (grid.startRow ?? 0);
        rows.add(ri);
        for (const [c, cell] of (row.values ?? []).entries())
          cells.set(ri + ":" + (c + (grid.startColumn ?? 0)), cell);
      }
    const get = (r: number, c: number) => cells.get(r + ":" + c),
      times = [...rows]
        .sort((a, b) => a - b)
        .map((r) => ({ r, t: time(get(r, 0)) }))
        .filter((x): x is { r: number; t: number } => x.t !== null);
    if (!times.length)
      throw new Error(
        "Nema prepoznatljive satnice u listu " + sheet.properties.title,
      );
    for (let col = 1; col <= 14; col++) {
      const visited = new Set<number>();
      for (let pos = 0; pos < times.length; pos++) {
        const { r, t } = times[pos];
        if (visited.has(r)) continue;
        const merge = sheet.merges?.find(
          (m) =>
            m.startColumnIndex === col &&
            m.endColumnIndex === col + 1 &&
            r >= m.startRowIndex &&
            r < m.endRowIndex,
        );
        const anchor = merge ? get(merge.startRowIndex, col) : get(r, col),
          color = hex(anchor) ?? hex(get(r, col));
        if (!color) continue;
        let group = merge
          ? times.filter(
              (x) => x.r >= merge.startRowIndex && x.r < merge.endRowIndex,
            )
          : [{ r, t }];
        if (!merge) {
          for (let j = pos + 1; j < times.length; j++) {
            const next = times[j],
              previous = group[group.length - 1];
            if (
              next.t !== previous.t + 15 ||
              hex(get(next.r, col)) !== color ||
              sheet.merges?.some(
                (m) =>
                  next.r >= m.startRowIndex &&
                  next.r < m.endRowIndex &&
                  col >= m.startColumnIndex &&
                  col < m.endColumnIndex,
              )
            )
              break;
            group.push(next);
          }
        }
        for (const x of group) visited.add(x.r);
        const texts = [
            ...new Set(
              group.map((x) => cellText(get(x.r, col))).filter(Boolean),
            ),
          ],
          text = texts.join(" / "),
          label = parseSourceLabel(text),
          from = group[0],
          last = group[group.length - 1];
        const range =
            column(col) + (from.r + 1) + ":" + column(col) + (last.r + 1),
          block: SourceBlock = {
            id:
              sheet.properties.sheetId +
              ":" +
              column(col) +
              (from.r + 1) +
              ":" +
              encodeURIComponent(text),
            sheetId: sheet.properties.sheetId,
            range,
            date: addDays(start, Math.floor((col - 1) / 2)),
            start: from.t,
            duration: last.t - from.t + 15,
            desk: col % 2 === 1 ? 1 : 2,
            color,
            text,
            studentName: label.name,
            sourceCounter: label.counter,
          };
        if (label.issue) block.issue = label.issue;
        if (texts.length !== 1)
          block.issue = texts.length
            ? "Više imena u istom bloku; proverite izvornu rezervaciju."
            : "Blok nema ime učenika.";
        if (group.some((x, i) => i > 0 && x.t !== group[i - 1].t + 15))
          block.issue = "Satnica unutar bloka nije neprekidna.";
        blocks.push(block);
      }
    }
  }
  if (!weekCount) throw new Error("Nema nedeljnih kartica oblika 19.10–25.10.");
  return blocks;
}
function identity(b: SourceBlock) {
  return [
    b.sheetId,
    studentNameKey(parseSourceLabel(b.text).name),
    b.teacherId ?? b.color,
    b.duration,
  ].join("|");
}
export function reconcileSources(s: SchoolState, incoming: SourceBlock[]) {
  const mapped = incoming.map((b) => {
    const label = parseSourceLabel(b.text);
    const teacherId = s.sync.colorMap[b.color];
    let studentId = s.sync.studentMap[b.text] ?? s.sync.studentMap[label.name];
    if (!studentId && teacherId && !b.issue && !label.issue) {
      const matches = s.students.filter(
        (st) => studentNameKey(st.name) === studentNameKey(label.name),
      );
      if (matches.length === 1) studentId = matches[0].id;
      else if (!matches.length && canCreateSourceStudent(label.name)) {
        const student = {
          id: id(),
          name: label.name,
          level: "",
          subject: "Matematika",
          channel: "direct" as const,
          ownerIds: [teacherId],
          packageSize: label.counter?.size ?? 4,
          createdAt: new Date().toISOString(),
        };
        s.students.push(student);
        audit(s, "google", "Uvezen karton učenika", student.id, null, student);
        studentId = student.id;
      }
      if (studentId) s.sync.studentMap[label.name] = studentId;
    }
    return {
      ...b,
      studentName: label.name,
      sourceCounter: label.counter,
      teacherId,
      studentId,
      issue: b.issue ?? label.issue,
    };
  });
  const old = s.sourceBlocks;
  const seen = new Set<string>(),
    now = new Date().toISOString();
  for (const block of mapped) {
    let previous = old.find((b) => b.id === block.id && b.text === block.text),
      lesson = previous
        ? s.lessons.find((l) => l.sourceId === previous!.id)
        : undefined;
    if (!previous) {
      const sameCell = old.filter(
        (b) =>
          b.sheetId === block.sheetId &&
          b.range === block.range &&
          studentNameKey(parseSourceLabel(b.text).name) ===
            studentNameKey(block.studentName ?? block.text) &&
          (b.teacherId ?? b.color) === (block.teacherId ?? block.color),
      );
      if (sameCell.length === 1) {
        previous = sameCell[0];
        lesson = s.lessons.find((l) => l.sourceId === previous!.id);
      }
    }
    if (!previous) {
      const candidates = old.filter(
        (b) =>
          identity(b) === identity(block) && !mapped.some((n) => n.id === b.id),
      );
      const newCandidates = mapped.filter(
        (b) => identity(b) === identity(block),
      );
      if (candidates.length === 1 && newCandidates.length === 1) {
        previous = candidates[0];
        lesson = s.lessons.find((l) => l.sourceId === previous!.id);
      } else if (candidates.length) {
        block.issue = "Pomeranje nije jednoznačno. Povežite rezervaciju ručno.";
      }
    }
    if (previous) seen.add(previous.id);
    if (!block.teacherId)
      block.issue = block.issue ?? "Povežite izvornu boju sa predavačem.";
    if (!block.studentId)
      block.issue = block.issue ?? "Povežite izvorni zapis sa učenikom.";
    if (block.start < 360 || block.start + block.duration > 1380)
      block.issue = "Termin je izvan rasporeda 06:00–23:00.";
    if (
      block.sourceCounter &&
      block.duration % block.sourceCounter.numbers.length !== 0
    )
      block.issue = "Proverite trajanje više časova označenih u istom bloku.";
    if (block.issue) {
      if (lesson) lesson.conflict = block.issue;
      continue;
    }
    if (lesson && lesson.studentId !== block.studentId) {
      block.issue = "Promenjena veza sa učenikom zahteva proveru.";
      lesson.conflict = block.issue;
      continue;
    }
    if (lesson && lesson.teacherId !== block.teacherId) {
      block.issue = "Promenjen predavač zahteva proveru.";
      lesson.conflict = block.issue;
      continue;
    }
    if (lesson?.localOverride) {
      if (
        previous &&
        (previous.date !== block.date ||
          previous.start !== block.start ||
          previous.duration !== block.duration ||
          previous.desk !== block.desk ||
          previous.teacherId !== block.teacherId ||
          JSON.stringify(previous.sourceCounter) !==
            JSON.stringify(block.sourceCounter))
      ) {
        lesson.conflict =
          "Izvor je promenjen; sačuvana je vaša lokalna izmena.";
        block.issue = lesson.conflict;
      }
      lesson.sourceId = block.id;
      lesson.sourceMissing = false;
      continue;
    }
    const student = s.students.find((st) => st.id === block.studentId),
      teacher = s.employees.find((e) => e.id === block.teacherId && e.active);
    if (!student || !teacher) {
      block.issue = "Učenik ili aktivni predavač nije pronađen.";
      continue;
    }
    const base = {
        teacherId: teacher.id,
        mode: "in_person" as const,
        duration: importedDuration(
          block.duration,
          block.sourceCounter?.numbers.length ?? lesson?.units ?? 1,
          s.sync.roundDurations !== false,
        ),
      },
      quote = lessonQuote(s.rules, base, student, teacher);
    const termsChanged =
      lesson &&
      (lesson.duration !== base.duration || lesson.mode !== base.mode);
    const next: Lesson = {
      ...lesson,
      id: lesson?.id ?? id(),
      studentId: student.id,
      ...base,
      units: block.sourceCounter?.numbers.length ?? lesson?.units ?? 1,
      sourceCounter: block.sourceCounter,
      date: block.date,
      start: block.start,
      desk: block.desk,
      topic: lesson?.topic ?? "",
      status: lesson?.status ?? "scheduled",
      price: lesson?.priceManual
        ? lesson.price
        : !lesson || termsChanged || lesson.price === null
          ? quote.price
          : lesson.price,
      bossBps: lesson?.bossManual
        ? lesson.bossBps
        : !lesson || termsChanged || lesson.bossBps === null
          ? quote.bossBps
          : lesson.bossBps,
      ruleId: lesson?.ruleId ?? quote.ruleId,
      shared: false,
      createdAt: lesson?.createdAt ?? now,
      updatedAt: now,
      sourceId: block.id,
      sourceMissing: false,
      importedDuration:
        base.duration !== block.duration
          ? { original: block.duration, rounded: base.duration }
          : undefined,
    };
    next.conflict = schedulingIssue(s, next) ?? undefined;
    if (next.conflict) block.issue = next.conflict;
    if (!student.ownerIds.includes(teacher.id))
      student.ownerIds.push(teacher.id);
    if (lesson) {
      if (
        JSON.stringify({ ...lesson, updatedAt: "" }) !==
        JSON.stringify({ ...next, updatedAt: "" })
      ) {
        s.lessons[s.lessons.indexOf(lesson)] = next;
        audit(s, "google", "Uvezen promenjen termin", next.id, lesson, next);
      }
    } else {
      s.lessons.push(next);
      audit(s, "google", "Uvezena rezervacija", next.id, null, next);
    }
  }
  const missing = old
    .filter(
      (b) =>
        !mapped.some((n) => n.id === b.id && n.text === b.text) &&
        !seen.has(b.id),
    )
    .map((b) => ({ ...b, missing: true }));
  for (const b of missing) {
    const l = s.lessons.find((l) => l.sourceId === b.id);
    if (l) {
      l.sourceMissing = true;
      l.conflict =
        "Rezervacija je uklonjena iz Google tabele; proverite termin.";
    }
  }
  s.sourceBlocks = [...mapped, ...missing];
  s.sync.lastSuccess = now;
  s.sync.lastError = null;
}
