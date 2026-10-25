import { z } from "zod";
import type {
  Employee,
  Lesson,
  SchoolState,
  SchoolView,
  Student,
  CounterEvent,
  RateRule,
} from "./types";
import { belgradeToday, belgradeMinute, lessonHasEnded } from "./time";
import { clock, dateLabel } from "./time";
import {
  lessonUnits,
  lessonCounterDetails,
  lessonOrder,
} from "./lesson-counters";
import { resolveDesk } from "./scheduling-preview";
import { isStaffColor, isMarkoNedic } from "./staff-colors";
import { applyDurationRounding } from "./duration-rounding";
import {
  allowedDuration,
  isManojlo,
  lessonQuote,
  matchingRule,
} from "./pricing";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const id = () => crypto.randomUUID();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T12:00Z").toISOString().slice(0, 10) === v,
    "Neispravan datum.",
  );
const cents = z.number().int().min(0).max(100_000_000);
const lessonSchema = z
  .object({
    id: z.string().optional(),
    studentId: z.string().min(1),
    teacherId: z.string().min(1),
    date: dateSchema,
    start: z.number().int().min(0).max(1439),
    duration: z.number().int().min(1).max(1440),
    units: z.number().int().min(1).max(20).default(1),
    desk: z.union([z.literal(1), z.literal(2), z.null()]),
    mode: z.enum(["in_person", "online"]),
    topic: z.string().max(3000),
    price: cents.nullable(),
    bossBps: z.number().int().min(0).max(10000).nullable(),
    priceManual: z.boolean().default(false),
    bossManual: z.boolean().default(false),
    university: z.boolean().optional(),
    referral: z.boolean().optional(),
    shared: z.boolean(),
    counterOverride: z
      .object({
        numbers: z.array(z.number().int().min(1).max(200)),
        size: z.number().int().min(1).max(200),
        propagate: z.boolean().default(true),
      })
      .optional()
      .nullable(),
  })
  .refine(
    (l) => l.start >= 360,
    "Čas mora početi od 06:00.",
  )
  .refine(
    (l) => l.duration % l.units === 0,
    "Trajanje mora imati cele minute po času.",
  );
const studentSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  level: z.string().trim().max(100),
  university: z.boolean().optional(),
  subject: z.string().trim().max(120),
  channel: z.enum(["referral", "direct", "other"]),
  packageSize: z.number().int().min(1).max(200).default(4),
  referralNote: z.string().trim().max(1000).optional(),
  otherNote: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(6000).optional(),
});
const employeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.email(), z.literal("")]).transform((v) => v.toLowerCase()),
  role: z.enum(["admin", "teacher"]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((v) => v.toLowerCase())
    .refine(isStaffColor, "Izaberite jednu od 20 ponuđenih boja."),
  canSetPrice: z.boolean(),
  canScheduleOthers: z.boolean().default(true),
  active: z.boolean(),
});
const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  priority: z.number().int().min(0).max(100000),
  active: z.boolean(),
  teacherId: z.string().nullable(),
  duration: z
    .number()
    .int()
    .refine(allowedDuration, "Izaberite 45, 60, 90 ili 120 minuta.")
    .nullable(),
  mode: z.enum(["in_person", "online"]).nullable(),
  level: z.string().max(100).nullable(),
  channel: z.enum(["referral", "direct", "other"]).nullable(),
  price: cents,
  bossBps: z.number().int().min(0).max(10000),
});
export function readable(actor: Employee, lesson: Lesson) {
  return (
    lesson.teacherId === actor.id ||
    (actor.role === "admin" && (lesson.mode === "in_person" || lesson.shared))
  );
}
function financeReadable(actor: Employee, lesson: Lesson) {
  return (
    actor.active && (lesson.mode === "in_person" || readable(actor, lesson))
  );
}
function financeLesson(s: SchoolState, actor: Employee, lessonId: string) {
  const lesson = s.lessons.find((entry) => entry.id === lessonId);
  demand(lesson && financeReadable(actor, lesson));
  return lesson;
}
function demand(
  ok: unknown,
  message = "Nemate dozvolu za ovu radnju.",
  status = 403,
): asserts ok {
  if (!ok) throw new DomainError(message, status);
}
export function ownedLesson(s: SchoolState, actor: Employee, lessonId: string) {
  const l = s.lessons.find((l) => l.id === lessonId);
  demand(l && readable(actor, l));
  return l;
}
export function counter(s: SchoolState, studentId: string, details = lessonCounterDetails(s, true), through = belgradeMinute()) {
  const total = s.lessons
    .filter((l) => l.studentId === studentId && lessonHasEnded(l, through))
    .reduce((sum, l) => sum + lessonUnits(l), 0);
  return {
    total,
    cycle: details.current[studentId] ?? 0,
    cycleSize:
      details.currentSizes[studentId] ??
      s.students.find((st) => st.id === studentId)?.packageSize ??
      4,
  };
}
export function financial(s: SchoolState, l: Lesson) {
  const paid = s.payments
    .filter((p) => p.lessonId === l.id && !p.voidedAt)
    .reduce((a, p) => a + p.amount, 0);
  const handed = s.handovers
    .filter((h) => h.lessonId === l.id && h.confirmed && !h.voidedAt)
    .reduce((a, h) => a + h.amount, 0);
  const boss =
    l.price !== null && l.bossBps !== null
      ? Math.round((l.price * l.bossBps) / 10000)
      : null;
  return {
    paid,
    handed,
    boss,
    teacher: boss === null ? null : l.price! - boss,
    studentBalance: l.price === null ? null : l.price - paid,
    bossBalance: isManojlo(s.employees.find((e) => e.id === l.teacherId))
      ? 0
      : boss === null
        ? null
        : boss - handed,
  };
}
export function selectRule(
  s: SchoolState,
  l: Pick<Lesson, "teacherId" | "mode" | "duration">,
  student: Student,
): RateRule | undefined {
  return matchingRule(s.rules, l, student);
}
export function schedulingIssue(s: SchoolState, l: Lesson) {
  if (l.status === "cancelled" || l.deletedAt) return null;
  const others = s.lessons.filter(
    (o) =>
      o.id !== l.id &&
      o.status !== "cancelled" &&
      !o.deletedAt &&
      o.date === l.date &&
      o.start < l.start + l.duration &&
      o.start + o.duration > l.start,
  );
  if (others.some((o) => o.teacherId === l.teacherId))
    return "Predavač već ima čas u ovom terminu.";
  if (others.some((o) => o.studentId === l.studentId))
    return "Učenik već ima čas u ovom terminu.";
  if (
    l.mode === "in_person" &&
    others.some((o) => o.mode === "in_person" && o.desk === l.desk)
  )
    return "Prostorija je popunjena u ovom terminu. Izaberite drugo vreme.";
  return null;
}
function reservationChanged(a: Lesson | undefined, b: Lesson | undefined) {
  const activeA = !!a && !a.deletedAt && a.status !== "cancelled";
  const activeB = !!b && !b.deletedAt && b.status !== "cancelled";
  if (activeA !== activeB) return true;
  if (!a || !b || !activeA) return false;
  return (
    a.date !== b.date ||
    a.start !== b.start ||
    a.duration !== b.duration ||
    a.desk !== b.desk ||
    a.mode !== b.mode ||
    a.teacherId !== b.teacherId ||
    a.studentId !== b.studentId
  );
}
export function project(
  s: SchoolState,
  actor: Employee,
  demo = false,
): SchoolView {
  const { watchToken: _secret, ...safeSync } = s.sync;
  const ordinals = lessonCounterDetails(s).lessons;
  const completedCounters = lessonCounterDetails(s, true);
  const through = belgradeMinute();
  const visible = s.lessons.filter((l) => readable(actor, l));
  const visibleIds = new Set(visible.map((l) => l.id));
  const financeLessons = s.lessons.filter((lesson) =>
    financeReadable(actor, lesson),
  );
  const financeIds = new Set(financeLessons.map((lesson) => lesson.id));
  const financeActions = new Set([
    "Čas označen kao plaćen",
    "Poništena oznaka plaćenog časa",
    "Potvrđen Manojlov deo",
    "Poništena predaja Manojlovog dela",
    "Evidentirana uplata",
    "Evidentirana predaja",
    "Potvrđena predaja novca",
  ]);
  const studentIds = new Set(visible.map((l) => l.studentId));
  const students = s.students
    .filter((st) =>
      actor.role === "admin"
        ? s.lessons.some((l) => l.studentId === st.id && readable(actor, l)) ||
          st.ownerIds.includes(actor.id)
        : st.ownerIds.includes(actor.id) || studentIds.has(st.id),
    )
    .map((st) => ({
      ...st,
      ownerIds: st.ownerIds.filter(
        (x) => x === actor.id || actor.role === "admin",
      ),
      ...counter(s, st.id, completedCounters, through),
      createdAt: st.createdAt ?? studentCreatedAt(s, st.id),
    }));
  const lessons = s.lessons
    .filter(
      (l) =>
        (l.mode === "in_person" || readable(actor, l)) &&
        (readable(actor, l) || (!l.deletedAt && l.status !== "cancelled")),
    )
    .map((l) =>
      readable(actor, l)
        ? {
            ...l,
            cycleNumbers: ordinals[l.id]?.numbers ?? [],
            cycleSize: ordinals[l.id]?.size,
          }
        : {
            id: l.id,
            studentName:
              s.students.find((st) => st.id === l.studentId)?.name ?? "Čas",
            teacherId: l.teacherId,
            date: l.date,
            start: l.start,
            duration: l.duration,
            desk: l.desk,
            mode: l.mode,
            restricted: true as const,
          },
    );
  const undoEntry = [...(s.undoEntries ?? [])]
      .reverse()
      .find((e) => e.actorId === actor.id && !e.undone),
    redoEntry = (s.undoEntries ?? []).find(
      (e) => e.actorId === actor.id && e.undone && e.redoable,
    );
  const safeUndoLabel = (entry: typeof undoEntry) =>
    entry &&
    entry.changes
      .filter((c) => c.collection === "lessons")
      .every((c) => {
        const lesson = s.lessons.find((l) => l.id === c.id);
        return !lesson || readable(actor, lesson);
      })
      ? describeUndo(s, entry)
      : null;
  return {
    revision: s.revision,
    roundImportedDurations: s.sync.roundDurations !== false,
    actor,
    employees: s.employees.map((e) =>
      actor.role === "admin" || e.id === actor.id
        ? e
        : {
            ...e,
            email: "",
            contactEmail: undefined,
            preferences: undefined,
            canSetPrice: false,
          },
    ),
    students,
    lessons,
    financeLessons: financeLessons.map((lesson) => ({
      ...lesson,
      studentName:
        s.students.find((student) => student.id === lesson.studentId)?.name ??
        "Učenik",
    })),
    rules:
      actor.role === "admin"
        ? s.rules
        : s.rules.filter((r) => !r.teacherId || r.teacherId === actor.id),
    payments: s.payments.filter((p) => financeIds.has(p.lessonId)),
    handovers: s.handovers.filter(
      (h) =>
        financeIds.has(h.lessonId) ||
        (actor.role === "admin" && h.confirmed) ||
        h.teacherId === actor.id,
    ),
    attachments: [], // Legacy response field; file uploads have been removed.
    audits: s.audits
      .filter(
        (a) =>
          visibleIds.has(a.entityId) ||
          (financeIds.has(a.entityId) && financeActions.has(a.action)) ||
          students.some((st) => st.id === a.entityId) ||
          (actor.role === "admin" &&
            s.employees.some((e) => e.id === a.entityId)),
      )
      .slice(-200)
      .reverse(),
    sourceBlocks: s.sourceBlocks.map((b) =>
      actor.role === "admin" || b.teacherId === actor.id
        ? b
        : {
            ...b,
            text: b.studentName ?? b.text,
            studentId: undefined,
            sourceCounter: undefined,
            issue: undefined,
          },
    ),
    sync:
      actor.role === "admin"
        ? safeSync
        : {
            ...safeSync,
            spreadsheetId: "",
            colorMap: {},
            studentMap: {},
            watchId: undefined,
            resourceId: undefined,
          },
    demo,
    messages: s.messages ?? [],
    undoLabel: safeUndoLabel(undoEntry),
    redoLabel: safeUndoLabel(redoEntry),
  };
}
export function audit(
  s: SchoolState,
  actorId: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  s.audits.push({
    id: id(),
    actorId,
    action,
    entityId,
    at: new Date().toISOString(),
    before: structuredClone(before ?? null),
    after: structuredClone(after ?? null),
  });
}
export function studentCreatedAt(s: SchoolState, studentId: string) {
  return s.audits
    .filter(
      (a) =>
        a.entityId === studentId &&
        a.action === "Sačuvan učenik" &&
        a.before === null,
    )
    .sort((a, b) => a.at.localeCompare(b.at))[0]?.at;
}
export function execute(
  s: SchoolState,
  actor: Employee,
  raw: unknown,
): { warning?: string; entityId?: string } {
  demand(actor.active);
  const c = z.object({ type: z.string(), payload: z.unknown() }).parse(raw);
  const now = new Date().toISOString();
  if (c.type === "undo") {
    undoLast(s, actor);
    return {};
  }
  if (c.type === "redo") {
    redoLast(s, actor);
    return {};
  }
  if (c.type === "setImportRounding") {
    demand(actor.role === "admin");
    const { enabled } = z.object({ enabled: z.boolean() }).parse(c.payload);
    const before = s.sync.roundDurations !== false;
    s.sync.roundDurations = enabled;
    applyDurationRounding(s, enabled, actor.id);
    audit(
      s,
      actor.id,
      "Promenjeno zaokruživanje uvezenih časova",
      actor.id,
      before,
      enabled,
    );
    return {
      warning: enabled
        ? "Zaokruživanje je uključeno. Trajanja i automatske cene su usklađeni."
        : "Zaokruživanje je isključeno. Vraćena su izvorna trajanja.",
    };
  }
  if (
    [
      "postMessage",
      "editMessage",
      "deleteMessage",
      "likeMessage",
      "pinMessage",
    ].includes(c.type)
  ) {
    const input = z
      .object({
        id: z.string().optional(),
        text: z.string().trim().min(1).max(6000).optional(),
        replyTo: z.string().optional(),
        liked: z.boolean().optional(),
      })
      .parse(c.payload);
    s.messages ??= [];
    if (c.type === "postMessage") {
      demand(input.text, "Unesite poruku.", 400);
      if (input.replyTo)
        demand(
          s.messages.some((m) => m.id === input.replyTo && !m.deletedAt),
          "Poruka za odgovor nije dostupna.",
          404,
        );
      const message = {
        id: id(),
        authorId: actor.id,
        text: input.text,
        createdAt: now,
        likedBy: [],
        pinned: false,
        replyTo: input.replyTo,
      };
      s.messages.push(message);
      return { entityId: message.id };
    }
    const message = s.messages.find((m) => m.id === input.id && !m.deletedAt);
    demand(message, "Poruka nije pronađena.", 404);
    if (c.type === "likeMessage") {
      const liked = input.liked ?? !message.likedBy.includes(actor.id);
      message.likedBy = liked
        ? [...new Set([...message.likedBy, actor.id])]
        : message.likedBy.filter((v) => v !== actor.id);
    }
    if (c.type === "pinMessage") message.pinned = !message.pinned;
    if (c.type === "editMessage" || c.type === "deleteMessage") {
      demand(
        message.authorId === actor.id ||
          (c.type === "deleteMessage" && actor.role === "admin"),
      );
      if (c.type === "deleteMessage") {
        message.deletedAt = now;
        message.pinned = false;
      } else {
        demand(input.text, "Unesite poruku.", 400);
        message.text = input.text;
        message.editedAt = now;
      }
    }
    return {};
  }
  if (c.type === "setPackage") {
    const input = z
      .object({
        studentId: z.string(),
        packageSize: z.number().int().min(1).max(200),
      })
      .parse(c.payload);
    const student = s.students.find((st) => st.id === input.studentId);
    demand(
      student && project(s, actor).students.some((st) => st.id === student.id),
    );
    const before = structuredClone(student);
    student.packageSize = input.packageSize;
    audit(
      s,
      actor.id,
      "Promenjena veličina paketa",
      student.id,
      before,
      student,
    );
    return {};
  }
  if (c.type === "correctLessonCounter") {
    const input = z
      .object({
        lessonId: z.string(),
        unit: z.number().int().min(0).max(19).default(0),
        number: z.number().int().min(1).max(200),
        size: z.number().int().min(1).max(200),
        scope: z.enum(["only", "future", "previous"]),
      })
      .parse(c.payload);
    demand(
      input.number <= input.size,
      "Broj časa ne može biti veći od paketa.",
      400,
    );
    const anchor = ownedLesson(s, actor, input.lessonId);
    demand(
      !anchor.deletedAt &&
        anchor.status !== "cancelled" &&
        input.unit < lessonUnits(anchor),
      "Izaberite aktivan čas.",
      400,
    );
    const timeline = s.lessons
      .filter(
        (l) =>
          l.studentId === anchor.studentId &&
          !l.deletedAt &&
          l.status !== "cancelled",
      )
      .sort((a, b) => lessonOrder(a).localeCompare(lessonOrder(b)));
    const anchorIndex = timeline.indexOf(anchor);
    const currentCounters = lessonCounterDetails(s).lessons;
    const affected = timeline.filter((_, i) =>
      input.scope === "only"
        ? i === anchorIndex
        : input.scope === "future"
          ? i >= anchorIndex
          : i <= anchorIndex,
    );
    demand(
      affected.every((l) => readable(actor, l)),
      "Korekcija obuhvata časove kojima nemate pristup. Izaberite samo ovaj čas ili zamolite Manojla/predavača za korekciju.",
    );
    let offset =
      -timeline
        .slice(0, anchorIndex)
        .reduce((sum, l) => sum + lessonUnits(l), 0) - input.unit;
    for (const lesson of timeline) {
      if (affected.includes(lesson)) {
        const before = structuredClone(lesson);
        lesson.counterOverride = {
          numbers:
            input.scope === "future" && lesson !== anchor
              ? []
              : Array.from({ length: lessonUnits(lesson) }, (_, i) =>
                  Math.max(1, Math.min(input.size, input.number + offset + i)),
                ),
          size: input.size,
          propagate: input.scope === "future",
          follow: input.scope === "future" && lesson !== anchor,
          baseline:
            input.scope !== "future" ? currentCounters[lesson.id] : undefined,
        };
        lesson.updatedAt = now;
        if (lesson.sourceId) lesson.localOverride = true;
        audit(s, actor.id, "Ispravljen brojač časa", lesson.id, before, lesson);
      }
      offset += lessonUnits(lesson);
    }
    return {};
  }
  if (c.type === "correctStudentCounter") {
    const input = z
      .object({
        studentId: z.string(),
        number: z.number().int().min(0).max(200),
        size: z.number().int().min(1).max(200),
      })
      .parse(c.payload);
    const student = s.students.find((st) => st.id === input.studentId);
    demand(
      student && project(s, actor).students.some((st) => st.id === student.id),
    );
    demand(
      input.number <= input.size,
      "Broj časa ne može biti veći od paketa.",
      400,
    );
    const before = structuredClone(student);
    student.packageSize = input.size;
    s.counters.push({
      id: id(),
      studentId: student.id,
      type: "set",
      value: input.number,
      size: input.size,
      lessonId: null,
      actorId: actor.id,
      at: now,
    });
    audit(
      s,
      actor.id,
      "Ispravljen trenutni brojač učenika",
      student.id,
      before,
      input,
    );
    return {};
  }
  if (c.type === "deleteLessons") {
    const input = z
      .object({ ids: z.array(z.string()).min(1).max(200) })
      .parse(c.payload);
    const lessons = [...new Set(input.ids)].map((key) =>
      ownedLesson(s, actor, key),
    );
    demand(
      lessons.every((l) => !l.deletedAt),
      "Čas je već obrisan.",
      409,
    );
    for (const lesson of lessons) {
      const before = structuredClone(lesson);
      lesson.deletedAt = now;
      lesson.status = "cancelled";
      lesson.updatedAt = now;
      if (lesson.sourceId) lesson.localOverride = true;
      s.counters = s.counters.filter((e) => e.lessonId !== lesson.id);
      audit(s, actor.id, "Obrisan čas", lesson.id, before, lesson);
    }
    return {};
  }
  if (c.type === "moveLessons") {
    const input = z
      .object({
        moves: z
          .array(
            z.object({
              id: z.string(),
              date: dateSchema,
              start: z.number().int(),
              desk: z.union([z.literal(1), z.literal(2), z.null()]),
              mode: z.enum(["in_person", "online"]),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(c.payload);
    demand(
      new Set(input.moves.map((m) => m.id)).size === input.moves.length,
      "Čas je naveden više puta.",
      400,
    );
    const next = structuredClone(s),
      originals = input.moves.map((m) => ownedLesson(s, actor, m.id));
    demand(
      originals.every((l) => !l.deletedAt),
      "Obrisani čas se ne može pomerati.",
      409,
    );
    next.lessons = next.lessons.filter(
      (l) => !input.moves.some((m) => m.id === l.id),
    );
    for (let index = 0; index < input.moves.length; index++) {
      const original = originals[index],
        move = input.moves[index];
      next.lessons.push({ ...original, ...move });
    }
    let warning: string | undefined;
    for (let index = 0; index < input.moves.length; index++) {
      const original = originals[index],
        move = input.moves[index];
      const result = execute(next, actor, {
        type: "saveLesson",
        payload: {
          ...original,
          ...move,
          shared: move.mode === original.mode ? original.shared : false,
        },
      });
      warning = result.warning ?? warning;
    }
    Object.assign(s, next);
    return { warning };
  }
  if (c.type === "saveLessonDraft") {
    const input = z
      .object({
        student: studentSchema,
        lesson: z.record(z.string(), z.unknown()),
      })
      .parse(c.payload);
    const next = structuredClone(s),
      student = execute(next, actor, {
        type: "saveStudent",
        payload: input.student,
      });
    const result = execute(next, actor, {
      type: "saveLesson",
      payload: { ...input.lesson, studentId: student.entityId },
    });
    Object.assign(s, next);
    return result;
  }
  if (c.type === "quickLesson") {
    const input = z
      .object({
        name: z.string().trim().min(1).max(160),
        studentId: z.string().optional(),
        date: dateSchema,
        start: z.number().int(),
        desk: z.union([z.literal(1), z.literal(2), z.null()]),
      })
      .parse(c.payload);
    const matches = project(s, actor).students.filter(
      (st) => st.name.toLocaleLowerCase() === input.name.toLocaleLowerCase(),
    );
    if (input.studentId)
      demand(
        project(s, actor).students.some((st) => st.id === input.studentId),
      );
    else
      demand(
        matches.length < 2,
        "Više učenika ima to ime. Izaberite učenika iz predloga.",
        409,
      );
    const studentId =
      input.studentId ??
      matches[0]?.id ??
      execute(s, actor, {
        type: "saveStudent",
        payload: {
          name: input.name,
          level: "",
          subject: "Matematika",
          channel: "direct",
        },
      }).entityId!;
    return execute(s, actor, {
      type: "saveLesson",
      payload: {
        studentId,
        teacherId: actor.id,
        date: input.date,
        start: input.start,
        duration: 45,
        desk: input.desk,
        mode: input.desk === null ? "online" : "in_person",
        topic: "",
        status: "scheduled",
        price: null,
        bossBps: null,
        shared: input.desk === null ? true : false,
      },
    });
  }
  if (c.type === "saveLesson") {
    const input = lessonSchema.parse(c.payload);
    const existing = input.id
      ? s.lessons.find((l) => l.id === input.id)
      : undefined;
    demand(
      input.units === 1 &&
        (allowedDuration(input.duration) ||
          (existing &&
            existing.duration === input.duration &&
            (existing.units ?? 1) === 1)),
      "Izaberite trajanje: 45, 60, 90 ili 120 minuta.",
      400,
    );
    input.desk = resolveDesk(s.lessons, { ...input, studentName: "" });
    const old = input.id ? s.lessons.find((l) => l.id === input.id) : undefined;
    if (input.id) demand(old, "Čas nije pronađen.", 404);
    demand(
      !old?.deletedAt,
      "Obrisani čas prvo vratite pomoću dugmeta Poništi.",
      409,
    );
    if (old) demand(readable(actor, old));
    if (old && old.studentId !== input.studentId)
      demand(
        !s.payments.some((p) => p.lessonId === old.id) &&
          !s.handovers.some((h) => h.lessonId === old.id),
        "Čas sa evidentiranim novcem ne može se prevezati na drugog učenika.",
        409,
      );
    if (old && old.teacherId !== input.teacherId)
      demand(
        !s.payments.some((p) => p.lessonId === old.id) &&
          !s.handovers.some((h) => h.lessonId === old.id),
        "Čas sa evidentiranim novcem ne može se dodeliti drugom predavaču.",
        409,
      );
    demand(
      actor.role === "admin" ||
        input.teacherId === actor.id ||
        (!old && actor.canScheduleOthers !== false),
    );
    const teacher = s.employees.find(
      (e) => e.id === input.teacherId && e.active,
    );
    demand(teacher, "Izaberite aktivnog predavača.", 400);
    const student = s.students.find((st) => st.id === input.studentId);
    demand(student, "Izaberite učenika.", 400);
    demand(
      actor.role === "admin" ||
        student.ownerIds.includes(actor.id) ||
        (!!old && old.studentId === student.id),
    );
    if (
      old &&
      old.teacherId !== actor.id &&
      input.mode === "online" &&
      input.shared !== (old.mode === "online" ? old.shared : false)
    )
      demand(false, "Samo predavač tog časa može da menja deljenje.");
    if (!old && input.teacherId !== actor.id && actor.role !== "admin" && input.mode === "online")
      input.shared = false;
    const quote = lessonQuote(s.rules, input, student, teacher);
    const originalQuote = old
      ? lessonQuote(s.rules, old, student, teacher)
      : null;
    const sameTerms =
      !!old &&
      old.duration === input.duration &&
      old.mode === input.mode &&
      old.teacherId === input.teacherId &&
      old.studentId === input.studentId &&
      originalQuote?.price === quote.price &&
      originalQuote?.bossBps === quote.bossBps;
    let price = input.priceManual
      ? input.price
      : sameTerms && old.price !== null && !old.priceManual
        ? old.price
        : quote.price;
    let bossBps = input.bossManual
      ? input.bossBps
      : sameTerms && old.bossBps !== null && !old.bossManual
        ? old.bossBps
        : quote.bossBps;
    if (isManojlo(teacher)) {
      bossBps = 10000;
      input.bossManual = false;
    }
    if (input.priceManual)
      demand(price !== null, "Unesite cenu ili vratite automatsku cenu.", 400);
    if (input.bossManual)
      demand(
        bossBps !== null,
        "Unesite procenat ili vratite automatski obračun.",
        400,
      );
    if (actor.role !== "admin") {
      if (!teacher.canSetPrice || !actor.canSetPrice)
        demand(
          !input.priceManual ||
            (!!old?.priceManual && input.price === old.price),
          "Manojlo je isključio ručnu promenu cene.",
        );
      if (!isManojlo(teacher) && (input.bossManual || old?.bossManual))
        demand(
          input.bossManual === !!old?.bossManual &&
            input.bossBps === old?.bossBps,
          "Manojlov procenat ručno menja samo administrator.",
        );
    }
    const lesson: Lesson = {
      ...old,
      ...input,
      id: old?.id ?? id(),
      status: "scheduled",
      price,
      bossBps,
      ruleId: sameTerms ? old.ruleId : quote.ruleId,
      desk: input.mode === "online" ? null : input.desk,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      localOverride: old?.sourceId ? true : undefined,
      importedDuration:
        old && old.duration === input.duration
          ? old.importedDuration
          : undefined,
      counterOverride:
        input.counterOverride !== undefined
          ? (input.counterOverride ?? undefined)
          : old?.counterOverride,
    };
    if (input.counterOverride?.size) {
      student.packageSize = input.counterOverride.size;
    }
    demand(
      lesson.mode !== "in_person" || lesson.desk !== null,
      "Izaberite sto.",
      400,
    );
    const issue = schedulingIssue(s, lesson);
    demand(!issue, issue ?? "Termin nije dostupan.", 409);
    lesson.conflict = undefined;
    if (old) s.lessons[s.lessons.indexOf(old)] = lesson;
    else s.lessons.push(lesson);
    if (!student.ownerIds.includes(lesson.teacherId))
      student.ownerIds.push(lesson.teacherId);
    audit(s, actor.id, "Sačuvan čas", lesson.id, old, lesson);
    return {
      entityId: lesson.id,
      warning: undefined,
    };
  }
  if (c.type === "saveStudent") {
    const input = studentSchema.parse(c.payload),
      old = s.students.find((st) => st.id === input.id);
    if (input.id)
      demand(
        old && (actor.role === "admin" || old.ownerIds.includes(actor.id)),
      );
    const st: Student = {
      ...old,
      ...input,
      id: old?.id ?? id(),
      ownerIds: old?.ownerIds ?? [actor.id],
      createdAt: old ? (old.createdAt ?? studentCreatedAt(s, old.id)) : now,
      referralNote: input.referralNote ?? old?.referralNote ?? "",
      otherNote: input.otherNote ?? old?.otherNote ?? "",
      notes: input.notes ?? old?.notes ?? "",
    };
    if (old) s.students[s.students.indexOf(old)] = st;
    else s.students.push(st);
    if (
      old &&
      (old.level !== st.level ||
        old.university !== st.university ||
        old.channel !== st.channel)
    ) {
      for (const lesson of s.lessons.filter(
        (l) =>
          l.studentId === st.id && !l.deletedAt && l.status !== "cancelled",
      )) {
        if (
          s.payments.some((p) => p.lessonId === lesson.id) ||
          s.handovers.some((h) => h.lessonId === lesson.id)
        )
          continue;
        const before = structuredClone(lesson),
          quote = lessonQuote(
            s.rules,
            lesson,
            st,
            s.employees.find((e) => e.id === lesson.teacherId),
          );
        if (!lesson.priceManual) lesson.price = quote.price;
        if (!lesson.bossManual) lesson.bossBps = quote.bossBps;
        lesson.ruleId = quote.ruleId;
        if (
          before.price !== lesson.price ||
          before.bossBps !== lesson.bossBps
        ) {
          lesson.updatedAt = now;
          audit(
            s,
            actor.id,
            "Preračunat čas prema podacima učenika",
            lesson.id,
            before,
            lesson,
          );
        }
      }
    }
    audit(s, actor.id, "Sačuvan učenik", st.id, old, st);
    return { entityId: st.id };
  }
  if (c.type === "saveProfile") {
    const input = z
      .object({
        name: z.string().trim().min(2).max(120),
        contactEmail: z
          .union([z.email(), z.literal("")])
          .transform((value) => value.toLowerCase()),
        color: z
          .string()
          .toLowerCase()
          .refine(isStaffColor, "Izaberite jednu od ponuđenih boja."),
        preferences: z.object({
          notifications: z.boolean(),
          sound: z.boolean(),
        }),
      })
      .parse(c.payload);
    const employee = s.employees.find((entry) => entry.id === actor.id);
    demand(employee && employee.active);
    demand(
      !s.employees.some(
        (entry) => entry.id !== employee.id && entry.color === input.color && !isMarkoNedic(entry),
      ),
      "Tu boju već koristi drugi zaposleni.",
      409,
    );
    const before = structuredClone(employee);
    Object.assign(employee, input);
    audit(s, actor.id, "Sačuvan profil", employee.id, before, employee);
    return { entityId: employee.id };
  }
  if (c.type === "setEmployeePermission") {
    demand(actor.role === "admin");
    const input = z
      .object({
        id: z.string(),
        key: z.enum(["canSetPrice", "canScheduleOthers"]),
        enabled: z.boolean(),
      })
      .parse(c.payload);
    const employee = s.employees.find((entry) => entry.id === input.id);
    demand(employee, "Predavač nije pronađen.", 404);
    const before = structuredClone(employee);
    employee[input.key] = input.enabled;
    if (before[input.key] !== input.enabled)
      audit(s, actor.id, "Sačuvan zaposleni", employee.id, before, employee);
    return { entityId: employee.id };
  }
  if (c.type === "saveEmployee") {
    demand(actor.role === "admin");
    const input = employeeSchema.parse(c.payload),
      old = s.employees.find((e) => e.id === input.id);
    if (input.id) demand(old, "Predavač nije pronađen.", 404);
    demand(
      !s.employees.some(
        (e) =>
          e.id !== old?.id &&
          ((!!input.email && e.email.toLowerCase() === input.email) ||
            (e.color.toLowerCase() === input.color && !isMarkoNedic(e))),
      ),
      "Imejl ili boja već pripada drugom zaposlenom.",
      409,
    );
    demand(
      !(old?.id === actor.id && (!input.active || input.role !== "admin")),
      "Ne možete isključiti svoj administratorski nalog.",
      400,
    );
    const e = { ...old, ...input, id: old?.id ?? id() };
    if (old) s.employees[s.employees.indexOf(old)] = e;
    else s.employees.push(e);
    audit(s, actor.id, "Sačuvan zaposleni", e.id, old, e);
    return { entityId: e.id };
  }
  if (c.type === "saveRule") {
    demand(actor.role === "admin");
    const input = ruleSchema.parse(c.payload),
      old = s.rules.find((r) => r.id === input.id);
    demand(
      !input.teacherId || s.employees.some((e) => e.id === input.teacherId),
      "Predavač nije pronađen.",
      400,
    );
    const r = { ...input, id: old?.id ?? id() };
    if (old) s.rules[s.rules.indexOf(old)] = r;
    else s.rules.push(r);
    audit(s, actor.id, "Sačuvano pravilo", r.id, old, r);
    return { entityId: r.id };
  }
  if (c.type === "setFinanceStatus") {
    const input = z
      .object({
        ids: z.array(z.string()).min(1).max(5000),
        field: z.enum(["paid", "handed"]),
        value: z.boolean(),
      })
      .parse(c.payload);
    const lessons = [...new Set(input.ids)].map((key) =>
      financeLesson(s, actor, key),
    );
    for (const lesson of lessons) {
      demand(
        !lesson.deletedAt && lesson.status !== "cancelled",
        "Obrisan čas nije moguće menjati.",
        409,
      );
      const balance = financial(s, lesson);
      const owner = isManojlo(
        s.employees.find((employee) => employee.id === lesson.teacherId),
      );
      if (input.field === "handed" && owner) continue;
      if (input.value)
        demand(
          input.field === "paid"
            ? lesson.price !== null
            : balance.boss !== null,
          "Najpre odredite cenu i procenat svih izabranih časova.",
          400,
        );
      const payments = s.payments.filter(
        (payment) => payment.lessonId === lesson.id && !payment.voidedAt,
      );
      const handovers = s.handovers.filter(
        (handover) => handover.lessonId === lesson.id && !handover.voidedAt,
      );
      const before = structuredClone(
        input.field === "paid" ? payments : handovers,
      );
      if (input.field === "paid") {
        if (input.value) {
          const remaining = Math.max(0, lesson.price! - balance.paid);
          if (remaining > 0)
            s.payments.push({
              id: id(),
              lessonId: lesson.id,
              amount: remaining,
              date: belgradeToday(),
              note: "Označeno kao plaćeno u obračunu",
              actorId: actor.id,
            });
        } else for (const payment of payments) payment.voidedAt = now;
      } else if (input.value) {
        for (const handover of handovers) {
          if (!handover.confirmed) {
            handover.confirmed = true;
            handover.confirmedBy = actor.id;
          }
        }
        const declared = handovers.reduce(
          (sum, handover) => sum + handover.amount,
          0,
        );
        const remaining = Math.max(0, balance.boss! - declared);
        if (remaining > 0)
          s.handovers.push({
            id: id(),
            lessonId: lesson.id,
            teacherId: lesson.teacherId,
            amount: remaining,
            date: belgradeToday(),
            confirmed: true,
            confirmedBy: actor.id,
            actorId: actor.id,
          });
      } else {
        for (const handover of handovers) handover.voidedAt = now;
      }
      const after = (input.field === "paid" ? s.payments : s.handovers).filter(
        (entry) => entry.lessonId === lesson.id,
      );
      const activeAfter = after.filter((entry) => !entry.voidedAt);
      if (JSON.stringify(before) !== JSON.stringify(activeAfter))
        audit(
          s,
          actor.id,
          input.field === "paid"
            ? input.value
              ? "Čas označen kao plaćen"
              : "Poništena oznaka plaćenog časa"
            : input.value
              ? "Potvrđen Manojlov deo"
              : "Poništena predaja Manojlovog dela",
          lesson.id,
          before,
          after,
        );
    }
    return {
      warning:
        input.field === "paid"
          ? "Evidencija uplata je ažurirana."
          : "Evidencija Manojlovog dela je ažurirana.",
    };
  }
  if (c.type === "payment" || c.type === "handover") {
    const input = z
      .object({
        lessonId: z.string(),
        amount: cents.refine((v) => v > 0, "Iznos mora biti veći od nule."),
        date: dateSchema,
        note: z.string().max(1000).optional(),
      })
      .parse(c.payload);
    const l = financeLesson(s, actor, input.lessonId);
    demand(
      l.price !== null && l.bossBps !== null,
      "Najpre odredite cenu i procenat.",
      400,
    );
    if (c.type === "payment")
      s.payments.push({
        id: id(),
        ...input,
        note: input.note ?? "",
        actorId: actor.id,
      });
    else
      s.handovers.push({
        id: id(),
        lessonId: l.id,
        teacherId: l.teacherId,
        amount: input.amount,
        date: input.date,
        confirmed: true,
        confirmedBy: actor.id,
        actorId: actor.id,
      });
    audit(
      s,
      actor.id,
      c.type === "payment" ? "Evidentirana uplata" : "Evidentirana predaja",
      l.id,
      null,
      input,
    );
    return {};
  }
  if (c.type === "confirmHandover") {
    const input = z.object({ id: z.string() }).parse(c.payload),
      h = s.handovers.find((h) => h.id === input.id);
    demand(h && !h.voidedAt);
    financeLesson(s, actor, h.lessonId);
    if (!h.confirmed) {
      h.confirmed = true;
      h.confirmedBy = actor.id;
      audit(s, actor.id, "Potvrđena predaja novca", h.lessonId, null, h);
    }
    return {};
  }
  if (c.type === "counter") {
    const input = z
        .object({
          studentId: z.string(),
          action: z.enum(["increment", "reset"]),
        })
        .parse(c.payload),
      st = s.students.find((st) => st.id === input.studentId);
    demand(
      st &&
        (st.ownerIds.includes(actor.id) ||
          project(s, actor).students.some((x) => x.id === st.id)),
    );
    s.counters.push({
      id: id(),
      studentId: st.id,
      type: input.action,
      lessonId: null,
      actorId: actor.id,
      at: now,
    });
    audit(
      s,
      actor.id,
      input.action === "reset" ? "Resetovan ciklus" : "Povećan ciklus",
      st.id,
      null,
      input,
    );
    return {};
  }
  if (c.type === "syncSettings") {
    demand(actor.role === "admin");
    const input = z
      .object({
        spreadsheetId: z
          .string()
          .max(200)
          .regex(/^[a-zA-Z0-9_-]*$/),
        firstYear: z.number().int().min(2000).max(2100),
        colorMap: z.record(z.string().regex(/^#[a-fA-F0-9]{6}$/), z.string()),
        studentMap: z.record(z.string(), z.string()),
      })
      .parse(c.payload);
    demand(
      Object.values(input.colorMap).every((v) =>
        s.employees.some((e) => e.id === v),
      ),
      "Povežite boje sa postojećim predavačima.",
      400,
    );
    demand(
      Object.values(input.studentMap).every((v) =>
        s.students.some((st) => st.id === v),
      ),
      "Povežite izvorna imena sa postojećim učenicima.",
      400,
    );
    const changed = s.sync.spreadsheetId !== input.spreadsheetId;
    s.sync = {
      ...s.sync,
      ...input,
      ...(changed
        ? {
            watchId: undefined,
            watchToken: undefined,
            resourceId: undefined,
            watchExpires: undefined,
          }
        : {}),
    };
    return {};
  }
  if (c.type === "resolveSource") {
    demand(actor.role === "admin");
    const input = z
        .object({ blockId: z.string(), lessonId: z.string() })
        .parse(c.payload),
      block = s.sourceBlocks.find((b) => b.id === input.blockId),
      lesson = ownedLesson(s, actor, input.lessonId);
    demand(block, "Izvorni blok nije pronađen.", 404);
    demand(
      block.studentId === lesson.studentId &&
        block.teacherId === lesson.teacherId,
      "Povežite blok sa časom istog učenika i predavača.",
      409,
    );
    demand(
      !s.lessons.some((l) => l.id !== lesson.id && l.sourceId === block.id),
      "Blok je već povezan sa drugim časom.",
      409,
    );
    demand(
      !schedulingIssue(s, lesson),
      "Najpre razrešite preklapanje tog časa.",
      409,
    );
    const oldSource = lesson.sourceId;
    lesson.sourceId = block.id;
    lesson.localOverride = true;
    lesson.sourceMissing = !!block.missing;
    lesson.conflict = undefined;
    block.issue = undefined;
    if (oldSource !== block.id)
      s.sourceBlocks = s.sourceBlocks.filter(
        (b) => !(b.id === oldSource && b.missing),
      );
    audit(s, actor.id, "Ručno povezan izvorni blok", lesson.id, null, {
      blockId: block.id,
    });
    return {};
  }
  throw new DomainError("Nepoznata radnja.");
}
const UNDO_COLLECTIONS = [
  "employees",
  "students",
  "lessons",
  "rules",
  "payments",
  "handovers",
  "counters",
  "sourceBlocks",
  "messages",
] as const;
function describeUndo(
  s: SchoolState,
  entry: NonNullable<SchoolState["undoEntries"]>[number],
) {
  if (!/^[a-zA-Z]+$/.test(entry.label)) return entry.label;
  const changes = entry.changes.filter((c) => c.collection === "lessons");
  if (entry.label === "setImportRounding")
    return "zaokruživanje uvezenih časova";
  if (entry.label === "setFinanceStatus") {
    const payments = entry.changes.some(
      (change) => change.collection === "payments",
    );
    const ids = new Set(
      entry.changes
        .filter(
          (change) =>
            change.collection === "payments" ||
            change.collection === "handovers",
        )
        .map(
          (change) => (change.after ?? change.before) as { lessonId: string },
        )
        .map((entry) => entry.lessonId),
    );
    return `${payments ? "evidenciju uplata" : "predaju Manojlovog dela"} · ${ids.size} časova`;
  }
  if (entry.label === "correctLessonCounter" && changes.length) {
    const lesson = changes[0].after as Lesson;
    const name =
      s.students.find((st) => st.id === lesson.studentId)?.name ?? "učenik";
    return `ispravku brojača: ${name} · ${changes.length} ${changes.length === 1 ? "čas" : "časova"}`;
  }
  if (changes.length) {
    if (changes.length > 1)
      return `${entry.label === "deleteLessons" ? "brisanje" : changes.every((c) => !c.before) ? "dodavanje" : entry.label === "moveLessons" ? "pomeranje" : "izmenu"} ${changes.length} časa`;
    const c = changes[0],
      after = c.after as Lesson,
      before = c.before as Lesson | null;
    const name =
      s.students.find((st) => st.id === after.studentId)?.name ?? "čas";
    const action =
      entry.label === "deleteLessons"
        ? "brisanje"
        : !before
          ? "dodavanje"
          : before.start !== after.start ||
              before.date !== after.date ||
              before.desk !== after.desk ||
              before.mode !== after.mode
            ? "pomeranje"
            : before.duration !== after.duration
              ? "promenu trajanja"
              : "izmenu";
    return `${action}: ${name} · ${dateLabel(after.date)} ${clock(after.start)}–${clock(after.start + after.duration)}`;
  }
  const labels: Record<string, string> = {
    saveStudent: "izmenu učenika",
    setPackage: "promenu veličine paketa",
    correctLessonCounter: "ispravku brojača časova",
    correctStudentCounter: "ispravku trenutnog brojača učenika",
    counter: "korekciju brojača",
    payment: "evidentiranje uplate",
    handover: "predaju novca",
    confirmHandovers: "potvrdu predaje novca",
    saveEmployee: "izmenu zaposlenog",
    saveProfile: "izmenu profila i podešavanja",
    setEmployeePermission: "promenu dozvole zaposlenog",
    saveRule: "izmenu cenovnika",
    postMessage: "slanje poruke",
    editMessage: "izmenu poruke",
    deleteMessage: "brisanje poruke",
    likeMessage: "sviđanje poruke",
    pinMessage: "kačenje poruke",
    saveSync: "podešavanje sinhronizacije",
  };
  return labels[entry.label] ?? "poslednju izmenu";
}
export function snapshotForUndo(s: SchoolState): SchoolState {
  const before = { ...s, audits: [], undoEntries: [], operations: [], boardResetBackup: undefined };
  for (const collection of UNDO_COLLECTIONS) (before as any)[collection] = structuredClone(s[collection] ?? []);
  before.sync = structuredClone(s.sync);
  return before;
}
export function rememberUndo(
  s: SchoolState,
  before: SchoolState,
  actor: Employee,
  label: string,
) {
  if (label === "undo" || label === "redo") return;
  const changes: NonNullable<SchoolState["undoEntries"]>[number]["changes"] =
    [];
  for (const collection of UNDO_COLLECTIONS) {
    const old = (before[collection] ?? []) as { id: string }[],
      next = (s[collection] ?? []) as { id: string }[];
    for (const key of new Set([...old, ...next].map((v) => v.id))) {
      const a = old.find((v) => v.id === key) ?? null,
        b = next.find((v) => v.id === key) ?? null;
      if (JSON.stringify(a) !== JSON.stringify(b))
        changes.push({
          collection,
          id: key,
          before: structuredClone(a),
          after: structuredClone(b),
          beforeIndex: old.findIndex((v) => v.id === key),
        });
    }
  }
  if (JSON.stringify(before.sync) !== JSON.stringify(s.sync))
    changes.push({
      collection: "sync",
      id: "sync",
      before: structuredClone(before.sync),
      after: structuredClone(s.sync),
    });
  if (changes.length)
    s.undoEntries = [
      ...(s.undoEntries ?? []).map((e) =>
        e.actorId === actor.id && e.undone ? { ...e, redoable: false } : e,
      ),
      { id: id(), actorId: actor.id, label, undone: false, changes },
    ];
}
export function undoLast(s: SchoolState, actor: Employee) {
  const entry = [...(s.undoEntries ?? [])]
    .reverse()
    .find((e) => e.actorId === actor.id && !e.undone);
  demand(entry, "Nema izmene za poništavanje.", 409);
  for (const c of entry.changes) {
    const current =
      c.collection === "sync"
        ? s.sync
        : ((
            s[c.collection as (typeof UNDO_COLLECTIONS)[number]] as {
              id: string;
            }[]
          )?.find((v) => v.id === c.id) ?? null);
    demand(
      JSON.stringify(current) === JSON.stringify(c.after),
      "Podatak je naknadno promenjen. Poništavanje bi prepisalo noviju izmenu.",
      409,
    );
    if (["employees", "rules", "sync", "sourceBlocks"].includes(c.collection))
      demand(
        actor.role === "admin" ||
          (c.collection === "employees" &&
            entry.label === "saveProfile" &&
            c.id === actor.id),
      );
    if (c.collection === "payments" || c.collection === "handovers")
      financeLesson(
        s,
        actor,
        ((c.after ?? c.before) as { lessonId: string }).lessonId,
      );
    if (c.collection === "lessons" && current) {
      const l = current as Lesson;
      demand(readable(actor, l));
      if (c.before && (c.before as Lesson).price !== l.price)
        demand(
          actor.role === "admin" ||
            (actor.canSetPrice &&
              s.employees.find((e) => e.id === l.teacherId)?.canSetPrice),
        );
    }
  }
  const next = structuredClone(s),
    changedLessons: string[] = [];
  for (const c of entry.changes) {
    if (c.collection === "sync") {
      next.sync = structuredClone(c.before) as SchoolState["sync"];
      continue;
    }
    const list = next[c.collection as (typeof UNDO_COLLECTIONS)[number]] as {
        id: string;
      }[],
      index = list.findIndex((v) => v.id === c.id);
    if (c.before === null && c.collection === "lessons") {
      (list[index] as Lesson).status = "cancelled";
      changedLessons.push(c.id);
      continue;
    }
    if (
      c.before === null &&
      (c.collection === "payments" || c.collection === "handovers")
    ) {
      Object.assign(list[index], { voidedAt: new Date().toISOString() });
      continue;
    }
    if (
      c.before === null &&
      c.collection === "students" &&
      next.lessons.some((l) => l.studentId === c.id)
    )
      continue;
    if (c.before === null && c.collection === "employees")
      demand(
        !next.lessons.some((l) => l.teacherId === c.id),
        "Zaposleni već ima povezane časove.",
        409,
      );
    if (c.before === null) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0)
      list[index] = structuredClone(c.before) as { id: string };
    else
      list.splice(
        Math.min(c.beforeIndex ?? list.length, list.length),
        0,
        structuredClone(c.before) as { id: string },
      );
    if (c.collection === "lessons") changedLessons.push(c.id);
  }
  for (const key of changedLessons) {
    const l = next.lessons.find((l) => l.id === key);
    if (
      l &&
      reservationChanged(
        s.lessons.find((original) => original.id === key),
        l,
      )
    ) {
      const issue = schedulingIssue(next, l);
      demand(!issue, "Vraćanje bi napravilo preklapanje termina.", 409);
    }
  }
  if (entry.changes.some((c) => c.collection === "employees"))
    validateEmployeeColors(next.employees);
  next.undoEntries!.find((e) => e.id === entry.id)!.undone = true;
  const undone = next.undoEntries!.find((e) => e.id === entry.id)!;
  undone.redoable = true;
  undone.reverted = entry.changes.map((c) => ({
    collection: c.collection,
    id: c.id,
    value: structuredClone(
      c.collection === "sync"
        ? next.sync
        : ((
            next[c.collection as (typeof UNDO_COLLECTIONS)[number]] as
              { id: string }[] | undefined
          )?.find((v) => v.id === c.id) ?? null),
    ),
  }));
  audit(
    next,
    actor.id,
    "Poništena poslednja izmena",
    entry.changes.find((c) => c.collection === "lessons")?.id ?? actor.id,
    null,
    { undoId: entry.id, action: entry.label },
  );
  Object.assign(s, next);
}
export function redoLast(s: SchoolState, actor: Employee) {
  const entry = (s.undoEntries ?? []).find(
    (e) => e.actorId === actor.id && e.undone && e.redoable,
  );
  demand(entry && entry.reverted, "Nema radnje za ponavljanje.", 409);
  const next = structuredClone(s);
  for (const c of entry.changes) {
    const current =
      c.collection === "sync"
        ? s.sync
        : ((
            s[c.collection as (typeof UNDO_COLLECTIONS)[number]] as
              { id: string }[] | undefined
          )?.find((v) => v.id === c.id) ?? null);
    const expected = entry.reverted.find(
      (r) => r.collection === c.collection && r.id === c.id,
    )?.value;
    demand(
      JSON.stringify(current) === JSON.stringify(expected),
      "Podatak je naknadno promenjen. Ponavljanje bi prepisalo noviju izmenu.",
      409,
    );
    if (["employees", "rules", "sync", "sourceBlocks"].includes(c.collection))
      demand(
        actor.role === "admin" ||
          (c.collection === "employees" &&
            entry.label === "saveProfile" &&
            c.id === actor.id),
      );
    if (c.collection === "payments" || c.collection === "handovers")
      financeLesson(
        s,
        actor,
        ((c.after ?? c.before) as { lessonId: string }).lessonId,
      );
    if (c.collection === "lessons" && current) {
      const lesson = current as Lesson;
      demand(readable(actor, lesson));
      if (c.after && (c.after as Lesson).price !== lesson.price)
        demand(
          actor.role === "admin" ||
            (actor.canSetPrice &&
              s.employees.find((e) => e.id === lesson.teacherId)?.canSetPrice),
        );
    }
    if (c.collection === "sync") {
      next.sync = structuredClone(c.after) as SchoolState["sync"];
      continue;
    }
    if (c.collection === "messages") next.messages ??= [];
    const list = next[c.collection as (typeof UNDO_COLLECTIONS)[number]] as {
        id: string;
      }[],
      index = list.findIndex((v) => v.id === c.id);
    if (c.after === null) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0)
      list[index] = structuredClone(c.after) as { id: string };
    else list.push(structuredClone(c.after) as { id: string });
  }
  for (const c of entry.changes.filter((c) => c.collection === "lessons")) {
    const lesson = next.lessons.find((l) => l.id === c.id);
    if (
      lesson &&
      reservationChanged(
        s.lessons.find((original) => original.id === c.id),
        lesson,
      )
    )
      demand(
        !schedulingIssue(next, lesson),
        "Ponavljanje bi napravilo preklapanje termina.",
        409,
      );
  }
  if (entry.changes.some((c) => c.collection === "employees"))
    validateEmployeeColors(next.employees);
  const done = next.undoEntries!.find((e) => e.id === entry.id)!;
  done.undone = false;
  done.redoable = false;
  audit(
    next,
    actor.id,
    "Ponovljena izmena",
    entry.changes.find((c) => c.collection === "lessons")?.id ?? actor.id,
    null,
    { redoId: entry.id },
  );
  Object.assign(s, next);
}
function validateEmployeeColors(employees: Employee[]) {
  const colors = employees.filter((e) => !isMarkoNedic(e)).map((e) => e.color.toLowerCase());
  demand(
    colors.every(isStaffColor) && new Set(colors).size === colors.length,
    "Vraćanje boje nije moguće: boja je zauzeta ili nije u ponuđenoj paleti.",
    409,
  );
}
