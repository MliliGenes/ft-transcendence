"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { accountApi, AccountRequestError, type AccountProfile } from "./client";

export function accountError(error: unknown) {
  return error instanceof AccountRequestError ? error.message : "Something went wrong. Please try again.";
}

export function useAccount() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["accounts", "me", auth.session?.user.id];

  async function request<T>(send: (token: string) => Promise<T>): Promise<T> {
    if (!auth.session) throw new AccountRequestError("Log in to view your profile.", 401);
    try {
      return await send(auth.session.accessToken);
    } catch (error) {
      if (!(error instanceof AccountRequestError) || error.status !== 401) throw error;
      const refreshed = await auth.refreshSession();
      return send(refreshed.accessToken);
    }
  }

  const query = useQuery({
    queryKey,
    queryFn: () => request(accountApi.getMe),
    enabled: Boolean(auth.session) && !auth.isRestoring,
    retry: false,
    staleTime: 30_000,
  });

  return {
    ...auth,
    query,
    request,
    setProfile: (profile: AccountProfile) => queryClient.setQueryData(queryKey, profile),
  };
}
