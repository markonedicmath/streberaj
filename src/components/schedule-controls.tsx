"use client";

import { Plus } from "lucide-react";

export function DayWeekToggle({ dayView, onChange, className = "" }: {
  dayView: boolean;
  onChange: (dayView: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={`day-week-control ${className}`}
      data-view={dayView ? "day" : "week"}
      role="group"
      aria-label="Prikaz rasporeda"
    >
      <span className="day-week-slider" aria-hidden="true" />
      <button type="button" aria-pressed={dayView} onClick={() => onChange(true)}>Dan</button>
      <button type="button" aria-pressed={!dayView} onClick={() => onChange(false)}>Nedelja</button>
    </div>
  );
}

export function ScheduleSwitch({ checked, onChange, label, description, className = "" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <label className={`schedule-switch ${className}`}>
      <input type="checkbox" role="switch" aria-label={description} checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="schedule-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function NewLessonButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`add-lesson-pill ${className}`} onClick={onClick}>
      <span className="add-lesson-icon" aria-hidden="true"><Plus size={17} strokeWidth={2.2} /></span>
      <span>Novi čas</span>
    </button>
  );
}
