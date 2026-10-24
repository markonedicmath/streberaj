"use client";
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  Pin,
  Reply,
  Pencil,
  Trash2,
  Send,
  X,
  Search,
  Check,
} from "lucide-react";
import type { SchoolView, StaffMessage } from "@/lib/types";
import type { Command } from "./forms";
import EmojiPicker from "./emoji-picker";
import { textForColor, contrast } from "@/lib/staff-colors";
import { isDoubleTap, type Tap } from "@/lib/tap";
export default function StaffNotes({
  view,
  command,
}: {
  view: SchoolView;
  command: Command;
}) {
  const [text, setText] = useState(""),
    [reply, setReply] = useState<StaffMessage | null>(null),
    [editing, setEditing] = useState<StaffMessage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [pinnedOnly, setPinnedOnly] = useState(false),
    [swipe, setSwipe] = useState<{ id: string; x: number } | null>(null),
    [heart, setHeart] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    nearBottom = useRef(true);
  const gestureCleanup = useRef<() => void>(() => {}),
    previousTap = useRef<Tap | null>(null),
    lastLike = useRef(0),
    heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      gestureCleanup.current();
      if (heartTimer.current) clearTimeout(heartTimer.current);
    },
    [],
  );
  const messages = (view.messages ?? []).filter((m) => !m.deletedAt),
    shown = messages.filter(
      (m) =>
        (!pinnedOnly || m.pinned) &&
        (!query ||
          m.text
            .toLocaleLowerCase("sr")
            .includes(query.toLocaleLowerCase("sr"))),
    ),
    pins = messages.filter((m) => m.pinned);
  useEffect(() => {
    if (nearBottom.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [view.messages?.length]);
  async function action(type: string, payload: unknown) {
    setError("");
    try {
      await command(type, payload);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function cancel() {
    setText("");
    setReply(null);
    setEditing(null);
  }
  function beginReply(message: StaffMessage) {
    setReply(message);
    setEditing(null);
    input.current?.focus();
  }
  function like(message: StaffMessage) {
    if (Date.now() - lastLike.current < 500) return;
    lastLike.current = Date.now();
    setHeart(message.id);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeart(null), 700);
    if (!message.likedBy.includes(view.actor.id))
      void action("likeMessage", { id: message.id, liked: true });
  }
  function messageGesture(e: React.PointerEvent, message: StaffMessage) {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest("button,input,textarea,a")
    )
      return;
    gestureCleanup.current();
    const x = e.clientX,
      y = e.clientY,
      at = Date.now(),
      pointerType = e.pointerType,
      top = list.current?.scrollTop ?? 0;
    let offset = 0,
      dragged = false;
    function move(ev: PointerEvent) {
      const dx = ev.clientX - x,
        dy = ev.clientY - y;
      if (!dragged && (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.3))
        return;
      dragged = true;
      ev.preventDefault();
      window.getSelection()?.removeAllRanges();
      offset = Math.max(-90, Math.min(90, dx));
      setSwipe({ id: message.id, x: offset });
    }
    function end(ev: PointerEvent) {
      gestureCleanup.current();
      setSwipe(null);
      if (dragged) {
        previousTap.current = null;
        lastLike.current = Date.now();
        if (Math.abs(offset) >= 60) beginReply(message);
        return;
      }
      if (
        pointerType === "touch" &&
        Date.now() - at < 400 &&
        Math.hypot(ev.clientX - x, ev.clientY - y) < 14
      ) {
        const tap: Tap = {
          key: message.id,
          x: ev.clientX,
          y: ev.clientY,
          at: Date.now(),
          scrollTop: top,
          scrollLeft: 0,
        };
        if (
          isDoubleTap(previousTap.current, tap) &&
          Math.abs((list.current?.scrollTop ?? 0) - top) < 3
        ) {
          previousTap.current = null;
          ev.preventDefault();
          like(message);
        } else previousTap.current = tap;
      }
    }
    function cancelGesture() {
      gestureCleanup.current();
      setSwipe(null);
      previousTap.current = null;
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", cancelGesture, { once: true });
    gestureCleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancelGesture);
    };
  }
  function insertEmoji(emoji: string) {
    const start = input.current?.selectionStart ?? text.length,
      end = input.current?.selectionEnd ?? start;
    setText((value) => value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(
        start + emoji.length,
        start + emoji.length,
      );
    });
  }
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await command(
        editing ? "editMessage" : "postMessage",
        editing ? { id: editing.id, text } : { text, replyTo: reply?.id },
      );
      cancel();
      nearBottom.current = true;
      input.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-chat">
      <header className="chat-header">
        <div>
          <p>
            {view.employees
              .filter((e) => e.active)
              .map((e) => e.name.split(" ")[0])
              .join(", ")}
          </p>
        </div>
        <div className="chat-tools">
          <label>
            <Search size={16} />
            <input
              aria-label="Pretraži poruke"
              placeholder="Pretraži poruke…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className={"btn small " + (pinnedOnly ? "selected" : "")}
            onClick={() => setPinnedOnly(!pinnedOnly)}
          >
            <Pin size={15} />
            Zakačene ({pins.length})
          </button>
        </div>
      </header>
      {pins.length > 0 && !pinnedOnly && (
        <button className="pinned-preview" onClick={() => setPinnedOnly(true)}>
          <Pin size={14} />
          <strong>Zakačeno</strong>
          <span>{pins[pins.length - 1].text}</span>
        </button>
      )}
      <div
        className="chat-messages"
        ref={list}
        onScroll={() => {
          const el = list.current!;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        {!shown.length && (
          <p className="chat-empty">
            {query || pinnedOnly
              ? "Nema poruka za ovaj prikaz."
              : "Ovde razmenjujemo poruke i dogovaramo se o časovima."}
          </p>
        )}
        {shown.map((m, index) => {
          const author = view.employees.find((e) => e.id === m.authorId),
            own = m.authorId === view.actor.id,
            parent = messages.find((p) => p.id === m.replyTo),
            day = new Date(m.createdAt).toLocaleDateString("sr-Latn-RS", {
              timeZone: "Europe/Belgrade",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            previous = shown[index - 1];
          return (
            <div key={m.id}>
              {(!previous ||
                new Date(previous.createdAt).toLocaleDateString("sr-Latn-RS", {
                  timeZone: "Europe/Belgrade",
                }) !==
                  new Date(m.createdAt).toLocaleDateString("sr-Latn-RS", {
                    timeZone: "Europe/Belgrade",
                  })) && <div className="chat-date">{day}</div>}
              <article
                className={"chat-row " + (own ? "own" : "")}
                id={"poruka-" + m.id}
              >
                {!own && (
                  <span
                    className="chat-avatar"
                    style={{
                      background: author?.color,
                      color: author ? textForColor(author.color) : "#fff",
                    }}
                  >
                    {author?.name[0]}
                  </span>
                )}
                <div
                  className={
                    "chat-bubble " + (swipe?.id === m.id ? "swiping" : "")
                  }
                  style={{
                    transform:
                      swipe?.id === m.id
                        ? `translateX(${swipe.x}px)`
                        : undefined,
                  }}
                  onPointerDown={(e) => messageGesture(e, m)}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    e.preventDefault();
                    window.getSelection()?.removeAllRanges();
                    like(m);
                  }}
                >
                  {swipe?.id === m.id && (
                    <span
                      className="reply-swipe-hint"
                      style={{
                        opacity: Math.min(1, Math.abs(swipe.x) / 60),
                        ...(swipe.x < 0 ? { left: "auto", right: -36 } : {}),
                      }}
                    >
                      <Reply size={20} />
                    </span>
                  )}
                  {heart === m.id && (
                    <span className="message-like-heart">
                      <Heart size={32} fill="currentColor" />
                    </span>
                  )}
                  <strong
                    className="chat-author"
                    style={{
                      color: own
                        ? undefined
                        : author && contrast(author.color, "#ffffff") >= 4.5
                          ? author.color
                          : "#161616",
                    }}
                  >
                    {author?.name ?? "Zaposleni"}
                    {m.pinned && <Pin size={12} />}
                  </strong>
                  {m.replyTo && (
                    <button
                      className="chat-quote"
                      onClick={() =>
                        document
                          .getElementById("poruka-" + m.replyTo)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          })
                      }
                    >
                      <strong>
                        {view.employees.find((e) => e.id === parent?.authorId)
                          ?.name ?? "Poruka"}
                      </strong>
                      <span>{parent?.text ?? "Poruka je obrisana"}</span>
                    </button>
                  )}
                  <p>{m.text}</p>
                  <div className="chat-meta">
                    {m.editedAt && <span>izmenjeno</span>}
                    <time>
                      {new Date(m.createdAt).toLocaleTimeString("sr-Latn-RS", {
                        timeZone: "Europe/Belgrade",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {own && <Check size={12} />}
                  </div>
                  <div className="chat-actions">
                    <button
                      className={
                        m.likedBy.includes(view.actor.id) ? "liked" : ""
                      }
                      aria-label="Sviđa mi se"
                      aria-pressed={m.likedBy.includes(view.actor.id)}
                      onClick={() => void action("likeMessage", { id: m.id })}
                    >
                      <Heart size={14} />
                      {m.likedBy.length || ""}
                    </button>
                    <button
                      aria-label="Odgovori na poruku"
                      onClick={() => {
                        beginReply(m);
                      }}
                    >
                      <Reply size={14} />
                    </button>
                    <button
                      aria-label={m.pinned ? "Otkači poruku" : "Zakači poruku"}
                      onClick={() => void action("pinMessage", { id: m.id })}
                    >
                      <Pin size={14} />
                    </button>
                    {own && (
                      <button
                        aria-label="Uredi poruku"
                        onClick={() => {
                          setEditing(m);
                          setText(m.text);
                          setReply(null);
                          input.current?.focus();
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {(own || view.actor.role === "admin") && (
                      <button
                        aria-label="Obriši poruku"
                        onClick={() =>
                          void action("deleteMessage", { id: m.id })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
      <footer className="chat-compose">
        {(reply || editing) && (
          <div className="compose-context">
            <Reply size={16} />
            <div>
              <strong>
                {editing
                  ? "Uređivanje poruke"
                  : "Odgovor: " +
                    view.employees.find((e) => e.id === reply?.authorId)?.name}
              </strong>
              <span>{(editing ?? reply)?.text}</span>
            </div>
            <button
              className="icon-btn"
              aria-label="Otkaži uređivanje poruke"
              onClick={cancel}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="compose-row">
          <EmojiPicker onPick={insertEmoji} />
          <textarea
            ref={input}
            aria-label="Nova poruka"
            placeholder="Napišite poruku…"
            value={text}
            maxLength={6000}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="btn primary"
            disabled={busy || !text.trim()}
            onClick={() => void send()}
            aria-label={editing ? "Sačuvaj poruku" : "Pošalji poruku"}
          >
            <Send size={19} />
          </button>
        </div>
        <small>Enter šalje · Shift + Enter novi red</small>
      </footer>
    </section>
  );
}
