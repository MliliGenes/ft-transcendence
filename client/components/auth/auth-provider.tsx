"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type AuthSession } from "@/lib/auth/client";

type AuthContextValue = {
  session: AuthSession | null;
  isRestoring: boolean;
  setSession: (session: AuthSession) => void;
  refreshSession: () => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const attemptedRestore = useRef(false);
  const refreshPromise = useRef<Promise<AuthSession> | null>(null);
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const refreshSession = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    refreshPromise.current = authApi.refresh()
      .then(refreshed => {
        setSession(refreshed);
        return refreshed;
      })
      .catch(error => {
        setSession(null);
        throw error;
      })
      .finally(() => { refreshPromise.current = null; });
    return refreshPromise.current;
  }, []);

  useEffect(() => {
    // Avoid racing a refresh request against a login or registration submit.
    if (attemptedRestore.current) return;
    attemptedRestore.current = true;
    if (window.location.pathname === "/login" || window.location.pathname === "/register") {
      Promise.resolve().then(() => setIsRestoring(false));
      return;
    }
    refreshSession()
      .catch(() => undefined)
      .finally(() => setIsRestoring(false));
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      if (refreshPromise.current) await refreshPromise.current.catch(() => undefined);
      await authApi.logout();
    } finally {
      setSession(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(() => ({ session, isRestoring, setSession, refreshSession, logout }), [session, isRestoring, refreshSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
