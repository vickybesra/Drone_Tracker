import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // future-friendly shape: { id, email, name }

  useEffect(() => {
    try {
      const persisted = sessionStorage.getItem('auth.session');
      if (persisted === '1') setIsAuthenticated(true);
      const persistedUser = sessionStorage.getItem('auth.user');
      if (persistedUser) setUser(JSON.parse(persistedUser));
    } catch (_) {
      // ignore storage errors
    }
  }, []);

  const login = useCallback(async (identifier, password) => {
    // Placeholder login. Replace with a secure server call that sets an httpOnly cookie.
    if (!identifier || !password) {
      throw new Error('Please provide both Username/Email and Password.');
    }
    // Simulate latency
    await new Promise((r) => setTimeout(r, 400));

    // Mark session (do NOT persist sensitive data; avoid storing tokens in localStorage)
    setIsAuthenticated(true);
    const u = { identifier };
    setUser(u);
    try {
      sessionStorage.setItem('auth.session', '1');
      sessionStorage.setItem('auth.user', JSON.stringify(u));
    } catch (_) {
      // ignore
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      sessionStorage.removeItem('auth.session');
      sessionStorage.removeItem('auth.user');
    } catch (_) {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ isAuthenticated, user, login, logout }), [isAuthenticated, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
