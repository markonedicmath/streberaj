"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Employee } from "@/lib/types";

export default function AccountSelect({
  employees,
  value,
  onChange,
  onError,
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = employees.filter((employee) => employee.active);
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
      className="account-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          const options = [
            ...(root.current?.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ) ?? []),
          ];
          const index = options.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          requestAnimationFrame(() => {
            const next =
              root.current?.querySelectorAll<HTMLButtonElement>(
                '[role="option"]',
              );
            if (next?.length) {
              const target =
                index < 0
                  ? event.key === "ArrowDown"
                    ? 0
                    : next.length - 1
                  : (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      next.length) %
                    next.length;
              next[target].focus();
            }
          });
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="account-select-trigger"
        disabled={busy}
        aria-label="Prikaz naloga"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          {items.find((employee) => employee.id === value)?.name ??
            "Izaberi nalog"}
        </span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Nalozi zaposlenih"
          className="account-select-options"
        >
          {items.map((employee) => (
            <button
              key={employee.id}
              type="button"
              role="option"
              aria-selected={employee.id === value}
              onClick={async () => {
                setOpen(false);
                setBusy(true);
                try {
                  await onChange(employee.id);
                } catch (error) {
                  onError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {employee.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
