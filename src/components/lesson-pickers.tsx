"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { clock, minutes } from "@/lib/time";

type PickerProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  onNext?: () => void;
};

export function LessonDatePicker({
  value,
  onChange,
  inputRef,
  onNext,
}: PickerProps) {
  const native = useRef<HTMLInputElement>(null);
  const localInput = useRef<HTMLInputElement>(null);
  const display = value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : "";
  const [text, setText] = useState(display);
  useEffect(() => {
    setText(display);
    (inputRef?.current ?? localInput.current)?.setCustomValidity("");
  }, [display, inputRef]);
  function commit(report = false) {
    const input = inputRef?.current ?? localInput.current;
    const match = /^(\d{1,2})\/(\d{1,2})$/.exec(text);
    const candidate = match
      ? `${value.slice(0, 4)}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
      : "";
    const parsed = new Date(candidate + "T12:00:00Z");
    const valid =
      !!candidate &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === candidate;
    input?.setCustomValidity(
      valid ? "" : "Unesite datum kao dan/mesec, npr. 23/10.",
    );
    if (!valid) {
      if (report) input?.reportValidity();
      return false;
    }
    setText(`${match![1].padStart(2, "0")}/${match![2].padStart(2, "0")}`);
    onChange(candidate);
    return true;
  }
  function open() {
    const input = native.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }
  return (
    <div className="lesson-picker">
      <input
        ref={inputRef ?? localInput}
        aria-label="Datum"
        type="text"
        value={text}
        required
        maxLength={5}
        placeholder="23/10"
        onChange={(event) => {
          setText(event.target.value);
          event.currentTarget.setCustomValidity("");
        }}
        onBlur={() => commit()}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onNext) {
            event.preventDefault();
            if (commit(true)) onNext();
            return;
          }
          if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            open();
          }
        }}
      />
      <button
        type="button"
        className="picker-trigger"
        aria-label="Izaberi datum"
        onClick={(event) => {
          event.preventDefault();
          open();
        }}
      >
        <CalendarDays size={17} />
      </button>
      <input
        ref={native}
        className="native-date-picker"
        type="date"
        value={value}
        tabIndex={-1}
        aria-label="Kalendar"
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function LessonTimePicker({
  value,
  onChange,
  inputRef,
  onNext,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [rawHour, rawMinute] = value.split(":");
  const hour = /^(0[6-9]|1[0-9]|2[0-3])$/.test(rawHour ?? "") ? rawHour : "08";
  const minute = ["00", "15", "30", "45"].includes(rawMinute)
    ? rawMinute
    : "00";
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="lesson-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        const v = (event.target as HTMLInputElement)?.value?.trim?.() ?? "";
        const m = v.match(/^([6-9]):([0-5]\d)$/);
        if (m) onChange(`0${m[1]}:${m[2]}`);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        required
        aria-label="Početak"
        placeholder="08:15"
        pattern="(0?[6-9]|1[0-9]|2[0-3]):[0-5][0-9]"
        maxLength={5}
        value={value}
        title="Vreme između 06:00 i 23:59"
        onChange={(event) => onChange(event.target.value.replace(".", ":"))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onNext) {
            event.preventDefault();
            if (event.currentTarget.reportValidity()) {
              setOpen(false);
              onNext();
            }
            return;
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const current = minutes(value);
            onChange(
              clock(
                Math.max(
                  360,
                  Math.min(
                    1425,
                    (Number.isFinite(current)
                      ? Math.round(current / 15) * 15
                      : 480) + (event.key === "ArrowUp" ? 15 : -15),
                  ),
                ),
              ),
            );
          }
        }}
      />
      <button
        ref={trigger}
        type="button"
        className="picker-trigger"
        aria-label="Izaberi početak časa"
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
      >
        <Clock3 size={17} />
      </button>
      {open && (
        <div
          className="time-picker-popup"
          id={id}
          role="group"
          aria-label="Izbor vremena"
        >
          <div>
            <span>Sati</span>
            <select
              aria-label="Sati"
              size={7}
              value={hour}
              autoFocus
              onChange={(event) =>
                onChange(
                  `${event.target.value}:${["00", "15", "30", "45"].includes(minute) ? minute : "00"}`,
                )
              }
            >
              {Array.from({ length: 18 }, (_, index) =>
                String(index + 6).padStart(2, "0"),
              ).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>Minuti</span>
            <select
              aria-label="Minuti"
              size={4}
              value={minute}
              onChange={(event) => {
                onChange(`${hour}:${event.target.value}`);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
