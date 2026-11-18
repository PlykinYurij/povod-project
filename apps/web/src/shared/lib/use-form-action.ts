"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@povod/api-client";
import { useRetryAfter } from "./use-retry-after";

/** One in-flight operation per mounted form; navigation invalidates late UI results. */
export function useFormAction() {
  const active = useRef(true);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const remaining = useRetryAfter(
    error instanceof ApiRequestError ? error.retryAfter : undefined,
  );

  async function run<T>(
    operation: () => Promise<T>,
    accept: (result: T) => void | Promise<void>,
  ) {
    if (locked.current || remaining > 0) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await operation();
      if (active.current) await accept(result);
    } catch (failure) {
      if (active.current) setError(failure);
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { busy, error, remaining, run, isActive: () => active.current };
}
