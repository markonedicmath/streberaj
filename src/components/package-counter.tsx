"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StudentView, CounterScope } from "@/lib/types";
export default function PackageCounter({
  student,
  cycle = student.cycle,
  size = student.cycleSize ?? student.packageSize ?? 4,
  onCorrect,
  scopeSelection = true,
  onChange,
}: {
  student: StudentView;
  cycle?: number;
  size?: number;
  onCorrect?: (
    number: number,
    size: number,
    scope: CounterScope,
  ) => Promise<void>;
  scopeSelection?: boolean;
  onChange: (size: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(size)),
    [number, setNumber] = useState(String(cycle)),
    [pending, setPending] = useState<{ number: number; size: number } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => {
    setValue(String(size));
    setNumber(String(cycle));
  }, [size, cycle]);
  function reset() {
    setValue(String(size));
    setNumber(String(cycle));
    setPending(null);
    setError("");
  }
  async function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const nextSize = Number(value),
      nextNumber = Number(number);
    if (
      !value.trim() ||
      !Number.isInteger(nextSize) ||
      nextSize < 1 ||
      nextSize > 200
    ) {
      setValue(String(size));
      setError("Paket mora imati od 1 do 200 časova.");
      return;
    }
    if (onCorrect) {
      if (
        !number.trim() ||
        !Number.isInteger(nextNumber) ||
        nextNumber < (scopeSelection ? 1 : 0) ||
        nextNumber > nextSize
      ) {
        setNumber(String(cycle));
        setError("Broj časa mora biti u okviru paketa.");
        return;
      }
      if (nextSize === size && nextNumber === cycle) return;
      setError("");
      setPending({ number: nextNumber, size: nextSize });
      return;
    }
    if (nextSize === size) return;
    setBusy(true);
    setError("");
    try {
      await onChange(nextSize);
    } catch (e) {
      setError((e as Error).message);
      setValue(String(size));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span
        className="package-counter"
        title={error || "Broj časa / veličina paketa — kliknite broj za izmenu"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            void commit();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelled.current = true;
            reset();
            (e.target as HTMLInputElement).blur();
          }
        }}
      >
        {onCorrect ? (
          <input
            aria-label={`Broj časa: ${student.name}`}
            inputMode="numeric"
            value={number}
            disabled={busy}
            style={{ width: Math.max(1, number.length) * 0.72 + "em" }}
            onFocus={(e) => {
              cancelled.current = false;
              e.target.select();
            }}
            onChange={(e) => setNumber(e.target.value)}
          />
        ) : (
          <span>{cycle}</span>
        )}
        <span>/</span>
        <input
          aria-label={`Veličina paketa: ${student.name}`}
          inputMode="numeric"
          value={value}
          disabled={busy}
          style={{ width: Math.max(1, value.length) * 0.72 + "em" }}
          onFocus={(e) => {
            cancelled.current = false;
            e.target.select();
          }}
          onChange={(e) => setValue(e.target.value)}
        />
      </span>
      {pending &&
        createPortal(
          <div
            className="counter-correction-overlay"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget && !busy) reset();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape" && !busy) reset();
              if (e.key === "Tab") {
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  );
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div
              className="counter-correction"
              role="dialog"
              aria-modal="true"
              aria-label="Ispravka brojača"
            >
              <strong>
                {student.name} · {pending.number}/{pending.size}
              </strong>
              <p>
                {scopeSelection
                  ? "Na koje časove primeniti ispravku brojača?"
                  : "Sačuvati trenutni brojač učenika? Ukupan broj održanih časova ostaje sačuvan."}
              </p>
              {(scopeSelection
                ? [
                    ["only", "Samo ovaj čas"],
                    ["future", "Ovaj i budući časovi"],
                    ["previous", "Ovaj i prethodni časovi"],
                  ]
                : [["only", "Sačuvaj brojač"]]
              ).map(([scope, label]) => (
                <button
                  type="button"
                  className="btn"
                  autoFocus={scope === "only"}
                  key={scope}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await onCorrect!(
                        pending.number,
                        pending.size,
                        scope as CounterScope,
                      );
                      setPending(null);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {label}
                </button>
              ))}
              {error && <p className="form-error">{error}</p>}
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={reset}
              >
                Odustani
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
