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
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {items.find((e) => e.id === value) && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: items.find((e) => e.id === value)?.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
          )}
          <span className="account-select-label-text">
            {items.find((employee) => employee.id === value)?.name ??
              "Izaberi nalog"}
          </span>
        </span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Nalozi zaposlenih"
          className="account-select-options"
          style={{ minWidth: 180 }}
        >
          {items.map((employee) => (
            <button
              key={employee.id}
              type="button"
              role="option"
              aria-selected={employee.id === value}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 8px",
              }}
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
              <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    backgroundColor: employee.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {employee.name}
                </span>
              </span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.65,
                  textTransform: "uppercase",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {employee.role === "admin" ? "Admin" : "Predavač"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
