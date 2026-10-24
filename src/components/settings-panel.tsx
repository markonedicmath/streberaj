"use client";

import { useState } from "react";
import { Check, LogOut } from "lucide-react";
import type { SchoolView } from "@/lib/types";
import { STAFF_COLORS, textForColor } from "@/lib/staff-colors";
import { ErrorMessage, Field, Modal, type Command } from "./forms";

export default function SettingsPanel({
  view,
  command,
  onClose,
  hourGuides,
  onHourGuides,
}: {
  view: SchoolView;
  command: Command;
  onClose: () => void;
  hourGuides: boolean;
  onHourGuides: (value: boolean) => void;
}) {
  const [profile, setProfile] = useState({
    name: view.actor.name,
    contactEmail: view.actor.contactEmail ?? view.actor.email,
    color: view.actor.color,
    preferences: {
      notifications: view.actor.preferences?.notifications ?? true,
      sound: view.actor.preferences?.sound ?? false,
    },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Podešavanja" onClose={onClose}>
      <form
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await command("saveProfile", profile);
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="settings-section">
          <legend>Obaveštenja</legend>
          <label className="settings-toggle">
            <span>
              <strong>Prikaži obaveštenja</strong>
              <small>Poruke i izmene rasporeda u zaglavlju.</small>
            </span>
            <input
              type="checkbox"
              checked={profile.preferences.notifications}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    notifications: event.target.checked,
                  },
                }))
              }
            />
          </label>
          <label className="settings-toggle">
            <span>
              <strong>Zvuk obaveštenja</strong>
              <small>
                Podrazumevano isključen. Kratak zvuk uz obaveštenje i potvrdu
                čuvanja časa.
              </small>
            </span>
            <input
              type="checkbox"
              checked={profile.preferences.sound}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    sound: event.target.checked,
                  },
                }))
              }
            />
          </label>
        </fieldset>
        <fieldset className="settings-section">
          <legend>Moj profil</legend>
          <div className="form-grid">
            <Field label="Ime i prezime" wide>
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={profile.name}
                onChange={(event) =>
                  setProfile({ ...profile, name: event.target.value })
                }
              />
            </Field>
            <Field label="Kontakt imejl (Gmail)" wide>
              <input
                type="email"
                autoComplete="email"
                placeholder="ime@gmail.com"
                value={profile.contactEmail}
                onChange={(event) =>
                  setProfile({ ...profile, contactEmail: event.target.value })
                }
              />
              <small>
                Adresa za kontakt. Google nalog za prijavu menja Manojlo u
                administraciji.
              </small>
            </Field>
            {view.actor.email && (
              <Field label="Google nalog za prijavu" wide>
                <input type="email" value={view.actor.email} readOnly />
              </Field>
            )}
            <fieldset className="staff-color-picker wide">
              <legend>Moja boja u rasporedu</legend>
              <div>
                {STAFF_COLORS.map((color) => {
                  const occupied = view.employees.find(
                    (employee) =>
                      employee.id !== view.actor.id &&
                      employee.color === color.background,
                  );
                  return (
                    <button
                      type="button"
                      key={color.background}
                      disabled={!!occupied}
                      title={
                        color.name + (occupied ? ` · ${occupied.name}` : "")
                      }
                      aria-label={
                        color.name +
                        (occupied ? ` · zauzeto: ${occupied.name}` : "")
                      }
                      aria-pressed={profile.color === color.background}
                      style={{
                        background: color.background,
                        color: color.text,
                      }}
                      onClick={() =>
                        setProfile({ ...profile, color: color.background })
                      }
                    >
                      <span>Aa</span>
                      {profile.color === color.background && (
                        <Check size={13} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p
                className="staff-color-preview"
                style={{
                  background: profile.color,
                  color: textForColor(profile.color),
                }}
              >
                <strong>{profile.name || "Moje ime"}</strong>
                <span>09:00–09:45 · 45 min</span>
              </p>
            </fieldset>
          </div>
        </fieldset>
        <fieldset className="settings-section">
          <legend>Prikaz rasporeda</legend>
          <label className="settings-toggle">
            <span>
              <strong>Sati u mreži</strong>
              <small>Sive oznake na pun sat.</small>
            </span>
            <input
              type="checkbox"
              checked={hourGuides}
              onChange={(event) => onHourGuides(event.target.checked)}
            />
          </label>
        </fieldset>
        <ErrorMessage error={error} />
        <div className="form-actions">
          {!view.demo && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await fetch("/auth/logout", { method: "POST" });
                location.reload();
              }}
            >
              <LogOut size={15} />
              Odjavi se
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Čuvanje…" : "Sačuvaj podešavanja"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
