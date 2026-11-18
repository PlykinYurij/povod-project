"use client";

import { useEffect, useState } from "react";

/** A display timer only: it never polls the authenticated API or extends a session. */
export function useRetryAfter(seconds?: number): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!seconds) {
      setRemaining(0);
      return;
    }
    const deadline = Date.now() + seconds * 1000;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return remaining;
}
