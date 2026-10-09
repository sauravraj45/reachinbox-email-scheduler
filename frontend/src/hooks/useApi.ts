'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Re-fetch silently every N ms (keeps statuses live without a spinner). */
  pollMs?: number;
  enabled?: boolean;
}

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Minimal data-fetching hook: loading/error state, stale-response protection and optional polling. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[], { pollMs, enabled = true }: Options = {}): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const reqId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchFn = useCallback(fetcher, deps);

  const run = useCallback(
    async (silent: boolean) => {
      const id = ++reqId.current;
      if (!silent) setLoading(true);
      try {
        const result = await fetchFn();
        if (id !== reqId.current) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError((err as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [fetchFn],
  );

  useEffect(() => {
    if (!enabled) return;
    void run(false);
    if (!pollMs) return;
    const t = setInterval(() => void run(true), pollMs);
    return () => clearInterval(t);
  }, [run, pollMs, enabled]);

  const reload = useCallback(() => run(true), [run]);
  return { data, error, loading, reload };
}
