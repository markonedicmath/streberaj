"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Download, RefreshCw, X } from "lucide-react";
import { Field, ErrorMessage, totals, type Command } from "./forms";
import {
  addDays,
  belgradeToday,
  dateLabel,
  money,
  clock,
  lessonHasEnded,
  belgradeMinute,
} from "@/lib/time";
import type { SchoolView, Lesson } from "@/lib/types";
import SourceGrid from "./source-grid";
import GoogleConnection from "./google-connection";
import AnimatedAmount from "./animated-amount";
import ImportRounding from "./import-rounding";
import FinanceTable from "./finance-table";
export function Finance({
  view,
  command,
  onOpen,
}: {
  view: SchoolView;
  command: Command;
  onOpen: (l: Lesson) => void;
}) {
  const today = belgradeToday(),
    [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [teacher, setTeacher] = useState(""),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const through = belgradeMinute();
  const financeLessons: SchoolView["lessons"] =
    view.financeLessons ?? view.lessons;
  const rows = financeLessons.filter(
      (l): l is Lesson =>
        !("restricted" in l) &&
        lessonHasEnded(l, through) &&
        l.date >= from &&
        l.date <= to &&
        (!teacher || l.teacherId === teacher),
    ),
    known = rows.filter((l) => l.price !== null && l.bossBps !== null),
    sum = (key: "paid" | "boss" | "teacher" | "balance" | "bossBalance") =>
      known.reduce((a, l) => a + (totals(view, l)[key] ?? 0), 0);
  async function excel() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      if (!from || !to || from > to)
        throw new Error("Izaberite ispravan period za izveštaj.");
      const { downloadExcelReport } = await import("@/lib/excel-report");
      await downloadExcelReport(view, rows, from, to, teacher);
    } catch (error) {
      setExportError(
        (error as Error).message ||
          "Izveštaj nije napravljen. Pokušajte ponovo.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="report-controls">
        <Field label="Od">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Do">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Predavač">
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="">Svi dostupni</option>
            {view.employees.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="btn"
          onClick={() => void excel()}
          disabled={exporting}
          title="Excel izveštaj sa formulama (.xlsx)"
        >
          <Download size={15} />
          {exporting ? "Priprema izveštaja…" : "Preuzmi XLS"}
        </button>
      </div>
      <ErrorMessage error={exportError} />
      <div className="report-stats">
        {[
          ["Održani časovi", rows.length],
          ["Naplaćeno", sum("paid")],
          ["Saldo učenika", sum("balance")],
          ["Zarada predavača", sum("teacher")],
          ["Manojlov deo", sum("boss")],
          ["Za predaju Manojlu", sum("bossBalance")],
        ].map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>
              <AnimatedAmount
                value={Number(value)}
                count={name === "Održani časovi"}
                animateOnMount
              />
            </strong>
          </div>
        ))}
      </div>
      {view.actor.role === "admin" && (
        <ImportRounding view={view} command={command} />
      )}
      {rows.length !== known.length && (
        <p className="form-error">
          Za {rows.length - known.length} časova nedostaje cena ili procenat.
          Nisu uključeni u novčane zbirove.
        </p>
      )}
      <FinanceTable view={view} rows={rows} command={command} onOpen={onOpen} />
      <ReceivedHandovers view={view} from={from} to={to} />
    </>
  );
}
export function SourcePanel({
  view,
  hourGuides,
  week,
  onClose,
  refresh,
}: {
  view: SchoolView;
  hourGuides: boolean;
  week: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [minimized, setMinimized] = useState(false),
    blocks = view.sourceBlocks.filter(
      (b) => b.date >= week && b.date <= addDays(week, 6),
    );
  return (
    <section
      className={
        "source-panel source-drawer content-card" +
        (minimized ? " is-minimized" : "")
      }
      aria-label="Google tabela"
    >
      <div className="source-drawer-header">
        <h2>
          <button
            className="source-drawer-toggle"
            aria-expanded={!minimized}
            aria-controls="google-source-content"
            aria-label={
              minimized ? "Proširi Google tabelu" : "Minimizuj Google tabelu"
            }
            onClick={() => setMinimized(!minimized)}
          >
            <span>Google tabela</span>
            {minimized ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
          </button>
        </h2>
        <button
          className="icon-btn"
          aria-label="Zatvori izvornu tabelu"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <div
        id="google-source-content"
        className="source-drawer-body"
        inert={minimized}
        aria-hidden={minimized}
      >
        {view.actor.role === "admin" && (
          <button
            className="btn small"
            disabled={busy || !view.sync?.spreadsheetId}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const res = await fetch("/api/sync", { method: "POST" }),
                  data = await res.json();
                if (!res.ok) throw new Error(data.error);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={14} />
            Osveži
          </button>
        )}
        <ErrorMessage error={error || view.sync?.lastError || ""} />
        {!view.sync?.lastSuccess && (
          <p className="muted">Tabela još nije povezana.</p>
        )}
        <SourceGrid blocks={blocks} week={week} hourGuides={hourGuides} />
      </div>
    </section>
  );
}
export function SyncEditor({
  view,
  command,
  refresh,
}: {
  view: SchoolView;
  command: Command;
  refresh: () => Promise<void>;
}) {
  const sync = view.sync!,
    [spreadsheetId, setId] = useState(
      sync.spreadsheetId || "1sEG8vyl3YZhw6HnyFoFmxlIMH5ROF1BAcxvb1RDNDLE",
    ),
    [year, setYear] = useState(sync.firstYear),
    [colors, setColors] = useState<Record<string, string>>(sync.colorMap),
    [students, setStudents] = useState<Record<string, string>>(sync.studentMap),
    [color, setColor] = useState("#9900ff"),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const sourceColors = [
      ...new Set([
        ...Object.keys(colors),
        ...view.sourceBlocks.map((b) => b.color),
      ]),
    ],
    names = [
      ...new Set([
        ...Object.keys(students),
        ...view.sourceBlocks.filter((b) => b.text).map((b) => b.text),
      ]),
    ];
  async function persistSource() {
    let sid = spreadsheetId.trim();
    if (sid.includes("/spreadsheets/d/"))
      sid = sid.split("/spreadsheets/d/")[1].split("/")[0];
    await command("syncSettings", {
      spreadsheetId: sid,
      firstYear: year,
      colorMap: colors,
      studentMap: students,
    });
    setId(sid);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await persistSource();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h2>Google tabela</h2>
      <GoogleConnection saveSource={persistSource} refresh={refresh} />
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Link ili ID Google tabele" wide>
            <input
              value={spreadsheetId}
              onChange={(e) => setId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </Field>
          <Field label="Početna godina">
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </Field>
        </div>
        <details className="sync-mappings">
          <summary>Uparivanje predavača i učenika</summary>
          <p className="muted">
            Boje predstavljaju predavače. Nepoznata i dvosmislena imena ostaju
            za ručno povezivanje.
          </p>
          <h3>Boje iz tabele → predavači</h3>
          {sourceColors.map((c) => (
            <div className="mapping-row" key={c}>
              <span>
                <i style={{ background: c }} />
                {c}
              </span>
              <select
                aria-label={"Predavač za boju " + c}
                value={colors[c] ?? ""}
                onChange={(e) => {
                  const v = { ...colors };
                  if (e.target.value) v[c] = e.target.value;
                  else delete v[c];
                  setColors(v);
                }}
              >
                <option value="">Nije povezano</option>
                {view.employees.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="mapping-add">
            <input
              type="color"
              aria-label="Nova izvorna boja"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <button
              type="button"
              className="btn small"
              onClick={() => setColors({ ...colors, [color]: view.actor.id })}
            >
              Dodaj boju
            </button>
          </div>
          <h3>Izvorni zapis → učenik</h3>
          {names.map((name) => (
            <div className="mapping-row" key={name}>
              <span>{name}</span>
              <select
                aria-label={"Učenik za zapis " + name}
                value={students[name] ?? ""}
                onChange={(e) => {
                  const v = { ...students };
                  if (e.target.value) v[name] = e.target.value;
                  else delete v[name];
                  setStudents(v);
                }}
              >
                <option value="">Nije povezano</option>
                {view.students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="mapping-add">
            <input
              aria-label="Novi izvorni zapis"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tačan tekst iz ćelije"
            />
            <button
              type="button"
              className="btn small"
              disabled={!text || !view.students.length}
              onClick={() => {
                setStudents({ ...students, [text]: view.students[0].id });
                setText("");
              }}
            >
              Dodaj zapis
            </button>
          </div>
        </details>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            Sačuvaj povezivanje
          </button>
        </div>
      </form>
      {sync.lastSuccess && (
        <p className="muted">
          Poslednji uspešan uvoz:{" "}
          {new Date(sync.lastSuccess).toLocaleString("sr-Latn-RS", {
            timeZone: "Europe/Belgrade",
          })}
        </p>
      )}
      <ErrorMessage error={sync.lastError ?? ""} />
      <SourceIssues view={view} command={command} />
    </section>
  );
}
function SourceIssues({
  view,
  command,
}: {
  view: SchoolView;
  command: Command;
}) {
  return (
    <>
      {view.sourceBlocks
        .filter((b) => b.issue || b.missing)
        .map((b) => (
          <SourceIssue key={b.id} block={b} view={view} command={command} />
        ))}
    </>
  );
}
function SourceIssue({
  block,
  view,
  command,
}: {
  block: SchoolView["sourceBlocks"][number];
  view: SchoolView;
  command: Command;
}) {
  const candidates = view.lessons.filter(
      (l): l is Lesson =>
        !("restricted" in l) &&
        l.studentId === block.studentId &&
        l.teacherId === block.teacherId &&
        l.mode === "in_person",
    ),
    [selected, setSelected] = useState(
      candidates.find((l) => l.sourceId === block.id)?.id ?? "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="source-issue">
      <strong>
        {block.text || "Bez imena"} · {dateLabel(block.date)} ·{" "}
        {clock(block.start)}
      </strong>
      <p>{block.issue ?? "Rezervacija je uklonjena iz izvora."}</p>
      {candidates.length ? (
        <>
          <select
            aria-label={"Poveži rezervaciju " + block.text}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Izaberite postojeći čas</option>
            {candidates.map((l) => (
              <option value={l.id} key={l.id}>
                {dateLabel(l.date, true)} · {clock(l.start)} · {l.duration} min
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn small"
            disabled={busy || !selected}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await command("resolveSource", {
                  blockId: block.id,
                  lessonId: selected,
                });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Potvrdi vezu i zadrži lokalni termin
          </button>
        </>
      ) : (
        <p>Povežite boju i učenika, sačuvajte podešavanje i osvežite uvoz.</p>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
function ReceivedHandovers({
  view,
  from,
  to,
}: {
  view: SchoolView;
  from: string;
  to: string;
}) {
  const rows = view.handovers.filter(
    (h) => h.confirmed && !h.voidedAt && h.date >= from && h.date <= to,
  );
  if (!rows.length) return null;
  return (
    <section className="content-card">
      <h2>Potvrđene predaje novca</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Predavač</th>
              <th>Primljen iznos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id}>
                <td>{dateLabel(h.date, true)}</td>
                <td>
                  {view.employees.find((e) => e.id === h.teacherId)?.name}
                </td>
                <td>{money(h.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
