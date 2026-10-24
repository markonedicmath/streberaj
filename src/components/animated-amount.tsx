"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/time";

export default function AnimatedAmount({
  value,
  percent = false,
  count = false,
  animateOnMount = false,
}: {
  value: number | null;
  percent?: boolean;
  count?: boolean;
  animateOnMount?: boolean;
}) {
  const initial = animateOnMount && value !== null ? 0 : value;
  const [displayed, setDisplayed] = useState(initial);
  const current = useRef(initial);
  useEffect(() => {
    if (
      value === null ||
      current.current === null ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      current.current = value;
      setDisplayed(value);
      return;
    }
    const from = current.current;
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min(
        1,
        (now - started) / (animateOnMount ? 650 : 260),
      );
      const next =
        progress === 1
          ? value!
          : from + (value! - from) * (1 - (1 - progress) ** 3);
      current.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animateOnMount]);
  const label = (amount: number | null) =>
    count
      ? amount === null
        ? "—"
        : Math.round(amount).toLocaleString("sr-Latn-RS")
      : percent
        ? amount === null
          ? "—"
          : `${Math.round(amount * 100) / 100}%`
        : money(amount === null ? null : Math.round(amount));
  return (
    <span className="quote-number" aria-label={label(value)}>
      <span aria-hidden="true">
        {label(
          percent && displayed !== null && displayed !== value
            ? Math.round(displayed)
            : displayed,
        )}
      </span>
    </span>
  );
}
