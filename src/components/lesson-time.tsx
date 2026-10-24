"use client";
import { useLayoutEffect, useRef } from "react";
import { clock } from "@/lib/time";

export default function LessonTime({
  start,
  duration,
  paid = false,
  maxFont = 13,
}: {
  start: number;
  duration: number;
  paid?: boolean;
  maxFont?: number;
}) {
  const box = useRef<HTMLSpanElement>(null),
    content = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const outer = box.current,
      inner = content.current;
    if (!outer || !inner) return;
    function fit() {
      if (!outer || !inner || !outer.clientWidth) return;
      inner.style.fontSize = `${maxFont}px`;
      const natural = inner.getBoundingClientRect().width;
      const fitted = natural
        ? Math.min(maxFont, (maxFont * outer.clientWidth) / natural)
        : maxFont;
      inner.style.fontSize = `${Math.max(1, Math.floor(fitted * 10) / 10)}px`;
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [start, duration, paid, maxFont]);
  return (
    <span className="lesson-time" ref={box}>
      <span className="lesson-time-content" ref={content}>
        <span className="lesson-clock">
          {clock(start)}–{clock(start + duration)}
        </span>{" "}
        <b className="lesson-minutes">{duration} min</b>
        {paid && " ✓"}
      </span>
    </span>
  );
}
