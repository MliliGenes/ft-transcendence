"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountRequestError } from "@/lib/accounts/client";
import { accountError, type useAccount } from "@/lib/accounts/use-account";

export function AccountStatus({ account }: { account: ReturnType<typeof useAccount> }) {
  if (account.isRestoring || (account.session && account.query.isPending)) return <p role="status" className="px-6 py-16 text-center text-sm text-nook-text-muted">Loading your profile…</p>;
  const needsLogin = !account.session || (account.query.error instanceof AccountRequestError && account.query.error.status === 401);
  return <section className="mx-auto max-w-xl px-6 py-16 text-center">
    <p role="alert" className="text-sm text-nook-text-secondary">{needsLogin ? "Log in to view your profile and settings." : accountError(account.query.error)}</p>
    {needsLogin ? <Link href="/login" className="mt-6 inline-flex min-h-11 items-center bg-primary px-5 text-sm font-medium text-primary-foreground">Log in</Link> : <Button variant="outline" onClick={() => account.query.refetch()} className="mt-6 min-h-11 px-5">Try again</Button>}
  </section>;
}
