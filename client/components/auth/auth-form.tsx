"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconBrandDiscord, IconBrandGithub, IconEye, IconEyeOff, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateAuth, type AuthErrors, type AuthMode } from "@/lib/auth/validation";
import { authApi, AuthRequestError } from "@/lib/auth/client";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const registering = mode === "register";
  const router = useRouter();
  const { setSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors = validateAuth(mode, {
      username: String(data.get("username") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setErrors(nextErrors);
    setFormError("");
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) (form.elements.namedItem(firstInvalid) as HTMLInputElement)?.focus();
    if (firstInvalid) return;

    setBusy(true);
    try {
      const session = registering
        ? await authApi.register(String(data.get("username") ?? ""), String(data.get("email") ?? ""), String(data.get("password") ?? ""))
        : await authApi.login(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
      setSession(session);
      router.replace("/feed");
    } catch (error) {
      setFormError(error instanceof AuthRequestError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="auth-title" className="w-full max-w-[420px]">
      <div className="mb-10 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-primary">{registering ? "Find your corner" : "Your people are here"}</p>
        <h1 id="auth-title" className="text-4xl leading-tight font-semibold tracking-[-0.025em]">{registering ? "Make yourself at home." : "Welcome back."}</h1>
        <p className="mt-4 text-base leading-relaxed text-nook-text-secondary">{registering ? "Create your Nook account. A little closer to your people." : "Log in to your Nook account."}</p>
      </div>

      <div className="space-y-3" role="group" aria-label="Other sign-in options" aria-describedby="oauth-notice">
        <Button type="button" variant="outline" disabled className="h-12 w-full gap-2 border-nook-border-subtle bg-nook-surface-raised text-sm text-foreground disabled:opacity-100">
          <IconBrandGithub size={18} stroke={1.75} aria-hidden="true" />
          Continue with GitHub
        </Button>
        <Button type="button" variant="outline" disabled className="h-12 w-full gap-2 border-nook-border-subtle bg-nook-surface-raised text-sm text-foreground disabled:opacity-100">
          <IconBrandDiscord size={18} stroke={1.75} aria-hidden="true" />
          Continue with Discord
        </Button>
        <p id="oauth-notice" className="text-center text-xs leading-5 text-nook-text-muted">GitHub and Discord sign-in are coming soon.</p>
      </div>

      <div className="my-8 flex items-center gap-4 text-xs text-nook-text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or continue with email</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <form method="post" noValidate onSubmit={handleSubmit} onChange={() => setFormError("")} className="space-y-6">
        {registering && (
          <div className="space-y-2.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <IconUser size={18} stroke={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted" />
              <Input id="username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Your username" aria-invalid={Boolean(errors.username)} aria-describedby={`username-hint${errors.username ? " username-error" : ""}`} className="h-12 bg-nook-surface pr-3 pl-10 text-base" onChange={() => setErrors(current => ({ ...current, username: undefined }))} />
            </div>
            <p id="username-hint" className="text-xs leading-5 text-nook-text-muted">3–30 characters. This is how people will know you.</p>
            {errors.username && <p id="username-error" role="alert" className="text-sm text-destructive">{errors.username}</p>}
          </div>
        )}
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <IconMail size={18} stroke={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted" />
            <Input id="email" name="email" type="email" required autoComplete={registering ? "email" : "username"} autoCapitalize="none" spellCheck={false} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className="h-12 bg-nook-surface pr-3 pl-10 text-base" onChange={() => setErrors(current => ({ ...current, email: undefined }))} />
          </div>
          {errors.email && <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <IconLock size={18} stroke={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted" />
            <Input id="password" name="password" type={visible ? "text" : "password"} required autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "Create a password" : "Your password"} aria-invalid={Boolean(errors.password)} aria-describedby={[registering ? "password-hint" : "", errors.password ? "password-error" : ""].filter(Boolean).join(" ") || undefined} className="h-12 bg-nook-surface pr-12 pl-10 text-base" onChange={() => setErrors(current => ({ ...current, password: undefined }))} />
            <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} aria-controls="password" onClick={() => setVisible(current => !current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-nook-text-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {visible ? <IconEyeOff size={18} stroke={1.75} aria-hidden="true" /> : <IconEye size={18} stroke={1.75} aria-hidden="true" />}
            </button>
          </div>
          {registering && <p id="password-hint" className="text-xs leading-5 text-nook-text-muted">8–32 characters, up to 72 UTF-8 bytes. Emojis can use multiple bytes.</p>}
          {errors.password && <p id="password-error" role="alert" className="text-sm text-destructive">{errors.password}</p>}
        </div>
        {formError && <p role="alert" className="text-sm leading-5 text-destructive">{formError}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full gap-2 text-sm hover:bg-nook-accent-hover active:bg-nook-accent-pressed">{busy ? "Please wait…" : registering ? "Create account" : "Log in"}{!busy && <IconArrowRight size={18} stroke={1.75} aria-hidden="true" />}</Button>
      </form>

      <p className="mt-8 text-center text-sm text-nook-text-secondary">
        {registering ? "Already have an account? " : "New to Nook? "}
        <Link href={registering ? "/login" : "/register"} className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">{registering ? "Log in" : "Create an account"}</Link>
      </p>
    </section>
  );
}
