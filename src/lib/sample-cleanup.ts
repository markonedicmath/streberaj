import type { SchoolState } from "./types";

// One-time removal of the development sandbox after connecting the real sheet.
// No imported lesson or recent manually entered lesson is selected for removal.
export function clearSampleData(s: SchoolState) {
  if ((s.sampleDataCleanupVersion ?? 0) >= 2) return false;
  const previouslyCleared = s.sampleDataCleanupVersion === 1;
  s.sampleDataCleanupVersion = 2;
  for (const employee of s.employees)
    if (employee.email === "manojlo@primer.rs") employee.email = "";
  if (previouslyCleared) return true;
  const legacyEmployees = new Set(
    s.employees
      .filter((e) =>
        ["ana@primer.rs", "marko@primer.rs", "jelena@primer.rs"].includes(
          e.email,
        ),
      )
      .map((e) => e.id),
  );
  const seedNames: Record<string, string> = {
    s1: "Mila Simić",
    s2: "Luka Ilić",
    s3: "Sara Marković",
    s4: "Petar Pavlović",
    s5: "Nina Jović",
  };
  const seedStudents = new Set(
    s.students.filter((st) => seedNames[st.id] === st.name).map((st) => st.id),
  );
  const firstImport = s.audits
    .filter((a) => a.actorId === "google" && a.action === "Uvezena rezervacija")
    .map((a) => a.at)
    .sort()[0]
    ?.slice(0, 10);
  const sandbox = legacyEmployees.size > 0 && seedStudents.size > 0;
  if (!sandbox) return true;

  const old = (at?: string) =>
    !!at && !!firstImport && at.slice(0, 10) < firstImport;
  const samplePaymentIds = new Set(
    s.payments
      .filter(
        (p) =>
          p.id === "p1" &&
          p.lessonId === "l1" &&
          p.amount === 240000 &&
          p.actorId === "ana",
      )
      .map((p) => p.id),
  );
  const lessonIds = new Set(
    s.lessons
      .filter(
        (l) =>
          !l.sourceId &&
          (seedStudents.has(l.studentId) || old(l.createdAt)) &&
          !s.attachments.some((a) => a.lessonId === l.id) &&
          !s.handovers.some((h) => h.lessonId === l.id) &&
          !s.payments.some(
            (p) => p.lessonId === l.id && !samplePaymentIds.has(p.id),
          ),
      )
      .map((l) => l.id),
  );
  const candidateStudents = new Set(
    s.lessons.filter((l) => lessonIds.has(l.id)).map((l) => l.studentId),
  );
  const remainingLessons = s.lessons.filter((l) => !lessonIds.has(l.id));
  const sourceStudentIds = new Set(
    s.sourceBlocks.map((b) => b.studentId).filter(Boolean),
  );
  const studentIds = new Set(
    s.students
      .filter(
        (st) =>
          (seedStudents.has(st.id) || candidateStudents.has(st.id)) &&
          !remainingLessons.some((l) => l.studentId === st.id) &&
          !sourceStudentIds.has(st.id),
      )
      .map((st) => st.id),
  );
  const employeeIds = new Set(
    [...legacyEmployees].filter(
      (id) => !remainingLessons.some((l) => l.teacherId === id),
    ),
  );
  const rules = s.rules.filter(
    (r) => ["r1", "r2"].includes(r.id) && r.name.startsWith("Primer ·"),
  );
  const ruleIds = new Set(rules.map((r) => r.id));
  const paymentIds = new Set(
    s.payments.filter((p) => lessonIds.has(p.lessonId)).map((p) => p.id),
  );
  const counterIds = new Set(
    s.counters
      .filter(
        (c) =>
          studentIds.has(c.studentId) ||
          (c.lessonId && lessonIds.has(c.lessonId)) ||
          old(c.at),
      )
      .map((c) => c.id),
  );
  const messageIds = new Set(
    (s.messages ?? []).filter((m) => old(m.createdAt)).map((m) => m.id),
  );
  let pricesCleared = 0;
  for (const lesson of remainingLessons) {
    const rule = rules.find((r) => r.id === lesson.ruleId);
    if (
      rule &&
      lesson.price === rule.price &&
      lesson.bossBps === rule.bossBps &&
      !s.payments.some((p) => p.lessonId === lesson.id) &&
      !s.handovers.some((h) => h.lessonId === lesson.id)
    ) {
      lesson.price = null;
      lesson.bossBps = null;
      lesson.ruleId = null;
      pricesCleared++;
    }
  }
  s.lessons = remainingLessons;
  s.students = s.students.filter((st) => !studentIds.has(st.id));
  for (const student of s.students)
    student.ownerIds = student.ownerIds.filter((id) => !employeeIds.has(id));
  s.employees = s.employees.filter((e) => !employeeIds.has(e.id));
  for (const employee of s.employees)
    if (employee.email === "manojlo@primer.rs") employee.email = "";
  s.rules = s.rules.filter((r) => !ruleIds.has(r.id));
  s.payments = s.payments.filter((p) => !paymentIds.has(p.id));
  s.counters = s.counters.filter((c) => !counterIds.has(c.id));
  s.messages = (s.messages ?? []).filter((m) => !messageIds.has(m.id));
  for (const message of s.messages) {
    if (message.replyTo && messageIds.has(message.replyTo))
      delete message.replyTo;
    message.likedBy = message.likedBy.filter((id) => !employeeIds.has(id));
  }
  s.sync.studentMap = Object.fromEntries(
    Object.entries(s.sync.studentMap).filter(([, id]) => !studentIds.has(id)),
  );
  s.sync.colorMap = Object.fromEntries(
    Object.entries(s.sync.colorMap).filter(([, id]) => !employeeIds.has(id)),
  );
  const removedIds = new Set([
    ...lessonIds,
    ...studentIds,
    ...employeeIds,
    ...ruleIds,
    ...paymentIds,
    ...counterIds,
    ...messageIds,
  ]);
  s.audits = s.audits.filter((a) => !old(a.at) && !removedIds.has(a.entityId));
  s.undoEntries = (s.undoEntries ?? []).filter((entry) => {
    const serialized = JSON.stringify(entry.changes);
    return ![...removedIds].some((id) =>
      serialized.includes(JSON.stringify(id)),
    );
  });
  s.audits.push({
    id: crypto.randomUUID(),
    actorId: "admin",
    entityId: "admin",
    action: "Uklonjeni probni podaci",
    at: new Date().toISOString(),
    before: null,
    after: {
      lessons: lessonIds.size,
      students: studentIds.size,
      employees: employeeIds.size,
      rules: ruleIds.size,
      payments: paymentIds.size,
      messages: messageIds.size,
      samplePricesCleared: pricesCleared,
    },
  });
  return true;
}
