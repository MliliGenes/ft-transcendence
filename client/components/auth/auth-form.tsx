'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconArrowRight,
  IconBrandDiscord,
  IconBrandGithub,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconUser,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  validateAuth,
  type AuthErrors,
  type AuthMode,
} from '@/lib/auth/validation';
import { authApi, AuthRequestError } from '@/lib/auth/client';
import { useAuth } from '@/components/auth/auth-provider';
import {
  oauthNoticeMessage,
  rememberOAuthProvider,
  takeOAuthNotice,
  type OAuthProvider,
} from '@/lib/auth/oauth';

export function AuthForm({ mode }: { mode: AuthMode }) {
  const registering = mode === 'register';
  const router = useRouter();
  const { setSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  useEffect(() => {
    const notice = takeOAuthNotice('login');
    if (notice) queueMicrotask(() => setFormError(oauthNoticeMessage(notice)));
    try {
      if (sessionStorage.getItem('nook:password-reset-success')) {
        sessionStorage.removeItem('nook:password-reset-success');
        queueMicrotask(() =>
          setFormNotice(
            'Your password has been reset. Sign in with your new password.',
          ),
        );
      }
    } catch {
      // The login form remains usable when optional storage is blocked.
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors = validateAuth(mode, {
      username: String(data.get('username') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    });
    setErrors(nextErrors);
    setFormError('');
    setFormNotice('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid)
      (form.elements.namedItem(firstInvalid) as HTMLInputElement)?.focus();
    const termsMissing = registering && !acceptedTerms;
    setTermsError(termsMissing);
    if (firstInvalid) return;
    if (termsMissing) {
      (form.elements.namedItem('acceptTerms') as HTMLInputElement)?.focus();
      return;
    }

    setBusy(true);
    try {
      const session = registering
        ? await authApi.register(
            String(data.get('username') ?? ''),
            String(data.get('email') ?? ''),
            String(data.get('password') ?? ''),
          )
        : await authApi.login(
            String(data.get('email') ?? ''),
            String(data.get('password') ?? ''),
          );
      setSession(session);
      router.replace('/feed');
    } catch (error) {
      setFormError(
        error instanceof AuthRequestError
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="auth-title" className="w-full max-w-[420px]">
      <div className="mb-10 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">
          {registering ? 'Find your corner' : 'Your people are here'}
        </p>
        <h1
          id="auth-title"
          className="text-4xl leading-tight font-semibold tracking-[-0.025em]"
        >
          {registering ? 'Make yourself at home.' : 'Welcome back.'}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-nook-text-secondary">
          {registering
            ? 'Create your Nook account. A little closer to your people.'
            : 'Log in to your Nook account.'}
        </p>
      </div>

      <div
        className="space-y-3"
        role="group"
        aria-label="Other sign-in options"
      >
        {(
          [
            { provider: 'github', label: 'GitHub', Icon: IconBrandGithub },
            { provider: 'discord', label: 'Discord', Icon: IconBrandDiscord },
          ] satisfies {
            provider: OAuthProvider;
            label: string;
            Icon: typeof IconBrandGithub;
          }[]
        ).map(({ provider, label, Icon }) => (
          <a
            href={`/api/auth/${provider}`}
            onClick={() => rememberOAuthProvider(provider)}
            key={provider}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-12 w-full gap-2 border-nook-border-subtle bg-nook-surface-raised text-sm text-foreground',
            )}
          >
            <Icon size={18} stroke={1.75} aria-hidden="true" />
            Continue with {label}
          </a>
        ))}
        <p className="text-center text-xs leading-5 text-nook-text-muted [&_a]:text-nook-accent-text [&_a]:underline [&_a]:underline-offset-4">
          By continuing with GitHub or Discord, you agree to our{' '}
          <Link href="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="my-8 flex items-center gap-4 text-xs text-nook-text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or continue with email</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <form
        method="post"
        noValidate
        onSubmit={handleSubmit}
        onChange={() => setFormError('')}
        className="space-y-6"
      >
        {registering && (
          <div className="space-y-2.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <IconUser
                size={18}
                stroke={1.75}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted"
              />
              <Input
                id="username"
                name="username"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Your username"
                aria-invalid={Boolean(errors.username)}
                aria-describedby={`username-hint${errors.username ? ' username-error' : ''}`}
                className="h-12 bg-nook-surface pr-3 pl-10 text-base"
                onChange={() =>
                  setErrors((current) => ({ ...current, username: undefined }))
                }
              />
            </div>
            <p
              id="username-hint"
              className="text-xs leading-5 text-nook-text-muted"
            >
              3–30 characters. This is how people will know you.
            </p>
            {errors.username && (
              <p
                id="username-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.username}
              </p>
            )}
          </div>
        )}
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <IconMail
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted"
            />
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete={registering ? 'email' : 'username'}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="h-12 bg-nook-surface pr-3 pl-10 text-base"
              onChange={() =>
                setErrors((current) => ({ ...current, email: undefined }))
              }
            />
          </div>
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.email}
            </p>
          )}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {!registering && (
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center text-xs text-nook-accent-text underline underline-offset-4"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <IconLock
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nook-text-muted"
            />
            <Input
              id="password"
              name="password"
              type={visible ? 'text' : 'password'}
              required
              autoComplete={registering ? 'new-password' : 'current-password'}
              placeholder={registering ? 'Create a password' : 'Your password'}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                [
                  registering ? 'password-hint' : '',
                  errors.password ? 'password-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className="h-12 bg-nook-surface pr-12 pl-10 text-base"
              onChange={() =>
                setErrors((current) => ({ ...current, password: undefined }))
              }
            />
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              aria-controls="password"
              onClick={() => setVisible((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-nook-text-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {visible ? (
                <IconEyeOff size={18} stroke={1.75} aria-hidden="true" />
              ) : (
                <IconEye size={18} stroke={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
          {registering && (
            <p
              id="password-hint"
              className="text-xs leading-5 text-nook-text-muted"
            >
              8–32 characters, up to 72 UTF-8 bytes. Emojis can use multiple
              bytes.
            </p>
          )}
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.password}
            </p>
          )}
        </div>
        {registering && (
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={acceptedTerms}
                aria-invalid={termsError}
                aria-describedby={termsError ? 'accept-terms-error' : undefined}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked);
                  if (event.target.checked) setTermsError(false);
                }}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <label
                htmlFor="acceptTerms"
                className="cursor-pointer text-sm leading-6 text-nook-text-secondary [&_a]:text-nook-accent-text [&_a]:underline [&_a]:underline-offset-4"
              >
                I agree to the{' '}
                <Link href="/terms" target="_blank" rel="noreferrer">
                  Terms of Service
                </Link>{' '}
                and the{' '}
                <Link href="/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {termsError && (
              <p
                id="accept-terms-error"
                role="alert"
                className="text-sm text-destructive"
              >
                Please accept the Terms of Service and Privacy Policy to create
                an account.
              </p>
            )}
          </div>
        )}
        {formNotice && (
          <p role="status" className="text-sm leading-5 text-nook-success">
            {formNotice}
          </p>
        )}
        {formError && (
          <p role="alert" className="text-sm leading-5 text-destructive">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full gap-2 text-sm hover:bg-nook-accent-hover active:bg-nook-accent-pressed"
        >
          {busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}
          {!busy && (
            <IconArrowRight size={18} stroke={1.75} aria-hidden="true" />
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-nook-text-secondary">
        {registering ? 'Already have an account? ' : 'New to Nook? '}
        <Link
          href={registering ? '/login' : '/register'}
          className="inline-flex min-h-11 items-center text-nook-accent-text underline underline-offset-4"
        >
          {registering ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
