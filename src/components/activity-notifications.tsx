"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { clock, dateLabel } from "@/lib/time";
import type { SchoolView } from "@/lib/types";
import {
  enableNotificationSounds,
  playNotificationSound,
} from "@/lib/notification-sounds";

type Notification = {
  id: string;
  title: string;
  detail?: string;
  dismiss?: boolean;
  kind?: "lesson-saved";
};
export type Activity = Omit<Notification, "id">;

function changes(previous: SchoolView, current: SchoolView): Activity[] {
  const events: Activity[] = [];
  const name = (id: string) =>
    current.employees.find((employee) => employee.id === id)?.name ??
    "Zaposleni";
  const reset = current.audits.find(
    (audit) =>
      audit.action === "Raspored očišćen i ponovo uvezen" &&
      !previous.audits.some((old) => old.id === audit.id),
  );
  if (reset)
    return reset.actorId === current.actor.id
      ? []
      : [
          {
            title: `${name(reset.actorId)} · Raspored je ponovo uvezen iz Google tabele`,
          },
        ];
  const excerpt = (text: string) => text.replace(/\s+/g, " ").slice(0, 100);
  const oldMessages = new Map(
    previous.messages.map((message) => [message.id, message]),
  );
  for (const message of current.messages) {
    const old = oldMessages.get(message.id);
    if (message.authorId !== current.actor.id) {
      const title =
        !old && !message.deletedAt
          ? "Nova poruka"
          : old && !message.deletedAt && message.editedAt !== old.editedAt
            ? "Izmenjena poruka"
            : "";
      if (title)
        events.push({
          title: `${name(message.authorId)} · ${title}`,
          detail: excerpt(message.text),
        });
      if (old && !old.deletedAt && message.deletedAt)
        events.push({ title: `${name(message.authorId)} · Obrisana poruka` });
    }
    if (old && !message.deletedAt && message.pinned && !old.pinned)
      events.push({ title: "Zakačena poruka", detail: excerpt(message.text) });
    if (old && !message.deletedAt && message.authorId === current.actor.id) {
      const likedBy = message.likedBy.filter(
        (id) => id !== current.actor.id && !old.likedBy.includes(id),
      );
      if (likedBy.length)
        events.push({
          title: `${name(likedBy[0])} · Sviđanje vaše poruke`,
          detail: excerpt(message.text),
        });
    }
  }
  const oldLessons = new Map(
    previous.lessons.map((lesson) => [lesson.id, lesson]),
  );
  const active = (lesson: SchoolView["lessons"][number]) =>
    !("deletedAt" in lesson && lesson.deletedAt) &&
    !("status" in lesson && lesson.status === "cancelled");
  const signature = (lesson: SchoolView["lessons"][number]) =>
    JSON.stringify([
      lesson.date,
      lesson.start,
      lesson.duration,
      lesson.desk,
      lesson.mode,
      lesson.teacherId,
      "studentId" in lesson ? lesson.studentId : lesson.studentName,
    ]);
  const handled = new Set<string>();
  for (const lesson of current.lessons) {
    const old = oldLessons.get(lesson.id);
    const audit = current.audits.find((item) => item.entityId === lesson.id);
    if (audit?.actorId === current.actor.id) continue;
    let action = "";
    if (active(lesson) && (!old || !active(old))) action = "Dodat čas";
    else if (old && active(old) && !active(lesson)) action = "Obrisan čas";
    else if (old && active(lesson) && signature(old) !== signature(lesson))
      action = "Izmenjen čas";
    if (!action) continue;
    handled.add(lesson.id);
    const student =
      "studentId" in lesson
        ? current.students.find((item) => item.id === lesson.studentId)?.name
        : lesson.studentName;
    events.push({
      title: `${name(audit?.actorId ?? lesson.teacherId)} · ${action}`,
      detail: `${student ?? "Čas"} · ${dateLabel(lesson.date)} ${clock(lesson.start)}`,
      kind:
        action === "Dodat čas" || action === "Izmenjen čas"
          ? "lesson-saved"
          : undefined,
    });
  }
  for (const old of previous.lessons) {
    if (
      active(old) &&
      !current.lessons.some((lesson) => lesson.id === old.id)
    ) {
      handled.add(old.id);
      events.push({
        title: `${name(old.teacherId)} · Uklonjen čas iz rasporeda`,
        detail: `${dateLabel(old.date)} ${clock(old.start)}`,
      });
    }
  }
  const oldAudits = new Set(previous.audits.map((audit) => audit.id));
  for (const audit of [...current.audits].reverse()) {
    if (
      oldAudits.has(audit.id) ||
      handled.has(audit.entityId) ||
      audit.actorId === current.actor.id ||
      !current.employees.some((employee) => employee.id === audit.actorId)
    )
      continue;
    events.push({ title: `${name(audit.actorId)} · ${audit.action}` });
  }
  return events;
}

