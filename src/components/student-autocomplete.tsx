"use client";
import { useId, useState } from "react";
import type { Student } from "@/lib/types";
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sr");
export default function StudentAutocomplete({
  students,
  value,
  onChange,
  onSelect,
  onSubmit,
  onEscape,
  onBlur,
  autoFocus = false,
  disabled = false,
  required = false,
  label = "Ime i prezime",
  placeholder = "Ime učenika",
}: {
  students: Student[];
  value: string;
  onChange: (s: string) => void;
  onSelect: (s: Student) => void;
  onSubmit?: () => void;
  onEscape?: () => void;
  onBlur?: (target: EventTarget | null) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    listId = useId(),
    matches = value.trim()
      ? students
          .filter((s) => normalized(s.name).includes(normalized(value.trim())))
          .slice(0, 8)
      : [];
  function pick(student: Student) {
    setOpen(false);
    setActive(-1);
    onSelect(student);
  }
  return (
    <div
      className="autocomplete"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          onBlur?.(e.relatedTarget);
        }
      }}
    >
      <input
        aria-label={label}
        autoFocus={autoFocus}
        data-initial-focus={autoFocus || undefined}
        minLength={required ? 1 : undefined}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? listId + "-" + active : undefined
        }
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (matches.length) {
              e.preventDefault();
              setOpen(true);
              setActive(
                (a) =>
                  (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) %
                  matches.length,
              );
            }
          }
          if (e.key === "Enter") {
            if (open && active >= 0 && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            } else if (onSubmit) {
              e.preventDefault();
              setOpen(false);
              onSubmit();
            }
          }
          if (e.key === "Escape") {
            e.preventDefault();
            if (open && matches.length) setOpen(false);
            else onEscape?.();
          }
        }}
      />
      {open && matches.length > 0 && (
        <div
          className="autocomplete-list"
          id={listId}
          role="listbox"
          aria-label="Postojeći učenici"
        >
          {matches.map((s, i) => (
            <button
              type="button"
              role="option"
              id={listId + "-" + i}
              aria-selected={active === i}
              key={s.id}
              title={s.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <strong>{s.name}</strong>
              {s.level && <small>{s.level}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
