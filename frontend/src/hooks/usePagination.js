import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../services/api';

export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'success' in r && 'data' in r) { setData(r.data); setMeta(r.meta || null); } else setData(r);
      setError(null);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { data, meta, error, loading, reload: load, setData };
}
