"use client";
import { useEffect, useRef, useState } from "react";
import { X, Plus, Check, Trash2, ChevronDown } from "lucide-react";
import { parseDuration, durationText } from "@/lib/duration";
import {
  TARIFFS,
  allowedDuration,
  isManojlo,
  lessonQuote,
  universityStudent,
} from "@/lib/pricing";
import PackageCounter from "./package-counter";
import AnimatedAmount from "./animated-amount";
import { LessonDatePicker, LessonTimePicker } from "./lesson-pickers";
import StudentAutocomplete from "./student-autocomplete";
import type {
  Employee,
  Lesson,
  SchoolView,
  Student,
  RateRule,
  LessonPreview,
  DraftMoveUpdate,
} from "@/lib/types";
import {
  belgradeToday,
  clock,
  minutes,
  money,
  dateLabel,
  addDays,
  weekStart,
} from "@/lib/time";
import { previewConflicts, resolveDesk } from "@/lib/scheduling-preview";
import { STAFF_COLORS, textForColor } from "@/lib/staff-colors";
export type Command = (
  type: string,
  payload: unknown,
) => Promise<{ entityId?: string; warning?: string; view: SchoolView }>;
export const CHANNELS = {
  direct: "Direktno",
  referral: "Preporuka",
  other: "Drugo",
};
export function StudentCreatedLabel({ createdAt }: { createdAt?: string }) {
  return createdAt ? (
    <small className="student-created-at">
      Karton kreiran{" "}
      {new Date(createdAt).toLocaleString("sr-Latn-RS", {
        timeZone: "Europe/Belgrade",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </small>
  ) : null;
}
function ChannelExplanation({
  channel,
  referralNote,
  otherNote,
  onReferral,
  onOther,
}: {
  channel: Student["channel"];
  referralNote: string;
  otherNote: string;
  onReferral: (value: string) => void;
  onOther: (value: string) => void;
}) {
  if (channel === "referral")
    return (
      <Field label="Ko je preporučio učenika? (opciono)" wide>
        <input
          value={referralNote}
          onChange={(e) => onReferral(e.target.value)}
          maxLength={1000}
          placeholder="Ime osobe ili dodatna informacija"
        />
      </Field>
    );
  if (channel === "other")
    return (
      <Field label="Objašnjenje načina dolaska (opciono)" wide>
        <input
          value={otherNote}
          onChange={(e) => onOther(e.target.value)}
          maxLength={1000}
          placeholder="Kako je učenik došao do škole?"
        />
      </Field>
    );
  return null;
}
export function Modal({
  title,
  onClose,
  children,
  livePreview = false,
  closing = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  livePreview?: boolean;
  closing?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const closingProp = useRef(closing);
  const closeRequested = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dismissed, setDismissed] = useState(false);
  close.current = onClose;
  closingProp.current = closing;
  const isClosing = closing || dismissed;
  function requestClose() {
    if (closingProp.current || closeRequested.current) return;
    closeRequested.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      close.current();
      return;
    }
    setDismissed(true);
    closeTimer.current = setTimeout(() => close.current(), 220);
  }
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initial = ref.current?.querySelector<HTMLInputElement>(
      '[data-initial-focus="true"]',
    );
    (initial ?? ref.current)?.focus({ preventScroll: true });
    initial?.select();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className={
        "modal-backdrop " +
        (livePreview ? "live-preview " : "") +
        (isClosing ? "is-closing" : "")
      }
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={isClosing}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            aria-label="Zatvori"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function totals(view: SchoolView, l: Lesson) {
  const paid = view.payments
      .filter((p) => p.lessonId === l.id && !p.voidedAt)
      .reduce((a, p) => a + p.amount, 0),
    handed = view.handovers
      .filter((h) => h.lessonId === l.id && h.confirmed && !h.voidedAt)
      .reduce((a, h) => a + h.amount, 0),
    boss =
      l.price !== null && l.bossBps !== null
        ? Math.round((l.price * l.bossBps) / 10000)
        : null;
  return {
    paid,
    handed,
    boss,
    teacher: boss === null ? null : l.price! - boss,
    balance: l.price === null ? null : l.price - paid,
    bossBalance: isManojlo(view.employees.find((e) => e.id === l.teacherId))
      ? 0
      : boss === null
        ? null
        : boss - handed,
  };
}
function amount(v: string) {
  return Math.round(Number(v.replace(",", ".")) * 100);
}
export type NewLesson = {
  date: string;
  start: number;
  desk: 1 | 2 | null;
  name?: string;
};
export function LessonEditor({
  view,
  lesson,
  slot,
  command,
  onClose,
  onSaved,
  onPreview,
  externalMove,
}: {
  view: SchoolView;
  lesson?: Lesson;
  slot?: NewLesson;
  command: Command;
  onClose: () => void;
  onSaved: (id: string) => void;
  onPreview?: (draft: LessonPreview | null) => void;
  externalMove?: DraftMoveUpdate | null;
}) {
  const [section, setSection] = useState("Čas"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [closing, setClosing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLFieldSetElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  function focusStep(element: HTMLElement | null) {
    if (!element) return;
    element.focus({ preventScroll: true });
    if (element instanceof HTMLInputElement) element.select();
    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function focusDuration() {
    focusStep(
      durationRef.current?.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      ) ??
        durationRef.current?.querySelector<HTMLButtonElement>("button") ??
        null,
    );
  }
  const [studentId, setStudentId] = useState(
      lesson?.studentId ??
        (slot?.name
          ? view.students.find(
              (s) =>
                s.name.toLocaleLowerCase() === slot.name!.toLocaleLowerCase(),
            )?.id
          : undefined) ??
        "",
    ),
    [studentName, setStudentName] = useState(slot?.name ?? ""),
    [level, setLevel] = useState(""),
    [university, setUniversity] = useState<boolean | undefined>(
      lesson?.university,
    ),
    [referral, setReferral] = useState<boolean | undefined>(lesson?.referral),
    [channel] = useState<Student["channel"]>("direct"),
    [referralNote, setReferralNote] = useState(""),
    [otherNote, setOtherNote] = useState(""),
    [studentNotes, setStudentNotes] = useState("");
  const [teacherId, setTeacherId] = useState(
      lesson?.teacherId ?? view.actor.id,
    ),
    [date, setDate] = useState(lesson?.date ?? slot?.date ?? belgradeToday()),
    [start, setStart] = useState(clock(lesson?.start ?? slot?.start ?? 9 * 60)),
    [durationInput, setDurationInput] = useState(
      durationText(lesson?.duration ?? 45, lesson?.units ?? 1),
    ),
    [desk, setDesk] = useState<1 | 2>(lesson?.desk ?? slot?.desk ?? 1),
    [mode, setMode] = useState<Lesson["mode"]>(
      lesson?.mode ?? (slot?.desk === null ? "online" : "in_person"),
    ),
    [topic, setTopic] = useState(lesson?.topic ?? ""),
    [price, setPrice] = useState(
      lesson?.price == null ? "" : String(lesson.price / 100),
    ),
    [percent, setPercent] = useState(
      lesson?.bossBps == null ? "" : String(lesson.bossBps / 100),
    ),
    [manualPrice, setManualPrice] = useState(lesson?.priceManual ?? false),
    [manualPercent, setManualPercent] = useState(lesson?.bossManual ?? false),
    [shared, setShared] = useState(true);
  const today = belgradeToday(),
    currentWeek = weekStart(today),
    nextWeek = addDays(currentWeek, 7),
    hasNextWeekOptions = today > currentWeek,
    selectedNextWeek = date >= nextWeek && date < addDays(nextWeek, 7);
  const selectedStudent = view.students.find((s) => s.id === studentId),
    parsedDuration = parseDuration(durationInput),
    duration = parsedDuration?.duration ?? 0,
    teacher = view.employees.find((e) => e.id === teacherId),
    canPrice =
      view.actor.role === "admin" ||
      (view.actor.canSetPrice && !!teacher?.canSetPrice);
  const quoteStudent: Student = selectedStudent ?? {
    id: "draft",
    name: studentName,
    level,
    university,
    channel,
    ownerIds: [],
    subject: "Matematika",
  };
  const quote = lessonQuote(
    view.rules,
    { teacherId, duration, mode, university, referral },
    quoteStudent,
    teacher,
  );
  const ownSchoolLesson = isManojlo(teacher);
  const teacherName = teacher?.name ?? view.actor.name;
  const isUniversity = university ?? universityStudent(quoteStudent);
  const isReferral = referral ?? quoteStudent.channel === "referral";
  function chooseStudent(id: string) {
    setStudentId(id);
    setUniversity(id === lesson?.studentId ? lesson?.university : undefined);
    setReferral(id === lesson?.studentId ? lesson?.referral : undefined);
  }
  function advanceFromName() {
    const input = formRef.current?.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    );
    if (input && !input.reportValidity()) return;
    if (!studentId) {
      const matches = view.students.filter(
        (student) =>
          student.name.trim().toLocaleLowerCase("sr-Latn") ===
          studentName.trim().toLocaleLowerCase("sr-Latn"),
      );
      if (matches.length > 1) {
        setError("Više učenika ima to ime. Izaberite učenika iz predloga.");
        return;
      }
      if (matches.length === 1) chooseStudent(matches[0].id);
    }
    focusStep(dateRef.current);
  }
  const displayedPrice = price === "" ? null : amount(price);
  const displayedPercent = ownSchoolLesson
    ? 100
    : percent === ""
      ? null
      : Number(percent.replace(",", "."));
  const displayedBoss =
    displayedPrice === null || displayedPercent === null
      ? null
      : Math.round((displayedPrice * displayedPercent) / 100);
  const startMinute = minutes(start),
    liveDraft: LessonPreview | null =
      parsedDuration && date && Number.isFinite(startMinute)
        ? {
            id: lesson?.id,
            studentId: studentId || undefined,
            studentName: selectedStudent?.name || studentName || "Novi čas",
            teacherId,
            date,
            start: startMinute,
            duration,
            units: parsedDuration.units,
            desk: mode === "online" ? null : desk,
            mode,
            error,
          }
        : null;
  if (liveDraft) liveDraft.desk = resolveDesk(view.lessons, liveDraft);
  const liveConflicts =
    liveDraft && !closing ? previewConflicts(view.lessons, liveDraft) : [];
  const summaryName = (selectedStudent?.name ?? studentName).trim();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + "T12:00Z")) &&
    new Date(date + "T12:00Z").toISOString().slice(0, 10) === date;
  const validStart = /^(0?[6-9]|1\d|2[0-3]):[0-5]\d$/.test(start);
  const formIssue = !summaryName ? "Unesite ime učenika."
    : summaryName.length > 160 ? "Ime učenika može imati najviše 160 znakova."
    : !teacher?.active ? "Izaberite aktivnog predavača."
    : !validDate ? "Izaberite ispravan datum."
    : !validStart ? "Unesite početak između 06:00 i 23:59."
    : !parsedDuration || parsedDuration.units !== 1 || !allowedDuration(duration)
      ? "Izaberite trajanje: 45, 60, 90 ili 120 minuta."
    : displayedPrice !== null && (!Number.isFinite(displayedPrice) || displayedPrice < 0 || displayedPrice > 100_000_000)
      ? "Unesite ispravnu cenu časa."
    : displayedPercent !== null && (!Number.isFinite(displayedPercent) || displayedPercent < 0 || displayedPercent > 100)
      ? "Procenat mora biti između 0 i 100."
    : "";
  const hasIssue = !!formIssue || liveConflicts.length > 0 || !!error;
  const appliedMove = useRef(0);
  useEffect(() => {
    if (externalMove && externalMove.serial !== appliedMove.current) {
      appliedMove.current = externalMove.serial;
      const patch = externalMove.patch;
      setDate(patch.date);
      setStart(clock(patch.start));
      setDurationInput(
        durationText(patch.duration, parsedDuration?.units ?? 1),
      );
      setMode(patch.mode);
      if (patch.desk !== null) setDesk(patch.desk);
      return;
    }
    if (liveDraft?.desk && liveDraft.desk !== desk) setDesk(liveDraft.desk);
    onPreview?.(liveDraft);
  }, [
    onPreview,
    lesson?.id,
    studentId,
    selectedStudent?.name,
    studentName,
    teacherId,
    date,
    startMinute,
    duration,
    parsedDuration?.units,
    desk,
    liveDraft?.desk,
    mode,
    error,
    externalMove?.serial,
  ]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  useEffect(() => {
    setError("");
  }, [
    studentId,
    studentName,
    teacherId,
    date,
    start,
    durationInput,
    desk,
    mode,
    price,
    percent,
    university,
    referral,
  ]);
  useEffect(() => {
    const originalQuote = lesson
      ? lessonQuote(view.rules, lesson, quoteStudent, teacher)
      : null;
    const sameTerms =
      lesson &&
      lesson.studentId === studentId &&
      lesson.teacherId === teacherId &&
      lesson.mode === mode &&
      lesson.duration === duration &&
      originalQuote?.price === quote.price &&
      originalQuote?.bossBps === quote.bossBps;
    const automaticPrice =
      lesson?.priceManual && !canPrice
        ? lesson.price
        : sameTerms && !lesson.priceManual && lesson.price !== null
          ? lesson.price
          : quote.price;
    const automaticPercent = ownSchoolLesson
      ? 10000
      : sameTerms && !lesson.bossManual && lesson.bossBps !== null
        ? lesson.bossBps
        : quote.bossBps;
    if (!manualPrice || !canPrice)
      setPrice(automaticPrice === null ? "" : String(automaticPrice / 100));
    if (!manualPercent || ownSchoolLesson)
      setPercent(
        automaticPercent === null ? "" : String(automaticPercent / 100),
      );
  }, [
    lesson,
    view.rules,
    teacherId,
    duration,
    parsedDuration?.units,
    mode,
    selectedStudent,
    level,
    channel,
    manualPrice,
    manualPercent,
    studentId,
    quote.price,
    quote.bossBps,
    canPrice,
    ownSchoolLesson,
  ]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || closing || hasIssue) return;
    setBusy(true);
    setError("");
    try {
      if (
        !parsedDuration ||
        parsedDuration.units !== 1 ||
        !allowedDuration(duration)
      )
        throw new Error("Izaberite trajanje: 45, 60, 90 ili 120 minuta.");
      const payload = {
        id: lesson?.id,
        studentId,
        teacherId,
        date,
        start: minutes(start),
        duration,
        units: parsedDuration.units,
        desk: mode === "online" ? null : desk,
        mode,
        topic,
        price: price === "" ? null : amount(price),
        priceManual: manualPrice,
        bossManual: manualPercent,
        university: isUniversity,
        referral: isReferral,
        bossBps:
          percent === ""
            ? null
            : Math.round(Number(percent.replace(",", ".")) * 100),
        shared: mode === "online" ? true : false,
      };
      const r = studentId
        ? await command("saveLesson", payload)
        : await command("saveLessonDraft", {
            student: {
              name: studentName,
              level,
              university: isUniversity,
              channel: isReferral
                ? "referral"
                : channel === "referral"
                  ? "direct"
                  : channel,
              subject: "Matematika",
              referralNote,
              otherNote,
              notes: studentNotes,
            },
            lesson: payload,
          });
      onPreview?.(null);
      setClosing(true);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
      if (r.entityId) onSaved(r.entityId);
      else onClose();
    } catch (e) {
      setError((e as Error).message);
      void command("refresh", {}).catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={lesson ? "Detalji časa" : "Novi čas"}
      onClose={() => {
        if (!closing) onClose();
      }}
      livePreview
      closing={closing}
    >
      {lesson && (
        <>
          <div className="lesson-summary">
            <h3>{selectedStudent?.name}</h3>
            {selectedStudent && (
              <div className="global-counter-summary">
                Globalno održano: <strong>{selectedStudent.total}</strong> ·
                Trenutni paket:{" "}
                <PackageCounter
                  student={selectedStudent}
                  scopeSelection={false}
                  onCorrect={async (number, size) => {
                    await command("correctStudentCounter", {
                      studentId: selectedStudent.id,
                      number,
                      size,
                    });
                  }}
                  onChange={(size) =>
                    command("setPackage", {
                      studentId: selectedStudent.id,
                      packageSize: size,
                    }).then(() => {})
                  }
                />
              </div>
            )}
            {selectedStudent && (
              <div className="global-counter-summary">
                Brojač ovog časa:{" "}
                <PackageCounter
                  student={selectedStudent}
                  cycle={lesson.cycleNumbers?.[0] ?? selectedStudent.cycle}
                  size={lesson.cycleSize ?? selectedStudent.packageSize ?? 4}
                  onChange={async (size) => {
                    await command("setPackage", {
                      studentId: selectedStudent.id,
                      packageSize: size,
                    });
                  }}
                  onCorrect={async (number, size, scope) => {
                    await command("correctLessonCounter", {
                      lessonId: lesson.id,
                      number,
                      size,
                      scope,
                    });
                  }}
                />
              </div>
            )}
            {section !== "Čas" && <p>
              {dateLabel(lesson.date)} · {clock(lesson.start)}–
              {clock(lesson.start + lesson.duration)} · {lesson.duration} min ·{" "}
              {lesson.mode === "online" ? "Online" : "Uživo"}
            </p>}
            {lesson.conflict && <p className="form-error">{lesson.conflict}</p>}
            {lesson.sourceId && (
              <span className="badge">
                Google tabela{lesson.localOverride ? " · lokalna izmena" : ""}
                {lesson.sourceMissing ? " · uklonjeno iz izvora" : ""}
              </span>
            )}
          </div>
          <div className="panel-tabs">
            {["Čas", "Naplata", "Istorija"].map((s) => (
              <button
                key={s}
                className={s === section ? "active" : ""}
                onClick={() => setSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
      {section === "Čas" && (
        <form
          ref={formRef}
          onSubmit={save}
          onInvalidCapture={(e) => {
            const details = (
              e.target as HTMLElement
            ).closest<HTMLDetailsElement>(".more-settings");
            if (details) details.open = true;
          }}
        >
          {hasIssue && (
            <div
              className="editor-live-summary has-conflict"
              id="lesson-form-issues"
              role="alert"
            >
              <strong>
                {liveConflicts.length
                  ? "Preklapanje termina"
                  : "Proverite podatke"}
              </strong>
              {formIssue && <span>{formIssue}</span>}
              {error && error !== formIssue && <span>{error}</span>}
              {liveConflicts.map(({ lesson: other, reason }) => (
                <span key={other.id}>
                  {reason === "Sto je zauzet"
                    ? "Prostorija je popunjena"
                    : reason}
                  : {clock(other.start)}–{clock(other.start + other.duration)}
                  {!("restricted" in other)
                    ? " · " +
                      (view.students.find((s) => s.id === other.studentId)
                        ?.name ?? "")
                    : ""}
                </span>
              ))}
            </div>
          )}
          <div className="form-grid">
            {lesson && (
              <Field label="Učenik" wide>
                <select
                  value={studentId}
                  onChange={(e) => chooseStudent(e.target.value)}
                >
                  <option value="">+ Novi učenik</option>
                  {view.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.level}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {(!studentId || !lesson) && (
              <>
                <Field label={lesson ? "Ime i prezime" : "Učenik"} wide>
                  <StudentAutocomplete
                    students={view.students}
                    value={selectedStudent?.name ?? studentName}
                    onChange={(value) => {
                      if (studentId) chooseStudent("");
                      setStudentName(value);
                    }}
                    onSelect={(s) => {
                      chooseStudent(s.id);
                      requestAnimationFrame(() => focusStep(dateRef.current));
                    }}
                    onSubmit={advanceFromName}
                    autoFocus={!lesson}
                    required
                  />
                </Field>
              </>
            )}
            <Field label="Datum" wide>
              <LessonDatePicker
                value={date}
                onChange={setDate}
                inputRef={dateRef}
                onNext={() => focusStep(timeRef.current)}
              />
              <span className="date-shortcuts">
                {[
                  ["Danas", 0],
                  ["Sutra", 1],
                  ["Prekosutra", 2],
                ].map(([label, offset]) => {
                  const value = addDays(today, Number(offset));
                  return (
                    <button
                      type="button"
                      key={label}
                      aria-label={"Datum: " + label}
                      aria-pressed={date === value}
                      className={date === value ? "selected" : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        setDate(value);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
              <span className="date-shortcuts weekdays">
                {["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"].map(
                  (label, index) => {
                    const thisWeekDate = addDays(currentWeek, index);
                    const value =
                      thisWeekDate < today
                        ? addDays(thisWeekDate, 7)
                        : thisWeekDate;
                    const inNextWeek = value >= nextWeek;
                    const isToday = value === today;
                    const description = `${label}, ${dateLabel(value)}${inNextWeek ? " · sledeća nedelja" : isToday ? " · danas" : ""}`;
                    return (
                      <button
                        type="button"
                        key={label}
                        aria-label={description}
                        title={description}
                        aria-pressed={date === value}
                        className={
                          (isToday ? "is-today " : "") +
                          (inNextWeek ? "next-week " : "") +
                          (date === value ? "selected" : "")
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          setDate(value);
                        }}
                      >
                        {label}
                        <small>{dateLabel(value)}</small>
                      </button>
                    );
                  },
                )}
              </span>
              <span className="date-week-hint" role="status">
                {(selectedNextWeek || hasNextWeekOptions) && (
                  <span key={selectedNextWeek ? date : "legend"}>
                    {selectedNextWeek
                      ? `Sledeća nedelja · ${dateLabel(date)}`
                      : "Plavo: sledeća nedelja."}
                  </span>
                )}
              </span>
            </Field>
            <div className="lesson-timing-row wide">
            <Field label="Početak">
              <LessonTimePicker
                value={start}
                onChange={setStart}
                inputRef={timeRef}
                onNext={focusDuration}
              />
            </Field>
            <fieldset
              className="duration-presets"
              ref={durationRef}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  focusStep(saveRef.current);
                } else if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                  )
                ) {
                  event.preventDefault();
                  const index = TARIFFS.findIndex(
                    (tariff) => tariff.duration === duration,
                  );
                  const direction = event.key === "ArrowDown" ? 2
                    : event.key === "ArrowUp" ? -2
                    : event.key === "ArrowRight" ? 1 : -1;
                  const next = Math.max(
                    0,
                    Math.min(TARIFFS.length - 1, index + direction),
                  );
                  setDurationInput(String(TARIFFS[next].duration));
                  requestAnimationFrame(focusDuration);
                }
              }}
            >
              <legend>Trajanje</legend>
              <div role="group" aria-label="Trajanje časa">
                {TARIFFS.map((tariff) => (
                  <button
                    type="button"
                    className={
                      "btn " + (duration === tariff.duration ? "selected" : "")
                    }
                    key={tariff.duration}
                    aria-pressed={duration === tariff.duration}
                    onClick={() => setDurationInput(String(tariff.duration))}
                  >
                    {tariff.duration} min
                  </button>
                ))}
              </div>
              {!allowedDuration(duration) && (
                <small>
                  Izvorno trajanje: {duration} min. Izaberite ponuđeno trajanje
                  za automatsku cenu.
                </small>
              )}
            </fieldset>
            </div>
          </div>
            <p className={"lesson-selected-summary" + (hasIssue ? " has-issue" : "")} aria-live="polite" aria-atomic="true">
              <strong className="summary-student">{summaryName || "Učenik"}</strong>
              {", "}
              <time dateTime={validDate ? date : undefined}>{validDate ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "—"}</time>
              {", "}
              <span>{validStart && parsedDuration ? `${clock(startMinute).replace(":", ".")}–${clock(startMinute + duration).replace(":", ".")}` : "—"}</span>
              {", "}
              <strong>{parsedDuration ? `${duration} min` : "— min"}</strong>
            </p>
          <div
            className={
              "automatic-quote" + (ownSchoolLesson ? " own-school-quote" : "")
            }
            aria-live="polite"
          >
            <div>
              <span>Cena</span>
              <strong>
                <AnimatedAmount value={displayedPrice} />
              </strong>
            </div>
            {!ownSchoolLesson && (
              <div>
                <span className="quote-label">
                  <span className="quote-name" title={teacherName}>
                    {teacherName}
                  </span>
                  <AnimatedAmount
                    value={
                      displayedPercent === null ? null : 100 - displayedPercent
                    }
                    percent
                  />
                </span>
                <strong>
                  <AnimatedAmount
                    value={
                      displayedPrice === null || displayedBoss === null
                        ? null
                        : displayedPrice - displayedBoss
                    }
                  />
                </strong>
              </div>
            )}
            <div>
              <span className="quote-label">
                <span className="quote-name">
                  {ownSchoolLesson ? "100% Manojlov deo" : "Manojlo"}
                </span>
                {!ownSchoolLesson && (
                  <AnimatedAmount value={displayedPercent} percent />
                )}
              </span>
              <strong>
                <AnimatedAmount value={displayedBoss} />
              </strong>
            </div>
            <small
              className="quote-formula"
              key={`${teacherId}-${displayedPercent}-${quote.bonuses.join("-")}-${manualPercent}`}
            >
              {ownSchoolLesson ? (
                "Manojlu pripada ceo iznos časa."
              ) : !manualPercent &&
                !quote.ruleId &&
                displayedPercent === quote.bossBps / 100 ? (
                <>
                  {teacherName}: 60%
                  {quote.bonuses
                    .map(
                      (bonus) => ` + 10% ${bonus.toLocaleLowerCase("sr-Latn")}`,
                    )
                    .join("")}
                </>
              ) : manualPercent ? (
                "Ručni obračun za ovaj čas."
              ) : (
                "Sačuvani obračun za ovaj čas."
              )}
            </small>
          </div>
          <div
            className="pricing-checks"
            role="group"
            aria-label="Dodaci za obračun"
          >
            <label
              className={"check-field" + (mode === "online" ? " selected" : "")}
            >
              <input
                type="checkbox"
                checked={mode === "online"}
                onChange={(e) =>
                  setMode(e.target.checked ? "online" : "in_person")
                }
              />
              <span>
                Online <small>+10%</small>
              </span>
            </label>
            <label
              className={"check-field" + (isUniversity ? " selected" : "")}
            >
              <input
                type="checkbox"
                checked={isUniversity}
                onChange={(e) => setUniversity(e.target.checked)}
              />
              <span>
                Fakultet <small>+10%</small>
              </span>
            </label>
            <label className={"check-field" + (isReferral ? " selected" : "")}>
              <input
                type="checkbox"
                checked={isReferral}
                onChange={(e) => setReferral(e.target.checked)}
              />
              <span>
                Preporuka <small>+10%</small>
              </span>
            </label>
          </div>
          <details className="more-settings">
            <summary>
              <span>Više podešavanja</span>
              <ChevronDown size={17} />
            </summary>
            <div className="form-grid">
              <Field label="Predavač" wide>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  disabled={
                    view.actor.role !== "admin" &&
                    (!!lesson || view.actor.canScheduleOthers === false)
                  }
                >
                  {view.employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.name}
                        {e.id === view.actor.id ? " (ja)" : ""}
                      </option>
                    ))}
                </select>
              </Field>
              {!studentId && (
                <>
                  <Field label="Razred / nivo">
                    <input
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="npr. 7. razred"
                    />
                  </Field>
                  <ChannelExplanation
                    channel={
                      isReferral
                        ? "referral"
                        : channel === "referral"
                          ? "direct"
                          : channel
                    }
                    referralNote={referralNote}
                    otherNote={otherNote}
                    onReferral={setReferralNote}
                    onOther={setOtherNote}
                  />
                  <Field label="Beleške o učeniku (opciono)" wide>
                    <textarea
                      value={studentNotes}
                      onChange={(e) => setStudentNotes(e.target.value)}
                      maxLength={6000}
                      rows={3}
                    />
                  </Field>
                </>
              )}
              <Field label="Tematika / beleška" wide>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Šta se radi na času?"
                />
              </Field>
              <Field
                label={
                  parsedDuration && parsedDuration.units > 1
                    ? "Cena po času (RSD)"
                    : "Cena (RSD)"
                }
              >
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  value={price}
                  disabled={!canPrice}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setManualPrice(true);
                  }}
                  placeholder="Nije određeno"
                />
                {manualPrice && canPrice && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setManualPrice(false)}
                  >
                    Vrati automatsku cenu
                  </button>
                )}
              </Field>
              <Field label="Manojlov deo (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={percent}
                  disabled={view.actor.role !== "admin" || ownSchoolLesson}
                  onChange={(e) => {
                    setPercent(e.target.value);
                    setManualPercent(true);
                  }}
                  placeholder="Nije određeno"
                />
                {manualPercent && view.actor.role === "admin" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setManualPercent(false)}
                  >
                    Vrati automatski procenat
                  </button>
                )}
              </Field>
            </div>
            {teacherId !== view.actor.id && !lesson && (
              <p className="muted">
                Zakazujete za drugog predavača. Nakon čuvanja važe njegove
                dozvole vidljivosti.
              </p>
            )}
            {!canPrice && (
              <p className="muted">
                Cena se preuzima iz cenovnika. Ručna promena je isključena.
              </p>
            )}
          </details>
          <div className="form-actions">
            {lesson && !lesson.deletedAt && (
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await command("deleteLessons", { ids: [lesson.id] });
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={15} />
                Obriši čas
              </button>
            )}
            <button className="btn" type="button" onClick={onClose}>
              Odustani
            </button>
            <button
              ref={saveRef}
              type="submit"
              className={"btn primary lesson-book-button" + (hasIssue ? " has-issue" : "")}
              disabled={busy || closing || hasIssue}
              aria-describedby={hasIssue ? "lesson-form-issues" : undefined}
            >
              {busy ? "Zakazivanje…" : "Zakaži čas"}
            </button>
          </div>
        </form>
      )}
      {lesson && section === "Naplata" && (
        <Payments view={view} lesson={lesson} command={command} />
      )}
      {lesson && section === "Istorija" && (
        <div className="audit-list">
          {view.audits
            .filter((a) => a.entityId === lesson.id)
            .map((a) => (
              <div key={a.id}>
                <strong>{a.action}</strong>
                <p>
                  {new Date(a.at).toLocaleString("sr-Latn-RS", {
                    timeZone: "Europe/Belgrade",
                  })}{" "}
                  ·{" "}
                  {view.employees.find((e) => e.id === a.actorId)?.name ??
                    "Google tabela"}
                </p>
              </div>
            ))}
          {!view.audits.some((a) => a.entityId === lesson.id) && (
            <p className="muted">Nema zabeleženih izmena.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
function Payments({
  view,
  lesson,
  command,
}: {
  view: SchoolView;
  lesson: Lesson;
  command: Command;
}) {
  const f = totals(view, lesson),
    [type, setType] = useState("payment"),
    [value, setValue] = useState(""),
    [date, setDate] = useState(belgradeToday),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await command(type, {
        lessonId: lesson.id,
        amount: amount(value),
        date,
        note,
      });
      setValue("");
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="balance-grid">
        {[
          ["Cena časa", lesson.price],
          ["Učenik uplatio", f.paid],
          [
            f.balance !== null && f.balance < 0
              ? "Preplata učenika"
              : "Učenik duguje",
            f.balance === null ? null : Math.abs(f.balance),
          ],
          ["Manojlov deo", f.boss],
          ["Primljeno kod Manojla", f.handed],
          [
            f.bossBalance !== null && f.bossBalance < 0
              ? "Preplata Manojlu"
              : "Za predaju Manojlu",
            f.bossBalance === null ? null : Math.abs(f.bossBalance),
          ],
        ].map(([l, v]) => (
          <div key={String(l)}>
            <span>{l}</span>
            <strong>{money(v as number | null)}</strong>
          </div>
        ))}
      </div>
      <h3>Evidentiraj novac</h3>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Vrsta" wide>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="payment">Uplata učenika</option>
              <option value="handover">Predaja Manojlovog dela</option>
            </select>
          </Field>
          <Field label="Iznos (RSD)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Datum">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Beleška" wide>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="npr. Gotovina"
            />
          </Field>
        </div>
        <ErrorMessage error={error} />
        <button
          className="btn primary"
          disabled={busy || lesson.price === null || lesson.bossBps === null}
        >
          Evidentiraj
        </button>
      </form>
      <h3>Uplate i predaje</h3>
      <div className="transaction-list">
        {view.payments
          .filter((p) => p.lessonId === lesson.id)
          .map((p) => (
            <div key={p.id}>
              <span>
                Uplata · {dateLabel(p.date)}
                <small>{p.voidedAt ? "Poništeno" : p.note}</small>
              </span>
              <strong>{money(p.amount)}</strong>
            </div>
          ))}
        {view.handovers
          .filter((h) => h.lessonId === lesson.id)
          .map((h) => (
            <div key={h.id}>
              <span>
                Predaja · {dateLabel(h.date)}
                <small>
                  {h.voidedAt
                    ? "Poništeno"
                    : h.confirmed
                      ? "Potvrđeno"
                      : "Nepotvrđeno"}
                </small>
              </span>
              <strong>{money(h.amount)}</strong>
              {!h.confirmed && !h.voidedAt && (
                <button
                  className="btn small"
                  onClick={async () => {
                    try {
                      await command("confirmHandover", { id: h.id });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Potvrdi
                </button>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
export function StudentEditor({
  student,
  students = [],
  command,
  onClose,
}: {
  student?: Student;
  students?: Student[];
  command: Command;
  onClose: () => void;
}) {
  const [chosenId, setChosenId] = useState(student?.id),
    [packageSize, setPackageSize] = useState(student?.packageSize ?? 4),
    [name, setName] = useState(student?.name ?? ""),
    [level, setLevel] = useState(student?.level ?? ""),
    [university, setUniversity] = useState<boolean | undefined>(
      student?.university,
    ),
    [channel, setChannel] = useState(student?.channel ?? "direct"),
    [referralNote, setReferralNote] = useState(student?.referralNote ?? ""),
    [otherNote, setOtherNote] = useState(student?.otherNote ?? ""),
    [notes, setNotes] = useState(student?.notes ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={student ? "Uredi učenika" : "Novi učenik"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("saveStudent", {
              id: chosenId,
              name,
              level,
              university: universityStudent({ level, university }),
              channel,
              packageSize,
              subject: student?.subject ?? "Matematika",
              referralNote,
              otherNote,
              notes,
            });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Ime i prezime" wide>
            <StudentAutocomplete
              students={students}
              required
              value={name}
              onChange={setName}
              onSelect={(s) => {
                setChosenId(s.id);
                setName(s.name);
                setLevel(s.level);
                setUniversity(s.university);
                setChannel(s.channel);
                setPackageSize(s.packageSize ?? 4);
                setReferralNote(s.referralNote ?? "");
                setOtherNote(s.otherNote ?? "");
                setNotes(s.notes ?? "");
              }}
            />
          </Field>
          <Field label="Razred / nivo">
            <input value={level} onChange={(e) => setLevel(e.target.value)} />
          </Field>
          <label className="check-field wide">
            <input
              type="checkbox"
              checked={universityStudent({ level, university })}
              onChange={(e) => setUniversity(e.target.checked)}
            />
            Fakultet · predavaču +10%
          </label>
          <Field label="Broj časova u paketu">
            <input
              type="number"
              min={1}
              max={200}
              required
              value={packageSize}
              onChange={(e) => setPackageSize(Number(e.target.value))}
            />
          </Field>
          <Field label="Način dolaska">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Student["channel"])}
            >
              {Object.entries(CHANNELS).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <ChannelExplanation
            channel={channel}
            referralNote={referralNote}
            otherNote={otherNote}
            onReferral={setReferralNote}
            onOther={setOtherNote}
          />
          <Field label="Beleške o učeniku (opciono)" wide>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={6000}
              placeholder="Važne informacije, dogovori i napomene…"
            />
          </Field>
        </div>
        <StudentCreatedLabel
          createdAt={
            (student?.id === chosenId
              ? student
              : students.find((s) => s.id === chosenId)
            )?.createdAt
          }
        />
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            Sačuvaj učenika
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function EmployeeEditor({
  employee,
  employees,
  command,
  onClose,
}: {
  employee?: Employee;
  employees: Employee[];
  command: Command;
  onClose: () => void;
}) {
  const [value, setValue] = useState<Employee>(
      employee ?? {
        id: "",
        name: "",
        email: "",
        role: "teacher",
        color:
          STAFF_COLORS.find(
            (c) => !employees.some((e) => e.color === c.background),
          )?.background ?? "",
        canSetPrice: true,
        canScheduleOthers: true,
        active: true,
      },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function update<K extends keyof Employee>(key: K, v: Employee[K]) {
    setValue({ ...value, [key]: v });
  }
  return (
    <Modal
      title={employee ? "Uredi zaposlenog" : "Novi zaposleni"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("saveEmployee", {
              ...value,
              id: value.id || undefined,
            });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Ime i prezime" wide>
            <input
              required
              value={value.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="Google imejl" wide>
            <input
              type="email"
              placeholder="Opciono — potreban tek za prijavu"
              value={value.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Uloga">
            <select
              value={value.role}
              onChange={(e) =>
                update("role", e.target.value as Employee["role"])
              }
            >
              <option value="teacher">Predavač</option>
              <option value="admin">Superadministrator</option>
            </select>
          </Field>
          <fieldset className="staff-color-picker wide">
            <legend>Jedinstvena boja · 20 mogućnosti</legend>
            <div>
              {STAFF_COLORS.map((color) => {
                const occupied = employees.find(
                  (e) => e.id !== employee?.id && e.color === color.background,
                );
                return (
                  <button
                    type="button"
                    key={color.background}
                    aria-label={
                      color.name +
                      (occupied ? " · zauzeto: " + occupied.name : "")
                    }
                    aria-pressed={value.color === color.background}
                    disabled={!!occupied}
                    title={color.name + (occupied ? " · " + occupied.name : "")}
                    style={{ background: color.background, color: color.text }}
                    onClick={() => update("color", color.background)}
                  >
                    <span>Aa</span>
                    {value.color === color.background && <Check size={13} />}
                  </button>
                );
              })}
            </div>
            {value.color && (
              <p
                className="staff-color-preview"
                style={{
                  background: value.color,
                  color: textForColor(value.color),
                }}
              >
                <strong>Ime učenika</strong>
                <span>1/5 · 09:00–09:45 · 45 min</span>
              </p>
            )}
          </fieldset>
          {(
            [
              ["canScheduleOthers", "Zakazuje za druge"],
              ["canSetPrice", "Menja cenu"],
            ] as const
          ).map(([key, label]) => (
            <fieldset className="permission-radios wide" key={key}>
              <legend>{label}</legend>
              {[true, false].map((enabled) => (
                <label key={String(enabled)}>
                  <input
                    type="radio"
                    name={`employee-${key}`}
                    checked={(value[key] ?? true) === enabled}
                    onChange={() => update(key, enabled)}
                  />
                  {enabled ? "Da" : "Ne"}
                </label>
              ))}
            </fieldset>
          ))}
          <label className="check-field wide">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(event) => update("active", event.target.checked)}
            />
            Aktivan nalog
          </label>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            Sačuvaj zaposlenog
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function RuleEditor({
  rule,
  view,
  command,
  onClose,
}: {
  rule?: RateRule;
  view: SchoolView;
  command: Command;
  onClose: () => void;
}) {
  const [r, setR] = useState<RateRule>(
      rule ?? {
        id: "",
        name: "",
        priority: 10,
        active: true,
        teacherId: null,
        duration: 60,
        mode: null,
        level: null,
        channel: null,
        price: 0,
        bossBps: 0,
      },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (key: string, value: unknown) => setR({ ...r, [key]: value });
  return (
    <Modal
      title={rule ? "Uredi pravilo" : "Novo pravilo cenovnika"}
      onClose={onClose}
    >
      <p className="muted">
        Prvo aktivno pravilo koje odgovara času određuje cenu i procenat. Manji
        prioritet proverava se prvi. Postojeći obračuni ostaju sačuvani.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command("saveRule", { ...r, id: r.id || undefined });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Naziv pravila" wide>
            <input
              required
              value={r.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="Prioritet">
            <input
              type="number"
              min={0}
              required
              value={r.priority}
              onChange={(e) => update("priority", Number(e.target.value))}
            />
          </Field>
          <Field label="Trajanje (prazno = sva)">
            <select
              value={r.duration ?? ""}
              onChange={(e) =>
                update(
                  "duration",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">Sva trajanja</option>
              {TARIFFS.map((tariff) => (
                <option value={tariff.duration} key={tariff.duration}>
                  {tariff.duration} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Predavač">
            <select
              value={r.teacherId ?? ""}
              onChange={(e) => update("teacherId", e.target.value || null)}
            >
              <option value="">Svi predavači</option>
              {view.employees.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Način održavanja">
            <select
              value={r.mode ?? ""}
              onChange={(e) => update("mode", e.target.value || null)}
            >
              <option value="">Svi časovi</option>
              <option value="in_person">Uživo</option>
              <option value="online">Online</option>
            </select>
          </Field>
          <Field label="Nivo (prazno = svi)">
            <input
              value={r.level ?? ""}
              onChange={(e) => update("level", e.target.value || null)}
              placeholder="npr. Student"
            />
          </Field>
          <Field label="Način dolaska">
            <select
              value={r.channel ?? ""}
              onChange={(e) => update("channel", e.target.value || null)}
            >
              <option value="">Svi načini</option>
              {Object.entries(CHANNELS).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cena (RSD)">
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={r.price / 100}
              onChange={(e) => update("price", amount(e.target.value))}
            />
          </Field>
          <Field label="Manojlov deo (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={r.bossBps / 100}
              onChange={(e) =>
                update("bossBps", Math.round(Number(e.target.value) * 100))
              }
            />
          </Field>
          <label className="check-field wide">
            <input
              type="checkbox"
              checked={r.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Pravilo je aktivno
          </label>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            Sačuvaj pravilo
          </button>
        </div>
      </form>
    </Modal>
  );
}
