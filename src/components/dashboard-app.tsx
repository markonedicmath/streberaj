"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Users,
  Wallet,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sheet,
  X,
  Undo2,
  Redo2,
  MessageCircle,
  LogOut,
  Settings,
} from "lucide-react";
import Calendar from "./calendar";
import StaffNotes from "./staff-notes";
import ActivityNotifications from "./activity-notifications";
import ResetBoard from "./reset-board";
import AccountSelect from "./account-select";
import SettingsPanel from "./settings-panel";
import { useQueuedToggle } from "./use-queued-toggle";
import { GoogleAutoSync } from "./google-connection";
import PackageCounter from "./package-counter";
import { textForColor } from "@/lib/staff-colors";
import { TARIFFS } from "@/lib/pricing";
import {
  LessonEditor,
  StudentEditor,
  EmployeeEditor,
  RuleEditor,
  Modal,
  CHANNELS,
  StudentCreatedLabel,
  type Command,
  type NewLesson,
} from "./forms";
import { Finance, SourcePanel, SyncEditor } from "./reports";
import {
  addDays,
  belgradeToday,
  dateLabel,
  weekStart,
  clock,
  money,
} from "@/lib/time";
import type {
  Lesson,
  SchoolView,
  Employee,
  Student,
  RateRule,
  LessonPreview,
  DraftMoveUpdate,
} from "@/lib/types";
function cleanCode(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isBojanMatch(str: string): boolean {
  return cleanCode(str).includes("bojanbasic");
}

export default function Dashboard() {
  const [view, setView] = useState<SchoolView | null>(null),
    [loading, setLoading] = useState(true),
    [loginError, setLoginError] = useState(""),
    [notice, setNotice] = useState(""),
    [week, setWeek] = useState(() => weekStart()),
    [day, setDay] = useState<number | null>(null),
    [online, setOnline] = useState(false),
    [hourGuides, setHourGuides] = useState(() => {
      try {
        return localStorage.getItem("streberaj-hour-guides") !== "0";
      } catch {
        return true;
      }
    }),
    [teacher, setTeacher] = useState(""),
    [tab, setTab] = useState("Raspored"),
    [source, setSource] = useState(false),
    [lessonId, setLessonId] = useState<string | null>(null),
    [slot, setSlot] = useState<NewLesson | null>(null),
    [lessonPreview, setLessonPreview] = useState<LessonPreview | null>(null),
    [draftMove, setDraftMove] = useState<DraftMoveUpdate | null>(null),
    [studentEdit, setStudentEdit] = useState<Student | "new" | null>(null),
    [studentCard, setStudentCard] = useState<string | null>(null),
    [employeeEdit, setEmployeeEdit] = useState<Employee | "new" | null>(null),
    [ruleEdit, setRuleEdit] = useState<RateRule | "new" | null>(null),
    [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);
  const [troubleshootPass, setTroubleshootPass] = useState("");
  const [troubleshootWorkers, setTroubleshootWorkers] = useState<
    Array<{ id: string; name: string; role: string; color: string }>
  >([]);
  const [troubleshootLoading, setTroubleshootLoading] = useState(false);
  const [troubleshootError, setTroubleshootError] = useState("");
  const [guyClicked, setGuyClicked] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const permissions = useQueuedToggle();

  const fetchWorkers = useCallback(async (code: string) => {
    setTroubleshootLoading(true);
    setTroubleshootError("");
    try {
      const res = await fetch(`/api/troubleshoot?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Neispravna lozinka.");
      setTroubleshootWorkers(data.workers || []);
      setTroubleshootOpen(true);
    } catch (err) {
      setTroubleshootError((err as Error).message);
    } finally {
      setTroubleshootLoading(false);
    }
  }, []);

  const handleGuyClick = () => {
    setGuyClicked(true);
    mobileInputRef.current?.focus();
  };

  useEffect(() => {
    let keyBuffer = "";
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-25);
      if (isBojanMatch(keyBuffer)) {
        keyBuffer = "";
        setTroubleshootPass("bojanbasic");
        void fetchWorkers("bojanbasic");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fetchWorkers]);
  useEffect(() => {
    try {
      localStorage.setItem("streberaj-hour-guides", hourGuides ? "1" : "0");
    } catch {}
  }, [hourGuides]);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" }),
      data = await res.json();
    if (!res.ok) {
      setView(null);
      setLoginError(data.error);
      setLoading(false);
      return;
    }
    setView((current) =>
      !current ||
      !Number.isFinite(current.revision) ||
      data.revision >= current.revision
        ? data
        : current,
    );
    setLoginError("");
    setLoading(false);
  }, []);

  const selectWorker = useCallback(
    async (actorId: string) => {
      setTroubleshootLoading(true);
      setTroubleshootError("");
      try {
        const res = await fetch("/api/troubleshoot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "bojanbasic", actorId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Prijava nije uspela.");
        setTroubleshootOpen(false);
        setLoading(true);
        await refresh();
      } catch (err) {
        setTroubleshootError((err as Error).message);
      } finally {
        setTroubleshootLoading(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    void refresh().catch(() => {
      setLoginError("Veza sa aplikacijom nije dostupna.");
      setLoading(false);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh().catch(() => {});
      }
    }, 20000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("google")) return;
    setTab("Administracija");
    setNotice(
      params.get("google") === "connected"
        ? "Google nalog je povezan. Uvoz se pokreće automatski."
        : params.get("message") || "Google povezivanje nije uspelo.",
    );
    params.delete("google");
    params.delete("message");
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        (params.size ? "?" + params : "") +
        window.location.hash,
    );
  }, []);
  const command: Command = async (type, payload) => {
    if (type === "refresh") {
      const res = await fetch("/api/state", { cache: "no-store" }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setView((current) =>
        !current ||
        !Number.isFinite(current.revision) ||
        data.revision >= current.revision
          ? data
          : current,
      );
      return { view: data };
    }
    const response = await fetch("/api/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ type, payload }),
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setView((current) =>
      !current ||
      !Number.isFinite(current.revision) ||
      data.view.revision >= current.revision
        ? data.view
        : current,
    );
    const confirmations: Record<string, string> = {
      saveLesson: "Čas je sačuvan.",
      saveLessonDraft: "Čas je sačuvan.",
      quickLesson: "Čas je sačuvan.",
      moveLessons: "Časovi su sačuvani.",
      saveStudent: "Učenik je sačuvan.",
      saveProfile: "Podešavanja su sačuvana.",
      saveEmployee: "Podaci zaposlenog su sačuvani.",
      setEmployeePermission: "Dozvola je sačuvana.",
      saveRule: "Pravilo obračuna je sačuvano.",
      postMessage: "Poruka je poslata.",
      editMessage: "Poruka je izmenjena.",
      deleteMessage: "Poruka je obrisana.",
    };
    if (data.warning || confirmations[type])
      setNotice(data.warning || confirmations[type]);
    return data;
  };
  async function quickAdd(data: {
    name: string;
    date: string;
    start: number;
    desk: 1 | 2 | null;
  }) {
    await command("quickLesson", data);
  }
  function newLesson(
    date = belgradeToday(),
    start = 9 * 60,
    desk: 1 | 2 | null = 1,
    name?: string,
  ) {
    setLessonId(null);
    setDraftMove(null);
    setSlot({ date, start, desk, name });
    if (view)
      previewLesson({
        studentName: name || "Novi čas",
        teacherId: view.actor.id,
        date,
        start,
        desk,
        mode: desk === null ? "online" : "in_person",
        duration: 45,
        units: 1,
      });
  }
  const closeLesson = useCallback(() => {
    setLessonId(null);
    setSlot(null);
    setLessonPreview(null);
    setDraftMove(null);
  }, []);
  const previewLesson = useCallback((draft: LessonPreview | null) => {
    setLessonPreview(draft);
    if (draft && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setWeek(weekStart(draft.date));
      setDay((current) =>
        current === null
          ? null
          : Math.round(
              (Date.parse(draft.date + "T12:00Z") -
                Date.parse(weekStart(draft.date) + "T12:00Z")) /
                86400000,
            ),
      );
      setTeacher("");
      if (draft.mode === "online") setOnline(true);
    }
  }, []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const type = e.shiftKey ? "redo" : "undo";
        if (!(type === "undo" ? view?.undoLabel : view?.redoLabel)) return;
        void command(type, {})
          .then(closeLesson)
          .catch((err) => setNotice(err.message));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (view?.redoLabel)
          void command("redo", {})
            .then(closeLesson)
            .catch((err) => setNotice(err.message));
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  if (loading)
    return (
      <div className="login-screen">
        <div className="login-logo-wrap">
          <img
            src="/streberaj-logo.png"
            alt="Štreberaj"
            className="brand-logo login-logo"
          />
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="login-screen">
        <div className="login-logo-wrap">
          <img
            src="/streberaj-logo.png"
            alt="Štreberaj"
            className="brand-logo login-logo"
          />
        </div>
        <a className="btn primary login-btn" href="/auth/login">
          Prijavite se Google nalogom
        </a>

        {/* Bojan easter egg (only visible on mobile screens) */}
        <div className="bojan-mobile-section">
          <div
            className="bojan-guy-wrapper"
            title="Bojan"
            role="button"
            tabIndex={0}
            onClick={handleGuyClick}
          >
            <img
              src="/before_click.png"
              alt="Bojan"
              className={`bojan-guy ${guyClicked ? "is-hidden" : "is-active"}`}
            />
            <img
              src="/after_click.png"
              alt="Bojan cigar"
              className={`bojan-guy ${guyClicked ? "is-active" : "is-hidden"}`}
            />
          </div>

          <div
            className={`bojan-input-container ${guyClicked ? "is-open" : ""}`}
          >
            <form
              className="bojan-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (isBojanMatch(troubleshootPass)) {
                  mobileInputRef.current?.blur();
                  void fetchWorkers("bojanbasic");
                } else {
                  setTroubleshootError("Neispravna šifra.");
                }
              }}
            >
              <input
                ref={mobileInputRef}
                type="text"
                className="bojan-input-field"
                placeholder="Unesite šifru..."
                value={troubleshootPass}
                onChange={(e) => {
                  const val = e.target.value;
                  setTroubleshootPass(val);
                  if (isBojanMatch(val)) {
                    mobileInputRef.current?.blur();
                    void fetchWorkers("bojanbasic");
                  }
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="submit"
                className="bojan-submit-btn"
                title="Potvrdi"
                disabled={troubleshootLoading}
              >
                {troubleshootLoading ? "..." : "→"}
              </button>
            </form>
            {troubleshootError && (
              <div className="bojan-error-text">{troubleshootError}</div>
            )}
          </div>

          {/* Inline worker list for mobile */}
          {troubleshootWorkers.length > 0 && (
            <div className="bojan-inline-workers">
              <div className="bojan-inline-title">
                Izaberite nalog za prijavu:
              </div>
              <div className="worker-picker-list">
                {troubleshootWorkers.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="worker-picker-item"
                    onClick={() => void selectWorker(w.id)}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        className="worker-picker-color"
                        style={{ backgroundColor: w.color }}
                      />
                      <span className="worker-picker-name">{w.name}</span>
                    </span>
                    <span className="worker-picker-role">
                      {w.role === "admin" ? "Superadmin" : "Predavač"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {troubleshootOpen && (
          <Modal
            title="Izbor zaposlenog"
            onClose={() => setTroubleshootOpen(false)}
          >
            <div className="worker-picker-modal">
              <p className="muted" style={{ marginBottom: 14 }}>
                Izaberite nalog za prijavu:
              </p>
              <div className="worker-picker-list">
                {troubleshootWorkers.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="worker-picker-item"
                    onClick={() => void selectWorker(w.id)}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        className="worker-picker-color"
                        style={{ backgroundColor: w.color }}
                      />
                      <span className="worker-picker-name">{w.name}</span>
                    </span>
                    <span className="worker-picker-role">
                      {w.role === "admin" ? "Superadmin" : "Predavač"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  const lessons = view.lessons.filter((l): l is Lesson => !("restricted" in l)),
    selected = lessons.find((l) => l.id === lessonId),
    month = new Intl.DateTimeFormat("sr-Latn-RS", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(week + "T12:00Z")),
    student = view.students.find((s) => s.id === studentCard);
  return (
    <div className="app-shell">
      <GoogleAutoSync
        enabled={view.actor.role === "admin"}
        spreadsheetId={view.sync?.spreadsheetId ?? ""}
        refresh={refresh}
      />
      <aside className="sidebar">
        <a className="brand" href="/" title="Štreberaj">
          <img
            src="/streberaj-logo.png"
            alt="Štreberaj"
            className="brand-logo sidebar-logo"
          />
        </a>
        <nav>
          {[
            { label: "Raspored", icon: CalendarDays },
            { label: "Učenici", icon: Users },
            { label: "Obračun", icon: Wallet },
            { label: "Poruke", icon: MessageCircle },
            ...(view.actor.role === "admin"
              ? [{ label: "Administracija", icon: SlidersHorizontal }]
              : []),
          ].map(({ label, icon: Icon }) => (
            <button
              className={tab === label ? "active" : ""}
              key={label}
              onClick={() => {
                setTab(label);
                setSearch("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <ActivityNotifications
          view={view}
          notice={notice}
          onConsume={() => setNotice("")}
          enabled={view.actor.preferences?.notifications ?? true}
          soundEnabled={view.actor.preferences?.sound ?? false}
        />
        <div className="profile">
          <span
            className="avatar"
            style={{
              background: view.actor.color,
              color: textForColor(view.actor.color),
            }}
          >
            {view.actor.name[0]}
          </span>
          <div>
            {view.demo ? (
              <AccountSelect
                employees={view.employees}
                value={view.actor.id}
                onError={setNotice}
                onChange={async (actorId) => {
                  const response = await fetch("/api/troubleshoot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: "bojanbasic", actorId }),
                  });
                  if (!response.ok) {
                    await fetch("/api/demo", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ actorId }),
                    });
                  }
                  closeLesson();
                  setTab("Raspored");
                  await refresh();
                }}
              />
            ) : (
              <strong>{view.actor.name}</strong>
            )}
            <small>
              {view.actor.role === "admin" ? "Superadministrator" : "Predavač"}
            </small>
          </div>
          <button
            type="button"
            className="icon-btn settings-button"
            aria-label="Podešavanja"
            title="Podešavanja"
            onClick={() => {
              closeLesson();
              setSettingsOpen(true);
            }}
          >
            <Settings size={19} />
          </button>
          <button
            className="icon-btn header-logout"
            aria-label="Odjavi se"
            title="Odjavi se"
            onClick={async () => {
              await fetch("/api/troubleshoot", { method: "DELETE" }).catch(() => {});
              await fetch("/auth/logout", { method: "POST" }).catch(() => {});
              location.reload();
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="main">
        {tab === "Raspored" ? (
          <div className={"schedule-layout " + (source ? "with-source" : "")}>
            <section className="schedule-card">
              <div className="schedule-toolbar">
                <div className="week-controls">
                  <button
                    className="icon-btn"
                    aria-label="Prethodna nedelja"
                    onClick={() => setWeek(addDays(week, -7))}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Sledeća nedelja"
                    onClick={() => setWeek(addDays(week, 7))}
                  >
                    <ChevronRight size={19} />
                  </button>
                  <h2>
                    {month}
                    <span>
                      {dateLabel(week)} – {dateLabel(addDays(week, 6))}
                    </span>
                  </h2>
                  <button
                    className="btn small"
                    onClick={() => {
                      if (
                        day !== null &&
                        addDays(week, day) === belgradeToday()
                      ) {
                        setWeek(weekStart());
                        setDay(null);
                      } else {
                        setWeek(weekStart());
                        setDay(
                          Math.round(
                            (Date.parse(belgradeToday() + "T12:00Z") -
                              Date.parse(weekStart() + "T12:00Z")) /
                              86400000,
                          ),
                        );
                      }
                    }}
                  >
                    {day !== null && addDays(week, day) === belgradeToday()
                      ? "Ova nedelja"
                      : "Danas"}
                  </button>
                  <input
                    className="date-picker"
                    type="date"
                    value={week}
                    aria-label="Izaberi nedelju"
                    onChange={(e) =>
                      e.target.value && setWeek(weekStart(e.target.value))
                    }
                  />
                </div>
                <div className="view-controls">
                  <button
                    className="btn small undo-button"
                    aria-label={
                      view.undoLabel
                        ? "Poništi: " + view.undoLabel
                        : "Poništi poslednju izmenu"
                    }
                    title={
                      view.undoLabel
                        ? "Poništi: " + view.undoLabel + " (Ctrl + Z)"
                        : "Nema izmene za poništavanje"
                    }
                    disabled={!view.undoLabel}
                    onClick={async () => {
                      try {
                        await command("undo", {});
                        closeLesson();
                      } catch (e) {
                        setNotice((e as Error).message);
                      }
                    }}
                  >
                    <Undo2 size={18} />
                    <span>
                      {view.undoLabel
                        ? "Poništi: " + view.undoLabel
                        : "Poništi"}
                    </span>
                  </button>
                  <button
                    className="btn small undo-button redo-button"
                    aria-label={
                      view.redoLabel ? "Ponovi: " + view.redoLabel : "Ponovi"
                    }
                    title={
                      view.redoLabel
                        ? "Ponovi: " + view.redoLabel + " (Ctrl + Shift + Z)"
                        : "Nema radnje za ponavljanje"
                    }
                    disabled={!view.redoLabel}
                    onClick={async () => {
                      try {
                        await command("redo", {});
                        closeLesson();
                      } catch (e) {
                        setNotice((e as Error).message);
                      }
                    }}
                  >
                    <Redo2 size={18} />
                    <span>Ponovi</span>
                  </button>
                  <select
                    aria-label="Prikaz dana"
                    value={day ?? "week"}
                    onChange={(e) =>
                      setDay(
                        e.target.value === "week"
                          ? null
                          : Number(e.target.value),
                      )
                    }
                  >
                    <option value="week">Cela nedelja</option>
                    {[
                      "Ponedeljak",
                      "Utorak",
                      "Sreda",
                      "Četvrtak",
                      "Petak",
                      "Subota",
                      "Nedelja",
                    ].map((n, i) => (
                      <option value={i} key={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={online}
                      onChange={(e) => setOnline(e.target.checked)}
                    />
                    Prikaži online
                  </label>
                  <label
                    className="toggle-label"
                    title="Prikaži sive oznake punih sati unutar mreže"
                  >
                    <input
                      type="checkbox"
                      checked={hourGuides}
                      onChange={(e) => setHourGuides(e.target.checked)}
                    />
                    Sati u mreži
                  </label>
                  <button
                    className="icon-btn"
                    aria-label="Prikaži Google tabelu"
                    aria-pressed={source}
                    onClick={() => setSource(!source)}
                  >
                    <Sheet size={18} />
                  </button>
                  <button
                    className="btn primary new-lesson-button"
                    onClick={() => newLesson()}
                  >
                    <Plus size={16} />
                    Novi čas
                  </button>
                </div>
              </div>
              <div className="calendar-filters">
                <div className="teacher-filters">
                  <button
                    className={!teacher ? "selected" : ""}
                    onClick={() => setTeacher("")}
                  >
                    Svi predavači
                  </button>
                  {view.employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <button
                        className={teacher === e.id ? "selected" : ""}
                        key={e.id}
                        onClick={() => setTeacher(teacher === e.id ? "" : e.id)}
                      >
                        <i style={{ background: e.color }} />
                        {e.name}
                      </button>
                    ))}
                </div>
              </div>
              <Calendar
                view={view}
                week={week}
                day={day}
                online={online}
                hourGuides={hourGuides}
                teacher={teacher}
                editorDraft={lessonPreview}
                onEditorMove={(patch) => {
                  setLessonPreview((current) =>
                    current ? { ...current, ...patch } : null,
                  );
                  setDraftMove((previous) => ({
                    serial: (previous?.serial ?? 0) + 1,
                    patch,
                  }));
                }}
                onOpen={(l) => {
                  setDraftMove(null);
                  previewLesson({
                    ...l,
                    units: l.units ?? 1,
                    studentName:
                      view.students.find((s) => s.id === l.studentId)?.name ??
                      "Čas",
                  });
                  setSlot(null);
                  setLessonId(l.id);
                }}
                onNew={newLesson}
                onQuickAdd={quickAdd}
                onDelete={async (ids) => {
                  try {
                    await command("deleteLessons", { ids });
                    setNotice(
                      ids.length === 1
                        ? "Čas je obrisan."
                        : `Obrisano časova: ${ids.length}.`,
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                    throw e;
                  }
                }}
                onPackage={async (studentId, packageSize) => {
                  await command("setPackage", { studentId, packageSize });
                }}
                onCounter={async (lessonId, unit, number, size, scope) => {
                  await command("correctLessonCounter", {
                    lessonId,
                    unit,
                    number,
                    size,
                    scope,
                  });
                }}
                onMoveMany={async (moves) => {
                  try {
                    const result = await command("moveLessons", {
                      moves: moves.map(({ lesson, patch }) => ({
                        id: lesson.id,
                        ...patch,
                      })),
                    });
                    return Object.fromEntries(
                      result.view.lessons
                        .filter(
                          (l): l is Lesson =>
                            !("restricted" in l) &&
                            moves.some((m) => m.lesson.id === l.id),
                        )
                        .map((l) => [
                          l.id,
                          {
                            date: l.date,
                            start: l.start,
                            duration: l.duration,
                            desk: l.desk,
                            mode: l.mode,
                          },
                        ]),
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                    throw e;
                  }
                }}
                onMove={async (l, patch) => {
                  try {
                    const result = await command("saveLesson", {
                      ...l,
                      ...patch,
                      units: patch.duration !== l.duration ? 1 : (l.units ?? 1),
                      shared: patch.mode !== l.mode ? false : l.shared,
                    });
                    const saved = result.view.lessons.find(
                      (item) => item.id === l.id,
                    );
                    return saved
                      ? {
                          date: saved.date,
                          start: saved.start,
                          duration: saved.duration,
                          desk: saved.desk,
                          mode: saved.mode,
                        }
                      : undefined;
                  } catch (e) {
                    setNotice((e as Error).message);
                    throw e;
                  }
                }}
              />
            </section>
            {source && (
              <SourcePanel
                view={view}
                hourGuides={hourGuides}
                week={week}
                onClose={() => setSource(false)}
                refresh={refresh}
              />
            )}
          </div>
        ) : (
          <>
            <div className="section-heading">
              <h1>{tab}</h1>
              {tab === "Učenici" && (
                <button
                  className="btn primary"
                  onClick={() => setStudentEdit("new")}
                >
                  <Plus size={16} />
                  Novi učenik
                </button>
              )}
            </div>
            {tab === "Učenici" && (
              <section className="content-card">
                <input
                  aria-label="Pretraži učenike"
                  placeholder="Pretraži učenike…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Učenik</th>
                        <th>Razred / nivo</th>
                        <th>Način dolaska</th>
                        <th>Globalni paket</th>
                        <th>Ukupno održanih</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {view.students
                        .filter((s) =>
                          s.name
                            .toLocaleLowerCase("sr")
                            .includes(search.toLocaleLowerCase("sr")),
                        )
                        .map((s) => (
                          <tr key={s.id}>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => setStudentCard(s.id)}
                              >
                                {s.name}
                              </button>
                            </td>
                            <td>{s.level || "—"}</td>
                            <td>{CHANNELS[s.channel]}</td>
                            <td>
                              <span className="cycle-badge">
                                <PackageCounter
                                  student={s}
                                  scopeSelection={false}
                                  onCorrect={async (number, size) => {
                                    await command("correctStudentCounter", {
                                      studentId: s.id,
                                      number,
                                      size,
                                    });
                                  }}
                                  onChange={(size) =>
                                    command("setPackage", {
                                      studentId: s.id,
                                      packageSize: size,
                                    }).then(() => {})
                                  }
                                />
                              </span>
                            </td>
                            <td>{s.total}</td>
                            <td>
                              <button
                                className="btn small"
                                onClick={() => setStudentEdit(s)}
                              >
                                Uredi
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {tab === "Obračun" && (
              <Finance
                view={view}
                command={command}
                onOpen={(l) => setLessonId(l.id)}
              />
            )}
            {tab === "Poruke" && <StaffNotes view={view} command={command} />}
            {tab === "Administracija" && view.actor.role === "admin" && (
              <>
                <section className="content-card">
                  <div className="card-title">
                    <h2>Zaposleni</h2>
                    <button
                      className="btn small"
                      onClick={() => setEmployeeEdit("new")}
                    >
                      <Plus size={14} />
                      Dodaj zaposlenog
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Predavač</th>
                          <th>Google nalog</th>
                          <th>Menja cenu</th>
                          <th>Zakazuje za druge</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {view.employees.map((e) => (
                          <tr key={e.id}>
                            <td>
                              <span className="employee-name">
                                <i style={{ background: e.color }} />
                                {e.name}
                                {!e.active && <small>Isključen</small>}
                              </span>
                            </td>
                            <td>{e.email || "Prijava nije podešena"}</td>
                            {(
                              ["canSetPrice", "canScheduleOthers"] as const
                            ).map((key) => (
                              <td key={key}>
                                <fieldset
                                  className="inline-permission-radios"
                                  aria-label={`${e.name}: ${key === "canSetPrice" ? "menja cenu" : "zakazuje za druge"}`}
                                  aria-busy={
                                    !!permissions.pending[`${e.id}-${key}`]
                                  }
                                >
                                  {[true, false].map((enabled) => (
                                    <label key={String(enabled)}>
                                      <input
                                        type="radio"
                                        name={`${e.id}-${key}`}
                                        checked={
                                          (permissions.pending[`${e.id}-${key}`]
                                            ?.value ??
                                            e[key] ??
                                            true) === enabled
                                        }
                                        onChange={async () => {
                                          try {
                                            await permissions.run(
                                              [`${e.id}-${key}`],
                                              enabled,
                                              () =>
                                                command(
                                                  "setEmployeePermission",
                                                  { id: e.id, key, enabled },
                                                ),
                                            );
                                          } catch (error) {
                                            setNotice((error as Error).message);
                                          }
                                        }}
                                      />
                                      {enabled ? "Da" : "Ne"}
                                    </label>
                                  ))}
                                </fieldset>
                              </td>
                            ))}
                            <td>
                              <button
                                className="btn small"
                                onClick={() => setEmployeeEdit(e)}
                              >
                                Uredi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="content-card">
                  <div className="card-title">
                    <h2>Cenovnik i procenti</h2>
                    <button
                      className="btn small"
                      onClick={() => setRuleEdit("new")}
                    >
                      <Plus size={14} />
                      Novo pravilo
                    </button>
                  </div>
                  <div className="fixed-tariffs">
                    {TARIFFS.map((tariff) => (
                      <div key={tariff.duration}>
                        <strong>{tariff.duration} min</strong>
                        <span>{money(tariff.price)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Predavač dobija 60% + 10% za online + 10% za fakultet + 10%
                    za preporuku. Bonusi se sabiraju; Manojlu pripada ostatak.
                  </p>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Prioritet</th>
                          <th>Pravilo</th>
                          <th>Trajanje</th>
                          <th>Cena</th>
                          <th>Manojlov deo</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {[...view.rules]
                          .sort((a, b) => a.priority - b.priority)
                          .map((r) => (
                            <tr key={r.id}>
                              <td>{r.priority}</td>
                              <td>
                                {r.name}
                                {!r.active && " (isključeno)"}
                              </td>
                              <td>
                                {r.duration ? r.duration + " min" : "Sva"}
                              </td>
                              <td>{money(r.price)}</td>
                              <td>{r.bossBps / 100}%</td>
                              <td>
                                <button
                                  className="btn small"
                                  onClick={() => setRuleEdit(r)}
                                >
                                  Uredi
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <SyncEditor view={view} command={command} refresh={refresh} />
                <ResetBoard view={view} refresh={refresh} onDone={setNotice} />
              </>
            )}
          </>
        )}
      </main>
      {tab === "Raspored" && (
        <button
          type="button"
          className="mobile-add-class"
          aria-label="Novi čas"
          title="Novi čas"
          onClick={() => newLesson()}
        >
          <Plus size={34} strokeWidth={2} />
        </button>
      )}
      {settingsOpen && (
        <SettingsPanel
          key={view.actor.id}
          view={view}
          command={command}
          hourGuides={hourGuides}
          onHourGuides={setHourGuides}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {(selected || slot) && (
        <LessonEditor
          key={selected?.id ?? "new-" + slot?.date + slot?.start}
          view={view}
          lesson={selected}
          slot={slot ?? undefined}
          command={command}
          onClose={closeLesson}
          onPreview={previewLesson}
          externalMove={draftMove}
          onSaved={closeLesson}
        />
      )}
      {studentEdit && (
        <StudentEditor
          student={studentEdit === "new" ? undefined : studentEdit}
          students={view.students}
          command={command}
          onClose={() => setStudentEdit(null)}
        />
      )}
      {employeeEdit && (
        <EmployeeEditor
          employee={employeeEdit === "new" ? undefined : employeeEdit}
          employees={view.employees}
          command={command}
          onClose={() => setEmployeeEdit(null)}
        />
      )}
      {ruleEdit && (
        <RuleEditor
          rule={ruleEdit === "new" ? undefined : ruleEdit}
          view={view}
          command={command}
          onClose={() => setRuleEdit(null)}
        />
      )}
      {student && (
        <Modal title={student.name} onClose={() => setStudentCard(null)}>
          <StudentCreatedLabel createdAt={student.createdAt} />
          <p className="muted">
            {student.level} · {CHANNELS[student.channel]}
          </p>
          {student.channel === "referral" && student.referralNote && (
            <p className="student-note">
              <strong>Preporuka:</strong> {student.referralNote}
            </p>
          )}
          {student.channel === "other" && student.otherNote && (
            <p className="student-note">
              <strong>Način dolaska:</strong> {student.otherNote}
            </p>
          )}
          {student.notes && (
            <div className="student-note">
              <h3>Beleške o učeniku</h3>
              <p>{student.notes}</p>
            </div>
          )}
          <div className="student-counters">
            <div>
              <span>Ukupno održanih</span>
              <strong>{student.total}</strong>
            </div>
            <div>
              <span>Trenutni paket</span>
              <strong>
                <PackageCounter
                  student={student}
                  scopeSelection={false}
                  onCorrect={async (number, size) => {
                    await command("correctStudentCounter", {
                      studentId: student.id,
                      number,
                      size,
                    });
                  }}
                  onChange={(size) =>
                    command("setPackage", {
                      studentId: student.id,
                      packageSize: size,
                    }).then(() => {})
                  }
                />
              </strong>
            </div>
            {["increment", "reset"].map((action) => (
              <button
                key={action}
                className="btn small"
                onClick={async () => {
                  try {
                    await command("counter", { studentId: student.id, action });
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                {action === "reset" ? "Reset paketa" : "+1"}
              </button>
            ))}
          </div>
          <h3>Istorija časova</h3>
          <div className="student-history">
            {lessons
              .filter(
                (l) =>
                  l.studentId === student.id &&
                  !l.deletedAt &&
                  l.status !== "cancelled",
              )
              .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)
              .map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setStudentCard(null);
                    setLessonId(l.id);
                  }}
                >
                  <span>
                    {dateLabel(l.date, true)} · {clock(l.start)}
                    <small>{l.topic || "Bez beleške"}</small>
                  </span>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {troubleshootOpen && (
        <Modal
          title="Izbor zaposlenog"
          onClose={() => setTroubleshootOpen(false)}
        >
          <div className="worker-picker-modal">
            <p className="muted" style={{ marginBottom: 14 }}>
              Izaberite nalog za prijavu:
            </p>
            {troubleshootLoading && <p className="muted">Učitavanje…</p>}
            {troubleshootError && (
              <p className="form-error" style={{ marginBottom: 12 }}>
                {troubleshootError}
              </p>
            )}
            <div className="worker-picker-list">
              {troubleshootWorkers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="worker-picker-item"
                  onClick={() => void selectWorker(w.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="worker-picker-color"
                      style={{ backgroundColor: w.color }}
                    />
                    <span className="worker-picker-name">{w.name}</span>
                  </span>
                  <span className="worker-picker-role">
                    {w.role === "admin" ? "Superadmin" : "Predavač"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
