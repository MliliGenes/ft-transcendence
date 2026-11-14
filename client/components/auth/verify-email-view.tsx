'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authApi, AuthRequestError } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type State = 'checking' | 'verified' | 'invalid' | 'missing' | 'error';

export function VerifyEmailView() {
  // The verification token is single-use, so the request must run exactly once
  // even though React may run effects twice in development.
  const started = useRef(false);
  const [state, setState] = useState<State>('checking');
  const [email, setEmail] = useState('');
  const [resendState, setResendState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle');

  async function requestNewLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendState('sending');
    try {
      await authApi.requestEmailVerification(email);
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token =
      new URLSearchParams(window.location.search).get('token') ?? '';
    // Keep the token out of the address bar, history and referrers.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    );
    if (!token) {
      void Promise.resolve().then(() => setState('missing'));
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setState('verified'))
      .catch((error) => {
        setState(
          error instanceof AuthRequestError &&
            (error.status === 401 || error.status === 400)
            ? 'invalid'
            : 'error',
        );
      });
  }, []);

  return (
    <section aria-labelledby="verify-title" className="w-full max-w-[420px]">
      <div className="mb-8 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">
          Email verification
        </p>
        <h1 id="verify-title" className="text-3xl font-semibold tracking-tight">
          {state === 'verified'
            ? 'Email verified'
            : state === 'checking'
              ? 'Verifying your email'
              : 'We couldn’t verify your email'}
        </h1>
      </div>

      {state === 'checking' && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Checking your verification link…
        </p>
      )}

      {state === 'verified' && (
        <div role="status" className="border border-border bg-card p-5">
          <p className="flex items-start gap-3 text-sm leading-6">
            <IconCheck
              size={18}
              className="mt-0.5 shrink-0 text-nook-success"
              aria-hidden="true"
            />
            Thanks! Your email address is confirmed.
          </p>
          <Link href="/login" className={cn(buttonVariants(), 'mt-5 min-h-11')}>
            Continue to Nook
          </Link>
        </div>
      )}

      {(state === 'invalid' || state === 'missing' || state === 'error') && (
        <div className="border border-border bg-card p-5">
          <p role="alert" className="flex items-start gap-3 text-sm leading-6">
            <IconAlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            {state === 'missing'
              ? 'This verification link is missing its token.'
              : state === 'invalid'
                ? 'This verification link is invalid, has expired, or was already used. If you already verified your email, you can simply log in.'
                : 'Something went wrong while verifying your email. Please try the link again in a moment.'}
          </p>
          {(state === 'invalid' || state === 'missing') && (
            <form onSubmit={requestNewLink} className="mt-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="verification-email">
                  Request a new verification link
                </Label>
                <Input
                  id="verification-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setResendState('idle');
                  }}
                  placeholder="you@example.com"
                  className="h-11 bg-nook-surface"
                />
              </div>
              <Button
                type="submit"
                disabled={resendState === 'sending'}
                className="min-h-11 w-full"
              >
                {resendState === 'sending' ? 'Sending…' : 'Send new link'}
              </Button>
              {resendState === 'sent' && (
                <p role="status" className="text-sm text-nook-success">
                  If that address has an unverified account, a new link will be
                  sent if it can be requested.
                </p>
              )}
              {resendState === 'error' && (
                <p role="alert" className="text-sm text-destructive">
                  We couldn’t process that request. Please try again shortly.
                </p>
              )}
            </form>
          )}
          <Link href="/login" className={cn(buttonVariants(), 'mt-5 min-h-11')}>
            Go to log in
          </Link>
        </div>
      )}
    </section>
  );
}
