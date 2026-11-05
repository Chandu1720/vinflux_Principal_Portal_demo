import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeDb } from '../services/mockDb';
import { errorMessage } from '../services/apiClient';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Minimal data-fetching hook (no extra dependency). Re-fetches automatically when a
 * mutation broadcasts one of `tags` (or '*').
 */
export function useQuery<T>(fetcher: () => Promise<T>, tags: string[]): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const tagKey = tags.join('|');
  const seq = useRef(0);

  const run = useCallback((silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    fetcherRef.current()
      .then((d) => { if (id === seq.current) { setData(d); setError(null); } })
      .catch((e) => { if (id === seq.current) setError(errorMessage(e)); })
      .finally(() => { if (id === seq.current) setLoading(false); });
  }, []);

  useEffect(() => {
    run(false);
    const wanted = tagKey.split('|');
    return subscribeDb((changed) => {
      if (changed.includes('*') || changed.some((c) => wanted.includes(c))) run(true);
    });
  }, [run, tagKey]);

  return { data, loading, error, refetch: () => run(false) };
}
