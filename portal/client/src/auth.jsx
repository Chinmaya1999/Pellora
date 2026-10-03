import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  const refresh = useCallback(async () => {
    try { setUser((await api("/auth/me")).user); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => { const d = await api("/auth/login", { method: "POST", body: { email, password } }); setUser(d.user); return d; };
  const signup = async (form) => { const d = await api("/auth/signup", { method: "POST", body: form }); setUser(d.user); return d; };
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };

  return <Ctx.Provider value={{ user, login, signup, logout, refresh }}>{children}</Ctx.Provider>;
}
