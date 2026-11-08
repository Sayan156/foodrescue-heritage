import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';

export const AuthContext = createContext(null);
const storage = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* Keep the in-memory session. */ } },
  remove: key => { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } },
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.get('fr_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!storage.get('fr_token'));
  const [sessionError, setSessionError] = useState('');
  const [retry, setRetry] = useState(0);

  const login = useCallback(data => {
    storage.set('fr_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setSessionError('');
  }, []);
  const logout = useCallback(() => {
    storage.remove('fr_token');
    storage.remove('fr_user');
    setToken('');
    setUser(null);
    setLoading(false);
    setSessionError('');
  }, []);

  useEffect(() => {
    const sync = event => {
      if (event.key !== 'fr_token' && event.key !== null) return;
      const next = storage.get('fr_token') || '';
      setUser(null); setToken(next); setLoading(!!next); setSessionError('');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    const invalid = event => { if (event.detail.token === token) logout(); };
    window.addEventListener('auth:invalid', invalid);
    return () => window.removeEventListener('auth:invalid', invalid);
  }, [token, logout]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setSessionError('');
    api('/auth/me', { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setUser(data.user); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error.status === 401 || error.code === 'ACCOUNT_INACCESSIBLE') logout();
        else setSessionError(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, logout, retry]);

  const retrySession = useCallback(() => setRetry(n => n + 1), []);
  const value = useMemo(() => ({ user, token, loading, sessionError, retrySession, login, logout }),
    [user, token, loading, sessionError, retrySession, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
