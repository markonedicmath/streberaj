"use client";

import { useRef, useState } from "react";

// Keep controls responsive while preserving the user's click order on the server.
export function useQueuedToggle() {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [pending, setPending] = useState<
    Record<string, { value: boolean; count: number }>
  >({});
  async function run(
    keys: string[],
    value: boolean,
    action: () => Promise<unknown>,
  ) {
    const unique = [...new Set(keys)];
    setPending((current) => {
      const next = { ...current };
      for (const key of unique)
        next[key] = { value, count: (next[key]?.count ?? 0) + 1 };
      return next;
    });
    const job = queue.current.then(action);
    queue.current = job.then(
      () => {},
      () => {},
    );
    try {
      await job;
    } finally {
      setPending((current) => {
        const next = { ...current };
        for (const key of unique) {
          if (next[key]?.count > 1)
            next[key] = { ...next[key], count: next[key].count - 1 };
          else delete next[key];
        }
        return next;
      });
    }
  }
  return { pending, run, saving: Object.keys(pending).length > 0 };
}
