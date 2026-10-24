"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Lesson, SchoolView } from "@/lib/types";
import { isManojlo } from "@/lib/pricing";
import { clock, dateLabel, money } from "@/lib/time";
import { ErrorMessage, totals, type Command } from "./forms";
import { useQueuedToggle } from "./use-queued-toggle";

function activateCheckboxCell(event: MouseEvent<HTMLTableCellElement>) {
  event.stopPropagation();
  if ((event.target as HTMLElement).closest("label,input")) return;
  event.currentTarget
    .querySelector<HTMLInputElement>('input[type="checkbox"]:not(:disabled)')
    ?.click();
}

function FinanceCheck({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | null;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = value === null;
  });
  return (
    <label
      className="finance-check"
      title={label}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={input}
        type="checkbox"
        aria-label={label}
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function FinanceTable({
  view,
  rows,
  command,
  onOpen,
}: {
  view: SchoolView;
  rows: Lesson[];
  command: Command;
  onOpen: (lesson: Lesson) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, run, saving } = useQueuedToggle();
  const [error, setError] = useState("");
  const anchor = useRef<string | null>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const chosen = rows.filter((lesson) => selected.has(lesson.id));
  const owner = (lesson: Lesson) =>
    isManojlo(
      view.employees.find((employee) => employee.id === lesson.teacherId),
    );
  const activeHandovers = (lesson: Lesson) =>
    view.handovers.filter(
      (handover) => handover.lessonId === lesson.id && !handover.voidedAt,
    );
  const paidStatus = (lesson: Lesson): boolean | null => {
    if (pending[`paid:${lesson.id}`]) return pending[`paid:${lesson.id}`].value;
    const paid = totals(view, lesson).paid;
    if (lesson.price !== null && paid >= lesson.price) return true;
    return paid > 0 ? null : false;
  };
  const handedStatus = (lesson: Lesson): boolean | null => {
    if (pending[`handed:${lesson.id}`])
      return pending[`handed:${lesson.id}`].value;
    const amount = totals(view, lesson);
    const declared = activeHandovers(lesson).reduce(
      (sum, handover) => sum + handover.amount,
      0,
    );
    if (amount.boss !== null && amount.handed >= amount.boss) return true;
    return declared > 0 ? null : false;
  };
  const handoverRows = chosen.filter(
    (lesson) => !owner(lesson) && totals(view, lesson).boss !== 0,
  );
  const unanimous = (
    lessons: Lesson[],
    status: (lesson: Lesson) => boolean | null,
  ) => {
    const value = lessons.length ? status(lessons[0]) : null;
    return lessons.every((lesson) => status(lesson) === value) ? value : null;
  };
  useEffect(() => {
    const visible = new Set(rows.map((lesson) => lesson.id));
    setSelected((previous) =>
      [...previous].some((id) => !visible.has(id))
        ? new Set([...previous].filter((id) => visible.has(id)))
        : previous,
    );
  }, [rows]);
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        chosen.length > 0 && chosen.length < rows.length;
  }, [chosen.length, rows.length]);
  function toggle(id: string, shift: boolean) {
    const first = rows.findIndex((lesson) => lesson.id === anchor.current);
    const last = rows.findIndex((lesson) => lesson.id === id);
    setSelected((previous) => {
      const next = new Set(previous);
      if (shift && first >= 0 && last >= 0)
        for (const lesson of rows.slice(
          Math.min(first, last),
          Math.max(first, last) + 1,
        ))
          next.add(lesson.id);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!shift || first < 0) anchor.current = id;
  }
  async function save(
    lessons: Lesson[],
    field: "paid" | "handed",
    value: boolean,
  ) {
    if (!lessons.length) return;
    const ids = lessons.map((lesson) => lesson.id);
    setError("");
    try {
      await run(
        ids.map((id) => `${field}:${id}`),
        value,
        () => command("setFinanceStatus", { ids, field, value }),
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <section className="content-card finance-table-card" aria-busy={saving}>
      {chosen.length > 0 && (
        <div
          className="finance-bulk-bar"
          aria-label="Radnje nad izabranim časovima"
        >
          <strong>Izabrano: {chosen.length}</strong>
          <div>
            <span>Plaćeno</span>
            <FinanceCheck
              label="Plaćeno za izabrane časove"
              value={unanimous(chosen, paidStatus)}
              disabled={false}
              onChange={(value) => void save(chosen, "paid", value)}
            />
          </div>
          <div>
            <span>Manojlo dobio deo</span>
            <FinanceCheck
              label="Manojlo dobio deo za izabrane časove"
              value={unanimous(handoverRows, handedStatus)}
              disabled={!handoverRows.length}
              onChange={(value) => void save(handoverRows, "handed", value)}
            />
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setSelected(new Set())}
          >
            Poništi izbor
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
      <div className="finance-mobile-selection">
        <span>Prikazano: {rows.length}</span>
        <button
          type="button"
          className="btn small"
          disabled={!rows.length}
          onClick={() =>
            setSelected(
              chosen.length === rows.length
                ? new Set()
                : new Set(rows.map((lesson) => lesson.id)),
            )
          }
        >
          {chosen.length > 0 && chosen.length === rows.length
            ? "Poništi izbor"
            : "Izaberi sve"}
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table finance-table" aria-label="Obračun časova">
          <thead>
            <tr>
              <th className="finance-selection" onClick={activateCheckboxCell}>
                <label
                  className="finance-check"
                  title="Izaberi sve prikazane časove"
                >
                  <input
                    type="checkbox"
                    ref={selectAll}
                    aria-label="Izaberi sve prikazane časove"
                    checked={rows.length > 0 && chosen.length === rows.length}
                    disabled={!rows.length}
                    onChange={(event) => {
                      setSelected(
                        event.target.checked
                          ? new Set(rows.map((lesson) => lesson.id))
                          : new Set(),
                      );
                      anchor.current = null;
                    }}
                  />
                </label>
              </th>
              <th>Datum</th>
              <th>Učenik</th>
              <th>Predavač</th>
              <th>Cena</th>
              <th>Plaćeno</th>
              <th>Manojlov deo</th>
              <th>Manojlo dobio deo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((lesson) => {
              const amount = totals(view, lesson);
              const own = owner(lesson);
              const pending = activeHandovers(lesson)
                .filter((handover) => !handover.confirmed)
                .reduce((sum, handover) => sum + handover.amount, 0);
              const student =
                view.students.find((student) => student.id === lesson.studentId)
                  ?.name ??
                view.financeLessons?.find((entry) => entry.id === lesson.id)
                  ?.studentName ??
                "Učenik";
              const canOpen = view.lessons.some(
                (entry) => entry.id === lesson.id && !("restricted" in entry),
              );
              return (
                <tr
                  key={lesson.id}
                  className={selected.has(lesson.id) ? "is-selected" : ""}
                  aria-selected={selected.has(lesson.id)}
                  onClick={(event) => {
                    if (
                      (event.target as HTMLElement).closest(
                        "input,button,label,a,fieldset,.finance-status-cell,.finance-selection",
                      ) ||
                      !window.getSelection()?.isCollapsed
                    )
                      return;
                    toggle(lesson.id, event.shiftKey);
                  }}
                >
                  <td
                    className="finance-selection"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!(event.target as HTMLElement).closest("label,input"))
                        toggle(lesson.id, event.shiftKey);
                    }}
                  >
                    <label
                      className="finance-check"
                      title={`Izaberi čas: ${student}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Izaberi čas: ${student}, ${dateLabel(lesson.date)} ${clock(lesson.start)}`}
                        checked={selected.has(lesson.id)}
                        onChange={() => {}}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(lesson.id, event.shiftKey);
                        }}
                      />
                    </label>
                  </td>
                  <td data-label="Datum">
                    {dateLabel(lesson.date)}
                    <small>
                      {clock(lesson.start)}–
                      {clock(lesson.start + lesson.duration)}
                    </small>
                  </td>
                  <td data-label="Učenik">{student}</td>
                  <td data-label="Predavač">
                    {
                      view.employees.find(
                        (employee) => employee.id === lesson.teacherId,
                      )?.name
                    }
                  </td>
                  <td data-label="Cena">{money(lesson.price)}</td>
                  <td
                    className="finance-status-cell"
                    data-label="Plaćeno"
                    onClick={activateCheckboxCell}
                  >
                    <FinanceCheck
                      label={`Plaćeno: ${student}, ${dateLabel(lesson.date)} ${clock(lesson.start)}`}
                      value={paidStatus(lesson)}
                      disabled={false}
                      onChange={(value) => void save([lesson], "paid", value)}
                    />
                    <small>
                      {money(amount.paid)}
                      {amount.paid > 0 && paidStatus(lesson) === null
                        ? " · Delimično"
                        : ""}
                    </small>
                  </td>
                  <td data-label="Manojlov deo">{money(amount.boss)}</td>
                  <td
                    className="finance-status-cell"
                    data-label="Manojlo dobio deo"
                    onClick={activateCheckboxCell}
                  >
                    {own || amount.boss === 0 ? (
                      <span
                        className="muted"
                        title={
                          own
                            ? "Manojlov sopstveni čas — predaja nije potrebna."
                            : "Manojlov deo je nula — predaja nije potrebna."
                        }
                      >
                        —
                      </span>
                    ) : (
                      <>
                        <FinanceCheck
                          label={`Manojlo dobio deo: ${student}, ${dateLabel(lesson.date)} ${clock(lesson.start)}`}
                          value={handedStatus(lesson)}
                          disabled={false}
                          onChange={(value) =>
                            void save([lesson], "handed", value)
                          }
                        />
                        <small>
                          {money(amount.handed)}
                          {pending > 0
                            ? ` · Nepotvrđeno: ${money(pending)}`
                            : ""}
                        </small>
                      </>
                    )}
                  </td>
                  <td className="finance-row-actions">
                    {canOpen && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => onOpen(lesson)}
                      >
                        Otvori
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="muted">Nema održanih časova za ovaj period.</p>
      )}
    </section>
  );
}
