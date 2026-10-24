"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ErrorMessage, Modal } from "./forms";
import type { SchoolView } from "@/lib/types";

export default function ResetBoard({
  view,
  refresh,
  onDone,
}: {
  view: SchoolView;
  refresh: () => Promise<void>;
  onDone: (message: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="content-card board-reset-card">
      <div>
        <h2>Čist uvoz iz Google tabele</h2>
        <p className="muted">
          Uklonite probne i ručno unete podatke i počnite od izvornog rasporeda.
        </p>
      </div>
      <button
        className="btn"
        disabled={!view.sync?.spreadsheetId || busy}
        onClick={() => {
          setError("");
          setConfirm(true);
        }}
      >
        Ukloni probne podatke
      </button>
      {confirm && (
        <Modal
          title="Zameni podatke Google tabelom?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>
            Biće uklonjeni svi trenutni časovi, kartoni učenika, uplate, predaje
            novca, brojači i poruke. Raspored i učenici biće ponovo uvezeni iz
            Google tabele.
          </p>
          <p>
            Zaposleni, boje, dozvole, cenovnik i Google veza ostaju sačuvani.
            Pre zamene čuva se poslednja rezervna kopija. Radnja se ne vraća
            dugmetom „Poništi”.
          </p>
          <ErrorMessage error={error} />
          <div className="form-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Odustani
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const response = await fetch("/api/sync/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ revision: view.revision }),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(result.error ?? "Ponovni uvoz nije uspeo.");
                  await refresh();
                  setConfirm(false);
                  onDone(
                    "Probni podaci su uklonjeni. Google tabela je ponovo uvezena.",
                  );
                } catch (error) {
                  setError((error as Error).message);
                  await refresh().catch(() => {});
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              {busy ? "Preuzimanje i zamena…" : "Obriši podatke i ponovo uvezi"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
