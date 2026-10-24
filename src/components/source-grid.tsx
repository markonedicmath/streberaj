import { addDays, clock, dateLabel } from "@/lib/time";
import type { SourceBlock } from "@/lib/types";
import { START, SLOTS } from "@/lib/time-axis";
export default function SourceGrid({
  blocks,
  week,
  hourGuides,
}: {
  blocks: SourceBlock[];
  week: string;
  hourGuides: boolean;
}) {
  return (
    <div className="source-calendar-scroll">
      <div className="source-calendar">
        <div className="source-corner" />
        {Array.from({ length: 7 }, (_, i) => (
          <div className="source-day" key={i}>
            {dateLabel(addDays(week, i))}
            <div>
              <span>Prvi sto</span>
              <span>Drugi sto</span>
            </div>
          </div>
        ))}
        <div className="source-hours">
          {Array.from({ length: SLOTS + 1 }, (_, i) => (
            <span key={i} style={{ top: i * 16 }}>
              {clock(START + i * 15)}
            </span>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(week, i);
          return (
            <div className="source-day-body" key={i}>
              {Array.from({ length: SLOTS + 1 }, (_, q) => (
                <div
                  className={
                    "time-grid-line " + (q % 4 === 0 ? "hour-line" : "")
                  }
                  key={q}
                  style={{ top: q * 16 }}
                  aria-hidden="true"
                >
                  {hourGuides && q % 4 === 0 && (
                    <span className="grid-hour-label" style={{ left: "50%" }}>
                      {clock(START + q * 15)}
                    </span>
                  )}
                </div>
              ))}
              {[1, 2].map((desk) => (
                <div className="source-desk" key={desk}>
                  {blocks
                    .filter((b) => b.date === date && b.desk === desk)
                    .map((b) => (
                      <article
                        key={b.id}
                        title={[
                          b.text,
                          b.issue,
                          b.missing ? "Uklonjeno iz izvora" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        style={{
                          top: ((b.start - 360) / 15) * 16,
                          height: (b.duration / 15) * 16 - 2,
                          background: b.color + "30",
                          borderLeftColor: b.color,
                          opacity: b.missing ? 0.5 : 1,
                        }}
                      >
                        <strong>{b.text || "Bez imena"}</strong>
                        <span>{clock(b.start)}</span>
                        {b.issue && <b>!</b>}
                      </article>
                    ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
