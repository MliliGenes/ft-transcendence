"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowUpRight, IconCheck, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import { ConnectedAccounts } from "@/components/app/connected-accounts";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeSelector } from "@/components/theme-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentAccountQueryKey, useCurrentAccount } from "@/hooks/use-current-account";
import { accountApi } from "@/lib/accounts/client";
import { validateNewPassword } from "@/lib/auth/validation";

function Panel({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border border-border bg-card p-5 md:p-7"><header className="mb-5"><h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></header>{children}</section>;
}

export function SettingsView() {
  const { session, isRestoring, requestWithSession } = useAuth();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const key = currentAccountQueryKey(session?.user.id);

  const password = useMutation({
    mutationFn: () => requestWithSession(token => {
      if (!account.data) throw new Error("Your account could not be loaded.");
      return account.data.hasPassword
        ? accountApi.changePassword(token, oldPassword, newPassword)
        : accountApi.setPassword(token, newPassword);
    }),
    onSuccess: () => {
      queryClient.setQueryData(key, (current: typeof account.data) => current ? { ...current, hasPassword: true } : current);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setPasswordFeedback(account.data?.hasPassword ? "Your password has been changed." : "Password added to your account.");
    },
    onError: error => setPasswordError(error instanceof Error ? error.message : "Unable to update your password. Please try again."),
  });

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback("");
    setPasswordError("");
    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    if (account.data?.hasPassword && !oldPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    password.mutate();
  }

  if (isRestoring) return <div role="status" className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Loading settings…</div>;
  if (!session) return <div className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Log in to manage your settings. <Link href="/login" className={cn(buttonVariants(), "ml-3 min-h-11")}>Log in</Link></div>;
  if (account.isPending) return <div role="status" className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Loading settings…</div>;
  if (account.error || !account.data) return <div role="alert" className="mx-auto w-full max-w-4xl p-6 text-sm text-destructive">Unable to load your settings. <Button variant="outline" onClick={() => account.refetch()} className="ml-3">Try again</Button></div>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 md:px-8 md:py-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Your Nook</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
        <nav aria-label="Settings sections" className="mt-6 flex flex-wrap gap-2 text-sm">
          {["account", "security", "connections", "appearance"].map(section => <a key={section} href={`#${section}`} className="inline-flex min-h-10 items-center border border-border bg-background px-3 capitalize hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{section}</a>)}
        </nav>
      </header>

      <Panel id="account" title="Account" description="Manage your account information.">
        <div className="divide-y divide-border border-y border-border">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><IconMail aria-hidden="true" className="text-muted-foreground" /><div><p className="text-sm font-medium">Email</p><p className="mt-1 text-sm text-muted-foreground">{account.data.email}</p></div></div><div className="flex items-center gap-3"><span className={`text-xs ${account.data.emailVerifiedAt ? "text-nook-success" : "text-muted-foreground"}`}>{account.data.emailVerifiedAt ? "Verified" : "Not verified"}</span><Link href="/profile/edit#email" className={cn(buttonVariants({ variant: "outline" }), "min-h-10")}>Edit</Link></div></div>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><IconUser aria-hidden="true" className="text-muted-foreground" /><div><p className="text-sm font-medium">Username</p><p className="mt-1 text-sm text-muted-foreground">@{account.data.username}</p></div></div><Link href="/profile/edit#username" className={cn(buttonVariants({ variant: "outline" }), "min-h-10 gap-2")}>Edit profile <IconArrowUpRight size={15} aria-hidden="true" /></Link></div>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Display name</p><p className="mt-1 text-sm text-muted-foreground">{account.data.displayName || "Not set"}</p></div><Link href="/profile/edit#displayName" className={cn(buttonVariants({ variant: "outline" }), "min-h-10")}>Edit profile</Link></div>
        </div>
      </Panel>

      <Panel id="security" title="Security" description="Use a password to keep access to your account secure.">
        <form onSubmit={submitPassword} className="max-w-xl space-y-4">
          {account.data.hasPassword && <div className="space-y-2"><Label htmlFor="old-password">Current password</Label><Input id="old-password" type="password" autoComplete="current-password" value={oldPassword} onChange={event => setOldPassword(event.target.value)} /></div>}
          <div className="space-y-2"><Label htmlFor="new-password">{account.data.hasPassword ? "New password" : "Set a password"}</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={32} value={newPassword} onChange={event => setNewPassword(event.target.value)} /><p className="text-xs text-muted-foreground">8–32 characters, up to 72 UTF-8 bytes.</p></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={32} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div>
          {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
          {passwordFeedback && <p role="status" className="flex items-center gap-2 text-sm text-nook-success"><IconCheck size={16} aria-hidden="true" />{passwordFeedback}</p>}
          <Button type="submit" disabled={password.isPending} className="min-h-11 gap-2">{password.isPending ? "Saving…" : <><IconLock size={16} aria-hidden="true" />{account.data.hasPassword ? "Change password" : "Set password"}</>}</Button>
        </form>
      </Panel>

      <Panel id="connections" title="Connections" description="Link accounts you can use to sign in to Nook."><ConnectedAccounts showHeader={false} /></Panel>

      <Panel id="appearance" title="Appearance" description="Choose how Nook looks on this device."><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Your theme preference applies across Nook.</p><div className="flex items-center gap-3"><span className="text-sm">Theme</span><ThemeSelector /></div></div></Panel>
    </div>
  );
}
