import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/adminService';

const RecordContext = createContext(null);

export function RecordProvider({ children }) {
  const [stack, setStack] = useState([]);
  const [models, setModels] = useState([]);
  const [version, setVersion] = useState(0);
  useEffect(() => { adminService.get('/data').then((m) => setModels(m.map((x) => x.name))).catch(() => {}); }, []);
  const open = useCallback((model, id) => id && setStack([{ model, id }]), []);
  const push = useCallback((model, id) => id && setStack((s) => [...s, { model, id }]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ stack, models, version, open, push, back, close, changed }), [stack, models, version, open, push, back, close, changed]);
  return <RecordContext.Provider value={value}>{children}</RecordContext.Provider>;
}

export const useRecord = () => useContext(RecordContext);

export const resolveModel = (models, name) => {
  if (!name) return null;
  if (models.includes(name)) return name;
  const pascal = String(name).split(/[_\s-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return models.find((m) => m.toLowerCase() === pascal.toLowerCase()) || null;
};

export const titleOf = (d) => d?.fullName || d?.name || d?.companyName || d?.title || d?.text || d?.subject || d?.email || d?.code || d?.action || d?.period || d?.slug || d?.eibilId || d?.key || (d?._id ? `#${String(d._id).slice(-6)}` : '—');
