"use client";

import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { Lesson, SchoolView } from "@/lib/types";
import { importedDuration } from "@/lib/duration-rounding";
import { ErrorMessage, type Command } from "./forms";
import AnimatedAmount from "./animated-amount";

export default function ImportRounding({
  view,
  command,
}: {
  view: SchoolView;
  command: Command;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = view.roundImportedDurations !== false;
  const lessons = view.lessons.filter((lesson): lesson is Lesson => {
    if (
      "restricted" in lesson ||
      !lesson.sourceId ||
      lesson.deletedAt ||
      lesson.status === "cancelled"
    )
      return false;
    const original = lesson.importedDuration?.original ?? lesson.duration;
    return importedDuration(original, lesson.units ?? 1) !== original;
  });
  return (
    <section className="content-card import-rounding-card">
      <div className="import-rounding-copy">
        <h2>Ispravka trajanja iz Google tabele</h2>
        <p>
          Neki časovi su unošeni pogrešno kao 105 minuta, a zapravo su 90
          minuta: na primer, od 10:00 do 11:30 obojeno je i polje 11:30, pa je
          dodato 15 minuta viška.
        </p>
        <p className="muted">
          Zaokružuje na najbliže kraće ponuđeno trajanje: 105 → 90 i 75 → 60
          min. Važi za postojeće i nove uvoze, raspored, obračun i XLSX izvoz.
          Ručne cene i evidentirane uplate ostaju sačuvane. Isključivanje vraća
          izvorno trajanje neizmenjenih uvezenih časova.
        </p>
      </div>
      <label
        className={
          "import-rounding-toggle" +
          (enabled ? " is-checked" : "") +
          (busy ? " is-busy" : "")
        }
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={async (event) => {
            const next = event.target.checked;
            setBusy(true);
            setError("");
            try {
              await command("setImportRounding", { enabled: next });
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <span className="rounding-check" aria-hidden="true">
          {busy ? (
            <LoaderCircle size={23} className="spin" />
          ) : (
            <Check size={23} />
          )}
        </span>
        <span>
          Zaokruži na dole<small>{enabled ? "Uključeno" : "Isključeno"}</small>
        </span>
      </label>
      <div className="import-rounding-stats">
        <div>
          <span>{enabled ? "Ispravljeni časovi" : "Časovi za ispravku"}</span>
          <strong>
            <AnimatedAmount value={lessons.length} count animateOnMount />
          </strong>
        </div>
        <div>
          <span>Ukupno trajanje ovih časova</span>
          <strong>
            <AnimatedAmount
              value={lessons.reduce((sum, lesson) => sum + lesson.duration, 0)}
              count
              animateOnMount
            />{" "}
            min
          </strong>
        </div>
        <div>
          <span>Vrednost ovih časova</span>
          <strong>
            <AnimatedAmount
              value={lessons.reduce(
                (sum, lesson) => sum + (lesson.price ?? 0),
                0,
              )}
              animateOnMount
            />
          </strong>
        </div>
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}
