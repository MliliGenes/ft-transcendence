"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, UnauthenticatedSessionError, type AuthenticatedRequest, type AuthSession } from "@/lib/auth/client";

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
const SESSION_REFRESH_SKEW_MS = 60_000;

/**
 * Only the auth service answering 401 ends the session. A refresh that fails
 * for any other reason (unreachable service, server error) leaves the session
 * in place: the caller can retry, and the transport keeps polling instead of
 * being told the user is signed out.
 */
function isAuthenticationRejection(error: unknown): boolean {
  return error instanceof Error
    && "status" in error
    && (error as { status: unknown }).status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const attemptedRestore = useRef(false);
  const refreshPromise = useRef<Promise<AuthSession> | null>(null);
  const queryClient = useQueryClient();
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const sessionExpiresAtRef = useRef<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const setSessionValue = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    sessionExpiresAtRef.current = next && Number.isFinite(next.expiresIn)
      ? Date.now() + Math.max(0, next.expiresIn) * 1000
      : null;
    setSessionState(next);
  }, []);
  const setSession = useCallback((next: AuthSession) => {
    setSessionValue(next);
  }, [setSessionValue]);

  const refreshSession = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    refreshPromise.current = authApi.refresh()
      .then(refreshed => {
        setSessionValue(refreshed);
        return refreshed;
      })
      .catch((error: unknown) => {
        // A transient failure (unreachable service, 5xx) must not end a
        // session that may still be usable; only a real authentication
        // rejection does.
        if (isAuthenticationRejection(error)) setSessionValue(null);
        throw error;
      })
      .finally(() => { refreshPromise.current = null; });
    return refreshPromise.current;
  }, [setSessionValue]);

  useEffect(() => {
    // Avoid racing a refresh request against a login or registration submit.
    if (attemptedRestore.current) return;
    attemptedRestore.current = true;
    if (["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"].includes(window.location.pathname)) {
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
      setSessionValue(null);
      queryClient.clear();
    }
  }, [queryClient, setSessionValue]);

  const clearSession = useCallback(() => {
    setSessionValue(null);
    queryClient.clear();
  }, [queryClient, setSessionValue]);

  const requestWithSession = useCallback<AuthenticatedRequest>(async send => {
    let currentSession = sessionRef.current;
    if (!currentSession) throw new UnauthenticatedSessionError("Please sign in to continue.");
    if (sessionExpiresAtRef.current !== null && sessionExpiresAtRef.current <= Date.now() + SESSION_REFRESH_SKEW_MS) {
      // Proactive renewal. A transient failure propagates with the session
      // intact so the caller can retry; it is never retried on the caller's
      // behalf, because a mutating command must not be replayed.
      currentSession = await refreshSession();
    }
    try {
      return await send(currentSession.accessToken);
    } catch (error) {
      // Exactly one retry, and only when the service rejected the token.
      if (!isAuthenticationRejection(error)) throw error;
      const refreshed = await refreshSession();
      return send(refreshed.accessToken);
    }
  }, [refreshSession]);

  const value = useMemo(() => ({ session, isRestoring, setSession, clearSession, refreshSession, logout, requestWithSession }), [session, isRestoring, setSession, clearSession, refreshSession, logout, requestWithSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
