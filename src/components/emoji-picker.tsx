"use client";
import { useEffect, useRef, useState } from "react";
import { Smile, X } from "lucide-react";
const GROUPS: Record<string, [string, string][]> = {
  Često: [
    ["👍", "Palac gore"],
    ["❤️", "Srce"],
    ["😊", "Osmeh"],
    ["😂", "Smeh"],
    ["🙏", "Hvala"],
    ["✅", "Gotovo"],
    ["👏", "Aplauz"],
    ["🎉", "Proslava"],
    ["👌", "U redu"],
    ["💪", "Snaga"],
    ["🤝", "Dogovor"],
    ["💯", "Sto posto"],
  ],
  Lica: [
    ["😀", "Srećan"],
    ["😄", "Veseo"],
    ["😁", "Širok osmeh"],
    ["😅", "Olakšanje"],
    ["🤣", "Veliki smeh"],
    ["🙂", "Blagi osmeh"],
    ["😉", "Namigivanje"],
    ["😍", "Oduševljenje"],
    ["🥰", "Ljubav"],
    ["😎", "Kul"],
    ["🤔", "Razmišljanje"],
    ["🤓", "Štreber"],
    ["😴", "Spavanje"],
    ["😢", "Tuga"],
    ["😭", "Plač"],
    ["😮", "Iznenađenje"],
    ["🙃", "Naopako"],
    ["🥳", "Slavlje"],
  ],
  Dogovor: [
    ["✅", "Potvrđeno"],
    ["❌", "Otkazano"],
    ["❗", "Važno"],
    ["❓", "Pitanje"],
    ["📌", "Zakačeno"],
    ["🕘", "Vreme"],
    ["📅", "Datum"],
    ["⏰", "Podsetnik"],
    ["🔔", "Obaveštenje"],
    ["👍", "Da"],
    ["👎", "Ne"],
    ["🤝", "Dogovoreno"],
    ["🙏", "Molim"],
    ["💬", "Poruka"],
    ["🚀", "Krećemo"],
    ["🎯", "Cilj"],
  ],
  Učenje: [
    ["📚", "Knjige"],
    ["📖", "Čitanje"],
    ["✏️", "Olovka"],
    ["📝", "Beleška"],
    ["📐", "Lenjir"],
    ["🧮", "Računanje"],
    ["🎓", "Učenik"],
    ["🏫", "Škola"],
    ["💻", "Online"],
    ["📷", "Snimak"],
    ["📄", "Dokument"],
    ["💡", "Ideja"],
    ["☕", "Kafa"],
    ["🔥", "Odlično"],
    ["⭐", "Zvezda"],
    ["🌟", "Sjajno"],
  ],
};
export default function EmojiPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [group, setGroup] = useState("Često"),
    [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  const emojis = search
    ? Object.values(GROUPS)
        .flat()
        .filter(
          ([emoji, name], index, all) =>
            all.findIndex((v) => v[0] === emoji) === index &&
            name
              .toLocaleLowerCase("sr")
              .includes(search.toLocaleLowerCase("sr")),
        )
    : GROUPS[group];
  return (
    <div className="emoji-picker" ref={root}>
      <button
        type="button"
        className="icon-btn emoji-trigger"
        aria-label="Izaberi emodži"
        aria-expanded={open}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        <Smile size={22} />
      </button>
      {open && (
        <div className="emoji-popover" role="dialog" aria-label="Emodžiji">
          <header>
            <strong>Emodžiji</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Zatvori izbor emodžija"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </header>
          <input
            aria-label="Pretraži emodžije"
            placeholder="Pretraži…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="emoji-categories">
            {Object.keys(GROUPS).map((label) => (
              <button
                type="button"
                key={label}
                className={label === group ? "selected" : ""}
                onClick={() => {
                  setGroup(label);
                  setSearch("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {emojis.map(([emoji, name]) => (
              <button
                key={emoji}
                type="button"
                title={name}
                aria-label={`Emodži: ${name}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onPick(emoji)}
              >
                {emoji}
              </button>
            ))}
            {!emojis.length && <span>Nema rezultata.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
