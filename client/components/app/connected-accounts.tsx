"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconBrandDiscord, IconBrandGithub, IconCheck, IconUnlink } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/auth/client";
import { currentAccountQueryKey, useCurrentAccount } from "@/hooks/use-current-account";
import { oauthNoticeMessage, rememberOAuthProvider, takeOAuthNotice, type OAuthNotice, type OAuthProvider } from "@/lib/auth/oauth";

const providers = [
  { id: "github", name: "GitHub", Icon: IconBrandGithub },
  { id: "discord", name: "Discord", Icon: IconBrandDiscord },
] satisfies { id: OAuthProvider; name: string; Icon: typeof IconBrandGithub }[];

const authorizationOrigins: Record<OAuthProvider, string> = {
  github: "https://github.com",
  discord: "https://discord.com",
};

export function ConnectedAccounts({ showHeader = true }: { showHeader?: boolean }) {
  const { session, isRestoring, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const account = useCurrentAccount();
  const [notice, setNotice] = useState<OAuthNotice | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const restoredNotice = takeOAuthNotice("link");
    if (restoredNotice) queueMicrotask(() => setNotice(restoredNotice));
  }, []);

  const link = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      const result = await requestWithSession(token => authApi.linkProvider(provider, token));
      const url = new URL(result.authorizationUrl);
      if (url.protocol !== "https:" || url.origin !== authorizationOrigins[provider]) {
        throw new Error("The provider returned an invalid authorization URL.");
      }
      return { provider, authorizationUrl: url.href };
    },
    onMutate: () => setActionError(""),
    onSuccess: ({ provider, authorizationUrl }) => {
      rememberOAuthProvider(provider);
      window.location.assign(authorizationUrl);
    },
    onError: () => setActionError("Unable to connect that provider. Please try again."),
  });

  const unlink = useMutation({
    mutationFn: (provider: OAuthProvider) =>
      requestWithSession(token => authApi.unlinkProvider(provider, token)),
    onMutate: () => setActionError(""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currentAccountQueryKey(session?.user.id) }),
    onError: () => setActionError("Unable to disconnect that provider. Add another sign-in method first if this is your only one."),
  });

  const providersInUse = account.data
    ? Number(account.data.hasPassword) + Number(account.data.hasGithub) + Number(account.data.hasDiscord)
    : 0;
  const busyProvider = link.isPending ? link.variables : unlink.isPending ? unlink.variables : undefined;

  return (
    <section className={showHeader ? "mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14" : "w-full"} aria-labelledby={showHeader ? "connected-accounts-title" : undefined}>
      {showHeader && <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Your sign-in methods</p>
        <h1 id="connected-accounts-title" className="mt-3 text-3xl font-semibold tracking-[-0.025em] md:text-4xl">Connected accounts</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Connect GitHub or Discord to sign in to Nook. Your provider password is never shared with Nook.</p>
      </div>}

      {notice && (
        <p role={notice.result === "error" ? "alert" : "status"} className="mb-6 border border-border bg-muted px-4 py-3 text-sm">
          {oauthNoticeMessage(notice)}
        </p>
      )}

      {actionError && <p role="alert" className="mb-6 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{actionError}</p>}

      {isRestoring ? (
        <p role="status" className="py-8 text-sm text-muted-foreground">Checking your session…</p>
      ) : !session ? (
        <div className="border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Log in to manage connected accounts.</p>
          <Link href="/login" className={cn(buttonVariants(), "mt-5 min-h-11 px-5")}>Log in</Link>
        </div>
      ) : account.isPending ? (
        <p role="status" className="py-8 text-sm text-muted-foreground">Loading connected accounts…</p>
      ) : account.error ? (
        <div className="border border-border bg-card p-6">
          <p role="alert" className="text-sm text-destructive">Unable to load connected accounts.</p>
          <Button variant="outline" onClick={() => account.refetch()} className="mt-5 min-h-11 px-5">Try again</Button>
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {providers.map(({ id, name, Icon }) => {
            const connected = id === "github" ? account.data.hasGithub : account.data.hasDiscord;
            const onlySignInMethod = connected && providersInUse === 1;
            const pending = busyProvider === id;
            return (
              <article key={id} className="flex flex-wrap items-center justify-between gap-4 py-5 sm:flex-nowrap">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center border border-border bg-muted"><Icon size={21} aria-hidden="true" /></span>
                  <div>
                    <h2 className="font-medium">{name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{connected ? "Connected" : "Not connected"}</p>
                    {onlySignInMethod && <p className="mt-1 text-xs text-muted-foreground">Connect another sign-in method before removing this one.</p>}
                  </div>
                </div>
                {connected ? (
                  <Button
                    variant="outline"
                    disabled={Boolean(busyProvider) || onlySignInMethod}
                    onClick={() => {
                      if (window.confirm(`Disconnect ${name} from your Nook account?`)) unlink.mutate(id);
                    }}
                    className="min-h-11 gap-2 px-4"
                  >
                    {pending ? "Disconnecting…" : <><IconUnlink size={16} aria-hidden="true" />Disconnect</>}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={Boolean(busyProvider)}
                    onClick={() => link.mutate(id)}
                    className="min-h-11 gap-2 px-4"
                  >
                    {pending ? "Connecting…" : <><IconCheck size={16} aria-hidden="true" />Connect</>}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
