"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type AuthSession } from "@/lib/auth/client";

type AuthenticatedRequest = <T>(send: (accessToken: string) => Promise<T>) => Promise<T>;

type AuthContextValue = {
  session: AuthSession | null;
  isRestoring: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  refreshSession: () => Promise<AuthSession>;
  logout: () => Promise<void>;
  requestWithSession: AuthenticatedRequest;
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
    if (["/login", "/register", "/forgot-password", "/reset-password"].includes(window.location.pathname)) {
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

  const clearSession = useCallback(() => {
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const requestWithSession = useCallback<AuthenticatedRequest>(async send => {
    if (!session) throw new Error("Log in to manage your connected accounts.");
    try {
      return await send(session.accessToken);
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 401) throw error;
      const refreshed = await refreshSession();
      return send(refreshed.accessToken);
    }
  }, [session, refreshSession]);

  const value = useMemo(() => ({ session, isRestoring, setSession, clearSession, refreshSession, logout, requestWithSession }), [session, isRestoring, clearSession, refreshSession, logout, requestWithSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
