"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { accountApi } from "@/lib/accounts/client";

export function currentAccountQueryKey(userId?: string) {
  return ["accounts", "me", userId] as const;
}

export function useCurrentAccount() {
  const { session, isRestoring, requestWithSession } = useAuth();
  return useQuery({
    queryKey: currentAccountQueryKey(session?.user.id),
    queryFn: () => requestWithSession(token => accountApi.getMe(token)),
    enabled: Boolean(session) && !isRestoring,
    retry: false,
  });
}
