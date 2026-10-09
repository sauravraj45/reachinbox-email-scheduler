'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'rb:starred';

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Per-browser starred emails (the star at the end of each row). */
export function useStarred() {
  const [starred, setStarred] = useState<Set<string>>(() => new Set());

  useEffect(() => setStarred(read()), []);

  const toggle = useCallback((id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next].slice(-1000)));
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return next;
    });
  }, []);

  return { starred, toggle };
}
