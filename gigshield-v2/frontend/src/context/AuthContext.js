import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gs_token');
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then(r => setUser(r.data.worker))
      .catch(() => localStorage.removeItem('gs_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone, password) => {
    const r = await authAPI.login({ phone, password });
    localStorage.setItem('gs_token', r.data.token);
    setUser(r.data.worker);
    return r.data;
  };

  const register = async data => {
    const r = await authAPI.register(data);
    localStorage.setItem('gs_token', r.data.token);
    setUser(r.data.worker);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('gs_token');
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
