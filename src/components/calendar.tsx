"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { isDoubleTap, type Tap } from "@/lib/tap";
import { Pencil, Check, X, MoveVertical, Trash2 } from "lucide-react";
import { textForColor as ink } from "@/lib/staff-colors";
import PackageCounter from "./package-counter";
import LessonTime from "./lesson-time";
import { snapDuration, stepDuration } from "@/lib/pricing";
import StudentAutocomplete from "./student-autocomplete";
import { addDays, belgradeToday, clock, weekStart } from "@/lib/time";
import {
  START,
  END,
  SLOTS,
  defaultRows,
  normalizeRows,
  position,
  minuteAt,
} from "@/lib/time-axis";
import type {
  SchoolView,
  Lesson,
  BusyLesson,
  LessonPreview,
  DraftMove,
  CounterScope,
} from "@/lib/types";
import { previewConflicts, resolveDesk } from "@/lib/scheduling-preview";
const DAYS = [
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedelja",
];
type Move = Pick<Lesson, "date" | "start" | "duration" | "desk" | "mode">;
type Draft = {
  date: string;
  start: number;
  desk: 1 | 2 | null;
  name: string;
  studentId?: string;
};
interface Props {
  view: SchoolView;
  week: string;
  day: number | null;
  online: boolean;
  hourGuides: boolean;
  teacher: string;
  focusDate?: string;
  editorDraft?: LessonPreview | null;
  onEditorMove?: (patch: DraftMove) => void;
  onOpen: (l: Lesson) => void;
  onNew: (
    date: string,
    start: number,
    desk: 1 | 2 | null,
    name?: string,
  ) => void;
  onMove: (l: Lesson, p: Move) => Promise<Move | undefined>;
  onQuickAdd: (d: Draft) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  onMoveMany: (
    moves: { lesson: Lesson; patch: Move }[],
  ) => Promise<Record<string, Move>>;
  onPackage: (studentId: string, size: number) => Promise<void>;
  onCounter: (
    lessonId: string,
    unit: number,
    number: number,
    size: number,
    scope: CounterScope,
  ) => Promise<void>;
}
export default function Calendar({
  view,
  week,
  day,
  online,
  hourGuides,
  teacher,
  focusDate,
  editorDraft,
  onEditorMove,
  onOpen,
  onNew,
  onMove,
  onQuickAdd,
  onDelete,
  onMoveMany,
  onPackage,
  onCounter,
}: Props) {
  const scroll = useRef<HTMLDivElement>(null),
    cleanup = useRef<() => void>(() => {}),
    suppress = useRef(0),
    quickSaving = useRef(false);
  const [rows, setRows] = useState(() => {
    try {
      return normalizeRows(
        JSON.parse(localStorage.getItem("streberaj-row-heights") ?? "null"),
      );
    } catch {
      return defaultRows();
    }
  });
  const [pending, setPending] = useState<Record<string, Move>>({}),
    sequences = useRef<Record<string, number>>({}),
    queues = useRef<Record<string, Promise<void>>>({});
  const [preview, setPreview] = useState<Record<string, Move>>({}),
    [draft, setDraft] = useState<Draft | null>(null),
    [quickError, setQuickError] = useState(""),
    [quickBusy, setQuickBusy] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()),
    [marquee, setMarquee] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null),
    [deleting, setDeleting] = useState(false);
  const anchor = useRef<string | null>(null);
  const previousTap = useRef<Tap | null>(null),
    touchOrigin = useRef<Tap | null>(null);
  function beginTouch(e: React.TouchEvent, key: string) {
    if (e.touches.length !== 1) {
      touchOrigin.current = null;
      previousTap.current = null;
      return;
    }
    const point = e.touches[0];
    touchOrigin.current = {
      key,
      x: point.clientX,
      y: point.clientY,
      at: Date.now(),
      scrollTop: scroll.current?.scrollTop ?? 0,
      scrollLeft: scroll.current?.scrollLeft ?? 0,
    };
  }
  function endTouch(
    e: React.TouchEvent,
    key: string,
    open: (point: React.Touch) => void,
  ) {
    const origin = touchOrigin.current,
      point = e.changedTouches[0];
    touchOrigin.current = null;
    if (!origin || !point || origin.key !== key || e.touches.length) return;
    const tap: Tap = {
      key,
      x: point.clientX,
      y: point.clientY,
      at: Date.now(),
      scrollTop: scroll.current?.scrollTop ?? 0,
      scrollLeft: scroll.current?.scrollLeft ?? 0,
    };
    if (
      tap.at - origin.at > 400 ||
      Math.hypot(tap.x - origin.x, tap.y - origin.y) > 14 ||
      Math.abs(tap.scrollTop - origin.scrollTop) >= 3 ||
      Math.abs(tap.scrollLeft - origin.scrollLeft) >= 3
    ) {
      previousTap.current = null;
      return;
    }
    if (isDoubleTap(previousTap.current, tap)) {
      previousTap.current = null;
      e.preventDefault();
      suppress.current = Date.now() + 650;
      flushSync(() => open(point));
    } else previousTap.current = tap;
  }
  function openQuick(date: string, desk: 1 | 2 | null, y: number, top: number) {
    const at = minuteAt(y - top, rows);
    const start = Math.min(END - 45, Math.max(START, Math.floor(at / 15) * 15)),
      resolved = resolveDesk(view.lessons, {
        date,
        start,
        desk,
        mode: desk === null ? "online" : "in_person",
        duration: 45,
        units: 1,
        teacherId: view.actor.id,
        studentName: "",
      });
    setQuickError("");
    onNew(date, start, resolved);
  }
  const editorDragging = useRef(false);
  useEffect(() => {
    if (editorDraft) {
      setDraft(null);
      setSelectedIds(new Set());
    }
  }, [!!editorDraft]);
  useEffect(() => {
    if (!editorDraft && editorDragging.current) cleanup.current();
  }, [!!editorDraft]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = position(480, rows) - 20;
    return () => cleanup.current();
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    function locate() {
      if (!media.matches || day !== null || editorDraft) return;
      requestAnimationFrame(() => {
        const container = scroll.current;
        if (!container) return;
        const target =
          focusDate ||
          (week === weekStart() ? belgradeToday() : week);
        const lane =
          container.querySelector<HTMLElement>(`[data-lane-date="${target}"]`) ||
          container.querySelector<HTMLElement>(`[data-lane-date="${belgradeToday()}"]`);
        if (lane)
          container.scrollLeft +=
            lane.getBoundingClientRect().left -
            container.getBoundingClientRect().left -
            (container
              .querySelector<HTMLElement>(".time-gutter")
              ?.getBoundingClientRect().width ?? 38);
        else container.scrollLeft = 0;
      });
    }
    locate();
    media.addEventListener("change", locate);
    return () => media.removeEventListener("change", locate);
  }, [week, day, online, focusDate]);
  useEffect(() => {
    try {
      localStorage.setItem("streberaj-row-heights", JSON.stringify(rows));
    } catch {}
  }, [rows]);
  const height = rows.reduce((a, b) => a + b, 0),
    dates = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(week, i),
      i,
    })).filter((x) => day === null || day === x.i);
  const activeDraft: LessonPreview | null =
    editorDraft ??
    (draft
      ? {
          ...draft,
          studentName: draft.name,
          teacherId: view.actor.id,
          duration: 45,
          units: 1,
          mode: draft.desk === null ? "online" : "in_person",
        }
      : null);
  const conflicts = activeDraft
    ? previewConflicts(view.lessons, activeDraft)
    : [];
  const conflictIds = new Set(conflicts.map((c) => c.lesson.id));
  useEffect(() => {
    if (!editorDraft || !scroll.current) return;
    if (editorDragging.current) return;
    const frame = requestAnimationFrame(() => {
      const container = scroll.current;
      if (!container) return;
      const lane = container.querySelector<HTMLElement>(
        `[data-lane-date="${editorDraft.date}"][data-lane-desk="${editorDraft.desk ?? "online"}"]`,
      );
      if (!lane) return;
      const box = lane.getBoundingClientRect(),
        viewport = container.getBoundingClientRect();
      if (box.left < viewport.left + 54 || box.right > viewport.right - 12)
        container.scrollLeft += box.left - viewport.left - 60;
      const top = position(editorDraft.start, rows),
        bottom = position(editorDraft.start + editorDraft.duration, rows);
      const panel = document.querySelector<HTMLElement>(
        ".modal-backdrop.live-preview .modal",
      );
      const visibleHeight =
        window.matchMedia("(max-width:760px)").matches && panel
          ? Math.max(
              100,
              Math.min(viewport.bottom, panel.getBoundingClientRect().top) -
                viewport.top,
            )
          : container.clientHeight;
      if (
        top < container.scrollTop ||
        bottom > container.scrollTop + visibleHeight - 105
      )
        container.scrollTop = Math.max(0, top - 36);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    editorDraft?.date,
    editorDraft?.start,
    editorDraft?.duration,
    editorDraft?.desk,
    editorDraft?.mode,
    week,
    day,
    online,
    rows,
  ]);
  useEffect(() => {
    setPending((current) => {
      const next = { ...current };
      let changed = false;
      for (const [key, patch] of Object.entries(current)) {
        const saved = view.lessons.find((l) => l.id === key);
        if (
          !saved ||
          ["date", "start", "duration", "desk", "mode"].every(
            (k) =>
              (saved as unknown as Record<string, unknown>)[k] ===
              (patch as unknown as Record<string, unknown>)[k],
          )
        ) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [view.lessons, pending]);
  const lessons = view.lessons
    .map((l) =>
      preview[l.id]
        ? { ...l, ...preview[l.id] }
        : pending[l.id]
          ? { ...l, ...pending[l.id] }
          : l,
    )
    .filter(
      (l) =>
        l.date >= week &&
        l.date <= addDays(week, 6) &&
        dates.some((d) => d.date === l.date) &&
        (!("deletedAt" in l) || !l.deletedAt) &&
        (!teacher || l.teacherId === teacher),
    );
  async function saveQuick(chosen?: Draft) {
    const data = chosen ?? draft;
    if (!data?.name.trim() || quickSaving.current) return;
    quickSaving.current = true;
    setQuickBusy(true);
    setQuickError("");
    if (chosen) setDraft(chosen);
    try {
      await onQuickAdd(data);
      setDraft(null);
    } catch (e) {
      setQuickError((e as Error).message);
    } finally {
      quickSaving.current = false;
      setQuickBusy(false);
    }
  }
  function resizeRow(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup.current();
    const y = e.clientY,
      original = rows[index];
    function move(ev: PointerEvent) {
      ev.preventDefault();
      const size = Math.max(16, Math.min(80, original + ev.clientY - y));
      setRows(Array.from({ length: SLOTS }, () => size));
    }
    function end() {
      cleanup.current();
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }
  const editable = lessons.filter(
    (l): l is Lesson => !("restricted" in l) && l.status !== "cancelled",
  );
  useEffect(() => {
    setSelectedIds(new Set());
    setDraft(null);
  }, [week, day, teacher, online]);
  async function removeSelected() {
    const ids = editable.filter((l) => selectedIds.has(l.id)).map((l) => l.id);
    if (!ids.length || deleting) return;
    setDeleting(true);
    try {
      await onDelete(ids);
      setSelectedIds(new Set());
    } catch {
    } finally {
      setDeleting(false);
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup.current();
        setPreview({});
        setMarquee(null);
        setDraft(null);
        setSelectedIds(new Set());
        document.body.classList.remove("calendar-grabbing");
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        void removeSelected();
        return;
      }
      if (
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key) &&
        selectedIds.size
      ) {
        e.preventDefault();
        const ordered = [...editable].sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.start - b.start ||
            (a.desk ?? 3) - (b.desk ?? 3),
        );
        const index = ordered.findIndex(
            (l) => l.id === (anchor.current ?? [...selectedIds].at(-1)),
          ),
          next =
            ordered[
              Math.max(
                0,
                Math.min(
                  ordered.length - 1,
                  index +
                    (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1),
                ),
              )
            ];
        if (next) {
          anchor.current = next.id;
          setSelectedIds(
            e.shiftKey
              ? new Set([...selectedIds, next.id])
              : new Set([next.id]),
          );
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function marqueeStart(e: React.PointerEvent) {
    if (editorDraft) return;
    if (
      e.button !== 0 ||
      e.pointerType === "touch" ||
      e.target !== e.currentTarget
    )
      return;
    cleanup.current();
    const x = e.clientX,
      y = e.clientY,
      additive = e.shiftKey || e.ctrlKey || e.metaKey,
      original = new Set(additive ? selectedIds : []);
    let moved = false;
    function move(ev: PointerEvent) {
      if (!moved && Math.abs(ev.clientX - x) + Math.abs(ev.clientY - y) < 5)
        return;
      moved = true;
      ev.preventDefault();
      const rect = {
        x: Math.min(x, ev.clientX),
        y: Math.min(y, ev.clientY),
        width: Math.abs(ev.clientX - x),
        height: Math.abs(ev.clientY - y),
      };
      setMarquee(rect);
      const next = new Set(original);
      scroll.current
        ?.querySelectorAll<HTMLElement>("[data-lesson-id]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (
            r.right >= rect.x &&
            r.left <= rect.x + rect.width &&
            r.bottom >= rect.y &&
            r.top <= rect.y + rect.height
          )
            next.add(el.dataset.lessonId!);
        });
      setSelectedIds(next);
    }
    function end() {
      cleanup.current();
      setMarquee(null);
      if (moved) suppress.current = Date.now() + 400;
      else if (!additive) setSelectedIds(new Set());
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }
  function gesture(e: React.PointerEvent, l: Lesson, resize = false) {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest("button,input,textarea") ||
      e.shiftKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    e.stopPropagation();
    cleanup.current();
    const origin = (e.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-lane-date]",
    )!;
    const x = e.clientX,
      y = e.clientY,
      initial = minuteAt(y - origin.getBoundingClientRect().top, rows),
      offset = initial - l.start;
    const group =
      !resize && selectedIds.has(l.id)
        ? editable.filter((item) => selectedIds.has(item.id))
        : [l];
    if (!selectedIds.has(l.id)) {
      setSelectedIds(new Set([l.id]));
      anchor.current = l.id;
    }
    const lanes = dates.flatMap((d) =>
      ([1, 2, ...(online ? [null] : [])] as (1 | 2 | null)[]).map((desk) => ({
        date: d.date,
        desk,
        mode: (desk === null ? "online" : "in_person") as Lesson["mode"],
      })),
    );
    const laneIndex = (lesson: Lesson | Move) =>
      lanes.findIndex(
        (col) =>
          col.date === lesson.date &&
          col.desk === (lesson.mode === "online" ? null : lesson.desk),
      );
    let moved = false,
      patches: Record<string, Move> = {};
    function move(ev: PointerEvent) {
      if (!moved && Math.abs(ev.clientX - x) + Math.abs(ev.clientY - y) < 6)
        return;
      moved = true;
      ev.preventDefault();
      document.body.classList.add("calendar-grabbing");
      if (resize) {
        const delta =
          Math.round(
            (minuteAt(ev.clientY - origin.getBoundingClientRect().top, rows) -
              initial) /
              15,
          ) * 15;
        patches = {
          [l.id]: {
            date: l.date,
            start: l.start,
            desk: l.desk,
            mode: l.mode,
            duration:
              snapDuration(l.duration + delta, END - l.start) ?? l.duration,
          },
        };
      } else {
        const lane = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-lane-date]");
        if (lane) {
          const desk =
            lane.dataset.laneDesk === "online"
              ? null
              : (Number(lane.dataset.laneDesk) as 1 | 2);
          const targetIndex = lanes.findIndex(
              (col) => col.date === lane.dataset.laneDate && col.desk === desk,
            ),
            indices = group.map(laneIndex);
          const columnDelta = Math.max(
            -Math.min(...indices),
            Math.min(
              lanes.length - 1 - Math.max(...indices),
              targetIndex - laneIndex(l),
            ),
          );
          const at =
            minuteAt(ev.clientY - lane.getBoundingClientRect().top, rows) -
            offset;
          const timeDelta = Math.max(
            START - Math.min(...group.map((g) => g.start)),
            Math.min(
              END - Math.max(...group.map((g) => g.start + g.duration)),
              Math.round((at - l.start) / 15) * 15,
            ),
          );
          patches = Object.fromEntries(
            group.map((item) => {
              const col = lanes[laneIndex(item) + columnDelta];
              return [
                item.id,
                {
                  ...col,
                  start: item.start + timeDelta,
                  duration: item.duration,
                },
              ];
            }),
          );
        }
      }
      setPreview(patches);
    }
    function cancel() {
      cleanup.current();
      setPreview({});
      suppress.current = Date.now() + 400;
    }
    function end() {
      cleanup.current();
      if (!moved) return;
      suppress.current = Date.now() + 400;
      const changed = group.filter(
        (item) =>
          patches[item.id] &&
          ["date", "start", "duration", "desk", "mode"].some(
            (k) =>
              (item as unknown as Record<string, unknown>)[k] !==
              (patches[item.id] as unknown as Record<string, unknown>)[k],
          ),
      );
      if (!changed.length) {
        setPreview({});
        return;
      }
      const saved = { ...patches },
        sequence = Object.fromEntries(
          changed.map((item) => {
            const seq = (sequences.current[item.id] ?? 0) + 1;
            sequences.current[item.id] = seq;
            return [item.id, seq];
          }),
        );
      setPending((old) => ({ ...old, ...saved }));
      setPreview({});
      const job = (queues.current.__all ?? Promise.resolve())
        .catch(() => {})
        .then(async (): Promise<Record<string, Move>> => {
          if (changed.length > 1)
            return onMoveMany(
              changed.map((item) => ({
                lesson: item,
                patch: saved[item.id],
              })),
            );
          const actual = await onMove(changed[0], saved[changed[0].id]);
          return actual ? { [changed[0].id]: actual } : {};
        });
      queues.current.__all = job.then(
        () => {},
        () => {},
      );
      void job
        .then((result) => {
          const actual = result;
          setPending((old) => {
            const next = { ...old };
            for (const item of changed)
              if (sequences.current[item.id] === sequence[item.id]) {
                if (actual[item.id]) next[item.id] = actual[item.id];
                else delete next[item.id];
              }
            return next;
          });
        })
        .catch(() => {});
      void job.catch(() =>
        setPending((old) => {
          const next = { ...old };
          for (const item of changed)
            if (sequences.current[item.id] === sequence[item.id])
              delete next[item.id];
          return next;
        }),
      );
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      document.body.classList.remove("calendar-grabbing");
    };
  }
  function editorGesture(e: React.PointerEvent, resize = false) {
    if (e.button !== 0 || !editorDraft || !onEditorMove) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup.current();
    editorDragging.current = true;
    const base = { ...editorDraft },
      origin = (e.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-lane-date]",
      )!,
      initial = minuteAt(e.clientY - origin.getBoundingClientRect().top, rows),
      offset = initial - base.start;
    document.body.classList.add("calendar-grabbing");
    function move(ev: PointerEvent) {
      ev.preventDefault();
      let patch: DraftMove = {
        date: base.date,
        start: base.start,
        duration: base.duration,
        desk: base.desk,
        mode: base.mode,
      };
      if (resize) {
        const delta =
            minuteAt(ev.clientY - origin.getBoundingClientRect().top, rows) -
            initial,
          unit = base.duration / base.units;
        const minutes =
          snapDuration(unit + delta, (END - base.start) / base.units) ?? unit;
        patch.duration = minutes * base.units;
      } else {
        const lane = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-lane-date]");
        if (!lane) return;
        const desk =
            lane.dataset.laneDesk === "online"
              ? null
              : (Number(lane.dataset.laneDesk) as 1 | 2),
          at =
            minuteAt(ev.clientY - lane.getBoundingClientRect().top, rows) -
            offset;
        patch = {
          ...patch,
          date: lane.dataset.laneDate!,
          desk,
          mode: desk === null ? "online" : "in_person",
          start: Math.max(
            START,
            Math.min(END - base.duration, Math.round(at / 15) * 15),
          ),
        };
      }
      patch.desk = resolveDesk(view.lessons, { ...base, ...patch });
      onEditorMove!(patch);
    }
    function end() {
      cleanup.current();
      suppress.current = Date.now() + 400;
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
    cleanup.current = () => {
      editorDragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("calendar-grabbing");
    };
  }
  function block(l: Lesson | BusyLesson, width?: string, left?: string) {
    const employee = view.employees.find((e) => e.id === l.teacherId)!,
      restricted = "restricted" in l,
      student = restricted
        ? null
        : view.students.find((s) => s.id === l.studentId),
      h = position(l.start + l.duration, rows) - position(l.start, rows) - 3;
    const paid =
      !restricted &&
      l.price !== null &&
      view.payments
        .filter((p) => p.lessonId === l.id && !p.voidedAt)
        .reduce((a, p) => a + p.amount, 0) >= l.price;
    return (
      <div
        role="button"
        data-lesson-id={restricted ? undefined : l.id}
        aria-pressed={!restricted && selectedIds.has(l.id)}
        tabIndex={0}
        key={l.id}
        title={employee.name}
        className={[
          "lesson-block",
          l.duration <= 45 ? "compact-duration" : "",
          h < 24
            ? "tiny-lesson"
            : h < 40
              ? "very-short-lesson short-lesson"
              : h < 64
                ? "short-lesson"
                : "",
          selectedIds.has(l.id) ? "is-selected" : "",
          conflictIds.has(l.id) ? "draft-conflict" : "",
          preview[l.id] ? "moving" : "",
        ].join(" ")}
        style={
          {
            "--lesson-time-size": `${l.duration <= 45 ? 11 : Math.min(14, Math.max(10.5, h / 6))}px`,
            "--lesson-counter-size": `${l.duration <= 45 ? 16 : Math.min(24, Math.max(21, h / 4))}px`,
            top: position(l.start, rows),
            height: h,
            background: employee.color,
            borderLeftColor: employee.color,
            width,
            left,
            color: ink(employee.color),
          } as React.CSSProperties
        }
        onPointerDown={(e) => !restricted && gesture(e, l)}
        onTouchStart={(e) => {
          if (
            !restricted &&
            !(e.target as HTMLElement).closest("button,input,textarea")
          )
            beginTouch(e, "lesson-" + l.id);
        }}
        onTouchEnd={(e) => {
          if (
            !restricted &&
            !(e.target as HTMLElement).closest("button,input,textarea")
          )
            endTouch(e, "lesson-" + l.id, () => onOpen(l));
        }}
        onTouchCancel={() => {
          touchOrigin.current = null;
          previousTap.current = null;
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!restricted) onOpen(l);
        }}
        onClick={(e) => {
          if (!restricted && Date.now() > suppress.current) {
            anchor.current = l.id;
            setSelectedIds((current) => {
              if (e.shiftKey || e.ctrlKey || e.metaKey) {
                const next = new Set(current);
                if (next.has(l.id)) next.delete(l.id);
                else next.add(l.id);
                return next;
              }
              return new Set([l.id]);
            });
          }
        }}
        onKeyDown={(e) => {
          if (!restricted && e.key === "Enter" && !e.altKey) {
            e.preventDefault();
            onOpen(l);
          }
          if (
            !restricted &&
            e.altKey &&
            (e.key === "ArrowDown" || e.key === "ArrowUp")
          ) {
            e.preventDefault();
            const d = e.key === "ArrowDown" ? 15 : -15;
            void onMove(l, {
              date: l.date,
              desk: l.desk,
              mode: l.mode,
              start: e.shiftKey
                ? l.start
                : Math.max(START, Math.min(END - l.duration, l.start + d)),
              duration: e.shiftKey
                ? stepDuration(l.duration, d, END - l.start)
                : l.duration,
            }).catch(() => {});
          }
        }}
        aria-label={
          (restricted ? l.studentName || "Čas" : student?.name) +
          ", " +
          clock(l.start) +
          "–" +
          clock(l.start + l.duration)
        }
      >
        <div className="lesson-title">
          <strong>
            {restricted
              ? l.studentName || "Čas"
              : student?.name || "Poveži učenika"}
          </strong>
          {!restricted && student && (
            <span className="lesson-counter">
              <PackageCounter
                student={student}
                cycle={l.cycleNumbers?.[0] ?? student.cycle}
                size={l.cycleSize ?? student.packageSize ?? 4}
                onCorrect={(number, size, scope) =>
                  onCounter(l.id, 0, number, size, scope)
                }
                onChange={(size) => onPackage(student.id, size)}
              />
            </span>
          )}
        </div>
        {!restricted && (l.units ?? 1) > 1 && (
          <div className="lesson-units">
            {Array.from({ length: l.units! }, (_, i) => (
              <div
                key={i}
                className="lesson-unit"
                style={{
                  top:
                    position(l.start + (i * l.duration) / l.units!, rows) -
                    position(l.start, rows),
                  height:
                    position(
                      l.start + ((i + 1) * l.duration) / l.units!,
                      rows,
                    ) - position(l.start + (i * l.duration) / l.units!, rows),
                }}
              >
                <span>
                  {i + 1}. · {l.duration / l.units!} min
                </span>
                {i > 0 && student && (
                  <PackageCounter
                    student={student}
                    cycle={l.cycleNumbers?.[i] ?? student.cycle}
                    size={l.cycleSize ?? student.packageSize ?? 4}
                    onCorrect={(number, size, scope) =>
                      onCounter(l.id, i, number, size, scope)
                    }
                    onChange={(size) => onPackage(student.id, size)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <LessonTime
          start={l.start}
          duration={l.duration}
          paid={paid}
          maxFont={l.duration <= 45 ? 11 : Math.min(14, Math.max(10.5, h / 6))}
        />
        <span className="lesson-teacher">
          {employee.name.split(" ")[0]}
          {!restricted && l.conflict && " · !"}
        </span>
        {!restricted && (
          <>
            <button
              className="lesson-pencil"
              aria-label={"Uredi čas: " + student?.name}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(l);
              }}
            >
              <Pencil size={11} />
            </button>
            <span
              className="resize-handle"
              title="Prevucite za promenu trajanja"
              onPointerDown={(e) => gesture(e, l, true)}
            >
              <i />
            </span>
          </>
        )}
      </div>
    );
  }
  return (
    <>
      {selectedIds.size > 0 && (
        <div className="selection-toolbar">
          <strong>Izabrano: {selectedIds.size}</strong>
          <span>Shift + klik za više · Del briše · Esc otkazuje</span>
          <button
            className="btn small danger"
            disabled={deleting}
            onClick={() => void removeSelected()}
          >
            <Trash2 size={14} />
            Obriši izabrane
          </button>
          <button
            className="icon-btn"
            aria-label="Poništi izbor časova"
            onClick={() => setSelectedIds(new Set())}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {marquee && (
        <div
          className="selection-marquee"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      )}
      <div
        className="calendar-scroll"
        ref={scroll}
        role="region"
        aria-label="Nedeljni raspored"
        tabIndex={0}
      >
        <div
          className={
            "calendar-grid " +
            (online ? "has-online " : "") +
            (day !== null ? "single-day" : "")
          }
          style={{
            gridTemplateColumns:
              "38px repeat(" +
              dates.length +
              ", minmax(" +
              (day !== null ? "240" : online ? "264" : "176") +
              "px, 1fr))",
          }}
        >
          <div className="time-head">
            <button
              className="reset-rows"
              aria-label="Vrati podrazumevanu visinu svih redova"
              onClick={() => setRows(defaultRows())}
            >
              Default
            </button>
            <span
              className="height-grip"
              title="Povucite za visinu svih redova"
              onPointerDown={(e) => resizeRow(e, 0)}
            >
              <MoveVertical size={11} />
            </span>
          </div>
          {dates.map(({ date, i }) => (
            <div
              className={
                "day-head " + (date === belgradeToday() ? "today" : "")
              }
              key={date}
            >
              <span>{DAYS[i]}</span>
              <strong>
                {Number(date.slice(8))}.
                <small>{Number(date.slice(5, 7))}.</small>
              </strong>
              <div className="desk-labels">
                <span>Prvi sto</span>
                <span>Drugi sto</span>
                {online && <span>Online</span>}
              </div>
            </div>
          ))}
          <div className="time-gutter" style={{ height }}>
            {Array.from({ length: SLOTS + 1 }, (_, q) => (
              <span
                className={q % 4 === 0 ? "whole-hour" : "quarter-hour"}
                key={q}
                style={{
                  top: position(START + q * 15, rows),
                }}
              >
                {clock(START + q * 15)}
              </span>
            ))}
            {rows.map((size, q) => (
              <div
                key={q}
                className="row-resizer"
                role="separator"
                tabIndex={0}
                aria-label={"Visina reda " + clock(START + q * 15)}
                aria-orientation="horizontal"
                aria-valuenow={Math.round(size)}
                aria-valuemin={16}
                aria-valuemax={80}
                style={{ top: position(START + (q + 1) * 15, rows) - 3 }}
                onPointerDown={(e) => resizeRow(e, q)}
                onDoubleClick={() => setRows(defaultRows())}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setRows((r) =>
                      Array.from({ length: SLOTS }, () =>
                        Math.max(
                          16,
                          Math.min(80, r[q] + (e.key === "ArrowDown" ? 4 : -4)),
                        ),
                      ),
                    );
                  }
                }}
              />
            ))}
          </div>
          {dates.map(({ date, i }) => (
            <div
              className={"day-body " + (i > 4 ? "weekend" : "")}
              key={date}
              style={{
                height,
                gridTemplateColumns:
                  "repeat(" + (online ? 3 : 2) + ",minmax(0,1fr))",
                backgroundImage: "none",
              }}
            >
              {Array.from({ length: SLOTS + 1 }, (_, q) => (
                <div
                  className={
                    "time-grid-line " + (q % 4 === 0 ? "hour-line" : "")
                  }
                  key={q}
                  style={{ top: position(START + q * 15, rows) }}
                  aria-hidden="true"
                >
                  {hourGuides &&
                    q % 4 === 0 &&
                    Array.from({ length: online ? 2 : 1 }, (_, divider) => (
                      <span
                        className="grid-hour-label"
                        key={divider}
                        style={{
                          left: `${((divider + 1) * 100) / (online ? 3 : 2)}%`,
                        }}
                      >
                        {clock(START + q * 15)}
                      </span>
                    ))}
                </div>
              ))}
              {([1, 2, ...(online ? [null] : [])] as (1 | 2 | null)[]).map(
                (desk) => {
                  const list = lessons.filter(
                    (l) =>
                      l.id !== editorDraft?.id &&
                      l.date === date &&
                      (desk === null
                        ? l.mode === "online"
                        : l.mode === "in_person" && l.desk === desk) &&
                      ("restricted" in l || l.status !== "cancelled"),
                  );
                  return (
                    <div
                      className={
                        "desk-lane " + (desk === null ? "online-lane" : "")
                      }
                      data-lane-date={date}
                      data-lane-desk={desk ?? "online"}
                      key={desk ?? "online"}
                      onPointerDown={marqueeStart}
                      onTouchStart={(e) => {
                        if (e.target === e.currentTarget && !editorDraft)
                          beginTouch(e, date + "-" + desk);
                      }}
                      onTouchEnd={(e) => {
                        if (e.target === e.currentTarget && !editorDraft) {
                          const top =
                            e.currentTarget.getBoundingClientRect().top;
                          endTouch(e, date + "-" + desk, (point) =>
                            openQuick(date, desk, point.clientY, top),
                          );
                        }
                      }}
                      onTouchCancel={() => {
                        touchOrigin.current = null;
                        previousTap.current = null;
                      }}
                      onDoubleClick={(e) => {
                        if (
                          editorDraft ||
                          e.target !== e.currentTarget ||
                          Date.now() < suppress.current
                        )
                          return;
                        openQuick(
                          date,
                          desk,
                          e.clientY,
                          e.currentTarget.getBoundingClientRect().top,
                        );
                      }}
                    >
                      {list.map((l) => {
                        const overlaps = list.filter(
                            (o) =>
                              o.start < l.start + l.duration &&
                              o.start + o.duration > l.start,
                          ),
                          pos = overlaps.findIndex((o) => o.id === l.id);
                        return block(
                          l,
                          desk === null && overlaps.length > 1
                            ? 100 / overlaps.length + "%"
                            : undefined,
                          desk === null && overlaps.length > 1
                            ? (pos * 100) / overlaps.length + "%"
                            : undefined,
                        );
                      })}
                      {editorDraft?.date === date &&
                        editorDraft.desk === desk &&
                        Array.from(
                          { length: editorDraft.units },
                          (_, index) => {
                            const duration =
                                editorDraft.duration / editorDraft.units,
                              start = editorDraft.start + index * duration,
                              problem =
                                !!editorDraft.error ||
                                conflicts.some(
                                  (c) =>
                                    c.lesson.start < start + duration &&
                                    c.lesson.start + c.lesson.duration > start,
                                );
                            return (
                              <div
                                key={"preview-" + index}
                                className={
                                  "editor-lesson-preview " +
                                  (problem ? "has-conflict" : "")
                                }
                                role="button"
                                tabIndex={0}
                                onPointerDown={(e) => editorGesture(e)}
                                aria-label={`Pregled: ${editorDraft.studentName}, ${clock(start)}–${clock(start + duration)}${problem ? ", preklapanje" : ""}`}
                                style={{
                                  top: position(start, rows),
                                  height: Math.max(
                                    12,
                                    position(start + duration, rows) -
                                      position(start, rows) -
                                      3,
                                  ),
                                  borderColor: problem ? "#d93232" : "#d99320",
                                  background: problem ? "#fff2f2" : "#fff1bd",
                                }}
                              >
                                <strong>{editorDraft.studentName}</strong>
                                <LessonTime
                                  start={start}
                                  duration={duration}
                                  maxFont={duration <= 45 ? 11 : 13}
                                />
                                {problem && <b>Preklapanje</b>}
                                <span
                                  className="editor-resize-handle"
                                  title="Povucite za promenu trajanja novog časa"
                                  onPointerDown={(e) => editorGesture(e, true)}
                                >
                                  <i />
                                </span>
                              </div>
                            );
                          },
                        )}
                      {draft?.date === date && draft.desk === desk && (
                        <div
                          className={
                            "quick-lesson " +
                            (conflicts.length ? "quick-has-conflict" : "")
                          }
                          style={{
                            top: position(draft.start, rows),
                            height:
                              position(draft.start + 45, rows) -
                              position(draft.start, rows),
                            background: conflicts.length
                              ? "#fff2f2"
                              : "#fff1bd",
                            color: conflicts.length ? "#b22121" : "#65420c",
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <div className="quick-top">
                            <span>
                              {clock(draft.start)}–{clock(draft.start + 45)} ·
                              45 min
                            </span>
                            <button
                              aria-label="Podrobno uredi novi čas"
                              onClick={() => {
                                onNew(
                                  draft.date,
                                  draft.start,
                                  draft.desk,
                                  draft.name,
                                );
                                setDraft(null);
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                          <StudentAutocomplete
                            students={view.students}
                            autoFocus
                            label="Ime učenika za novi čas"
                            value={draft.name}
                            disabled={quickBusy}
                            onChange={(name) =>
                              setDraft({ ...draft, name, studentId: undefined })
                            }
                            onSelect={(s) =>
                              void saveQuick({
                                ...draft,
                                name: s.name,
                                studentId: s.id,
                              })
                            }
                            onSubmit={() => void saveQuick()}
                            onEscape={() => setDraft(null)}
                            onBlur={(target) => {
                              if (
                                !(target instanceof Element) ||
                                !target.closest(".quick-lesson")
                              ) {
                                if (draft.name.trim()) void saveQuick();
                              }
                            }}
                          />
                          <div className="quick-actions">
                            <button
                              aria-label="Sačuvaj brzi čas"
                              disabled={quickBusy || !draft.name.trim()}
                              onClick={() => void saveQuick()}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              aria-label="Otkaži brzi unos"
                              onClick={() => setDraft(null)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {quickError && (
                            <div className="quick-error" role="alert">
                              {quickError}
                            </div>
                          )}
                          {!!conflicts.length && (
                            <span className="quick-conflict-label">
                              {conflicts[0].reason}:{" "}
                              {clock(conflicts[0].lesson.start)}–
                              {clock(
                                conflicts[0].lesson.start +
                                  conflicts[0].lesson.duration,
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
