'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowRight, IconCheck, IconMail } from '@tabler/icons-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, AuthRequestError } from '@/lib/auth/client';
import { validateNewPassword } from '@/lib/auth/validation';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!emailPattern.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setPending(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (requestError) {
      if (
        requestError instanceof AuthRequestError &&
        requestError.status === 404
      )
        setSent(true);
      else
        setError('Unable to send a reset email right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="forgot-title" className="w-full max-w-[420px]">
      <div className="mb-8 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">
          Account recovery
        </p>
        <h1 id="forgot-title" className="text-3xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter your account email and we’ll send a reset link if it matches an
          account.
        </p>
      </div>
      {sent ? (
        <div role="status" className="border border-border bg-card p-5">
          <p className="flex items-start gap-3 text-sm leading-6">
            <IconCheck
              size={18}
              className="mt-0.5 shrink-0 text-nook-success"
              aria-hidden="true"
            />
            If an account uses that email, a password reset link is on its way.
          </p>
          <Link href="/login" className={cn(buttonVariants(), 'mt-5 min-h-11')}>
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="recovery-email">Email</Label>
            <div className="relative">
              <IconMail
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-12 pl-10"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full gap-2"
          >
            {pending ? (
              'Sending…'
            ) : (
              <>
                Send reset link <IconArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      )}
      <p className="mt-7 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-nook-accent-text underline underline-offset-4"
        >
          Return to log in
        </Link>
      </p>
    </section>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const initialized = useRef(false);
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token') ?? '';
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    );
    setToken(resetToken);
    setTokenReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await authApi.confirmPasswordReset(token, newPassword);
      clearSession();
      try {
        sessionStorage.setItem('nook:password-reset-success', '1');
      } catch {
        // The password was reset even if its optional notice cannot be saved.
      }
      router.replace('/login');
    } catch (requestError) {
      setError(
        requestError instanceof AuthRequestError && requestError.status === 401
          ? 'This reset link has expired or has already been used. Request a new one to continue.'
          : requestError instanceof AuthRequestError &&
              requestError.status === 400
            ? 'This reset link or password is invalid. Request a new link and try again.'
            : 'Unable to reset your password right now. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="reset-title" className="w-full max-w-[420px]">
      <div className="mb-8 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">
          Account recovery
        </p>
        <h1 id="reset-title" className="text-3xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Choose a password you haven’t used for Nook before.
        </p>
      </div>
      {!tokenReady ? (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Checking your reset link…
        </p>
      ) : !token ? (
        <div className="border border-border bg-card p-5 text-sm">
          <p role="alert">This reset link is missing its token.</p>
          <Link
            href="/forgot-password"
            className={cn(buttonVariants(), 'mt-5 min-h-11')}
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={32}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">
              8–32 characters, up to 72 UTF-8 bytes.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={32}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-12 w-full">
            {pending ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      )}
      <p className="mt-7 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-nook-accent-text underline underline-offset-4"
        >
          Return to log in
        </Link>
      </p>
    </section>
  );
}