function NotificationCard({
  item,
  onRemove,
  soundEnabled,
}: {
  item: Notification;
  onRemove: (id: string) => void;
  soundEnabled: boolean;
}) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (soundEnabled) playNotificationSound(item.kind === "lesson-saved");
  }, [item.kind, soundEnabled]);
  useEffect(() => {
    if (item.dismiss) setLeaving(true);
  }, [item.dismiss]);
  useEffect(() => {
    if (paused || leaving) return;
    const timer = window.setTimeout(() => setLeaving(true), 1830);
    return () => window.clearTimeout(timer);
  }, [paused, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onRemove(item.id), 220);
    return () => window.clearTimeout(timer);
  }, [leaving, item.id, onRemove]);
  return (
    <div
      className={"activity-notification" + (leaving ? " is-leaving" : "")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div>
        <article
          className={
            "activity-notification-card" +
            (item.kind === "lesson-saved" ? " is-success" : "")
          }
          title={item.detail ? `${item.title}: ${item.detail}` : item.title}
        >
          {item.kind === "lesson-saved" ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Bell size={17} aria-hidden="true" />
          )}
          <div>
            <strong>{item.title}</strong>
            {item.detail && <p>{item.detail}</p>}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Zatvori obaveštenje"
            onClick={() => setLeaving(true)}
          >
            <X size={15} />
          </button>
        </article>
      </div>
    </div>
  );
}

export default function ActivityNotifications({
  view,
  notice,
  onConsume,
  onActivity,
  enabled = true,
  soundEnabled = false,
}: {
  view: SchoolView;
  notice: string;
  onConsume: () => void;
  onActivity?: (events: Activity[]) => void;
  enabled?: boolean;
  soundEnabled?: boolean;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const previous = useRef<SchoolView | null>(null);
  useEffect(() => {
    if (enabled && soundEnabled) return enableNotificationSounds();
  }, [enabled, soundEnabled]);
  const remove = useCallback(
    (id: string) =>
      setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const add = useCallback(
    (events: Activity[]) => {
      if (!events.length) return;
      onActivity?.(events);
      const compact: Activity[] =
      events.length > 3
        ? [
            ...events.slice(-2),
            {
              title: `Još ${events.length - 2} izmena`,
              detail: "Podaci u aplikaciji su osveženi.",
            },
          ]
        : events;
    setItems((current) => {
      const merged: Notification[] = [
        ...current,
        ...compact.map((event) => ({ ...event, id: crypto.randomUUID() })),
      ];
      return merged.slice(0, 5);
    });
  }, []);
  useEffect(() => {
    const old = previous.current;
    previous.current = view;
    if (!old || old.actor.id !== view.actor.id || !enabled) {
      setItems([]);
      return;
    }
    add(changes(old, view));
  }, [view, add, enabled]);
  useEffect(() => {
    if (!notice) return;
    if (!enabled) {
      onConsume();
      return;
    }
    add([
      {
        title: notice,
        kind:
          notice === "Čas je sačuvan." || notice === "Časovi su sačuvani."
            ? "lesson-saved"
            : undefined,
      },
    ]);
    onConsume();
  }, [notice, add, onConsume, enabled]);
  return (
    <aside
      className="activity-notifications"
      aria-label="Obaveštenja"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {enabled && items[0] && (
        <NotificationCard
          key={items[0].id}
          item={items[0]}
          onRemove={remove}
          soundEnabled={soundEnabled}
        />
      )}
    </aside>
  );
}
