"use client";
import { useCallback, useEffect, useState } from "react";
import type { GoogleConnectionStatus } from "@/lib/google-oauth";
import { ErrorMessage } from "./forms";

export function GoogleAutoSync({
  enabled,
  spreadsheetId,
  refresh,
}: {
  enabled: boolean;
  spreadsheetId: string;
  refresh: () => Promise<void>;
}) {
  useEffect(() => {
    if (!enabled || !spreadsheetId) return;
    let stopped = false,
      busy = false;
    async function update() {
      if (busy || stopped) return;
      busy = true;
      try {
        const response = await fetch("/api/google/connection", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const status = (await response.json()) as GoogleConnectionStatus;
        if (!status.connected || stopped) return;
        await fetch("/api/sync?automatic=1", { method: "POST" });
        if (!stopped) await refresh();
      } catch {
        /* Sinhronizacija čuva poruku greške na serveru. */
      } finally {
        busy = false;
      }
    }
    void update();
    // Provera na svakih 15 minuta ako je prozor aktivan
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void update();
    }, 900000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled, spreadsheetId, refresh]);
  return null;
}
export default function GoogleConnection({
  saveSource,
  refresh,
}: {
  saveSource: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState<
      (GoogleConnectionStatus & { redirectUri: string }) | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/google/connection", {
        cache: "no-store",
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setStatus(data);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function action(kind: "connect" | "refresh" | "disconnect") {
    setBusy(true);
    setError("");
    try {
      if (kind !== "disconnect") await saveSource();
      const response = await fetch(
          kind === "connect"
            ? "/api/google/connect"
            : kind === "refresh"
              ? "/api/sync"
              : "/api/google/connection",
          {
            method: kind === "disconnect" ? "DELETE" : "POST",
          },
        ),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (kind === "connect") {
        window.location.assign(data.url);
        return;
      }
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="google-connection">
      {status?.connected ? (
        <p>
          Povezano: <strong>{status.email}</strong> · samo čitanje
        </p>
      ) : status && !status.oauthConfigured ? (
        <p>Google povezivanje čeka prvo podešavanje aplikacije.</p>
      ) : (
        <p>Poveži Google nalog koji već može da čita ovu tabelu.</p>
      )}
      <div className="connection-actions">
        <button
          className="btn"
          type="button"
          disabled={busy || !status?.oauthConfigured}
          onClick={() => void action("connect")}
        >
          {status?.mode === "oauth"
            ? "Promeni / ponovo poveži nalog"
            : "Poveži Google nalog"}
        </button>
        {status?.connected && (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void action("refresh")}
          >
            Uvezi sada
          </button>
        )}
        {status?.mode === "oauth" && (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void action("disconnect")}
          >
            Isključi vezu
          </button>
        )}
      </div>
      {status && !status.oauthConfigured && (
        <details className="google-setup">
          <summary>Prvo podešavanje Google povezivanja</summary>
          <p>
            U Google Cloud projektu aplikacije uključi Sheets API i napravi
            OAuth klijent tipa „Web application”. U podešavanjima odobrenja
            dodaj nalog koji će povezati tabelu.
          </p>
          <p>Odobrena povratna adresa:</p>
          <code>{status.redirectUri}</code>
          <p>
            ID i tajna OAuth klijenta postavljaju se na serveru kao
            GOOGLE_OAUTH_CLIENT_ID i GOOGLE_OAUTH_CLIENT_SECRET. Za objavljeni
            server postavlja se i GOOGLE_TOKEN_ENCRYPTION_KEY. Uputstvo je u
            README fajlu projekta.
          </p>
        </details>
      )}
      {status?.oauthConfigured && (
        <small>
          Google traži dozvolu za čitanje tabela. Aplikacija uvozi samo sačuvanu
          tabelu. Original se ne menja.
        </small>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
