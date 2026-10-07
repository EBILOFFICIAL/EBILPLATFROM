import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { tokenStore } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return null; }
    try { const me = await authService.me(); setUser(me); return me; } catch { setUser(null); return null; }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(async (accessToken) => { tokenStore.set(accessToken); return refresh(); }, [refresh]);
  const signOut = useCallback(async () => { try { await authService.logout(); } catch { /* ignore */ } tokenStore.set(null); setUser(null); }, []);

  const value = useMemo(() => ({ user, loading: user === undefined, refresh, signIn, signOut }), [user, refresh, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
