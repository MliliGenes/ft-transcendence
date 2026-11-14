'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { NookLogo } from '@/components/nook-logo';
import { ThemeSelector } from '@/components/theme-selector';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ErrorPageProps = {
  /** Large display text, such as "404" or "500". */
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Shows a "Try again" button that calls this handler. */
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
  /** Standalone pages get the Nook header and footer; in-app pages render inside the app shell. */
  standalone?: boolean;
  /** Optional technical reference, such as an error digest. */
  reference?: string;
  children?: ReactNode;
};

/** Server-rendered errors carry a `digest` that matches the server log entry. */
export function errorDigest(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error))
    return undefined;
  return typeof error.digest === 'string' ? error.digest : undefined;
}

export function ErrorPage({
  code,
  eyebrow,
  title,
  description,
  onRetry,
  homeHref = '/',
  homeLabel = 'Back to Nook',
  standalone = false,
  reference,
  children,
}: ErrorPageProps) {
  const content = (
    <section
      aria-labelledby="error-title"
      className="flex w-full max-w-md flex-col items-center text-center"
    >
      <p
        aria-hidden="true"
        className="select-none text-8xl font-semibold leading-none tracking-[-4px] text-foreground sm:text-9xl"
      >
        {code.split('').map((char, index) => (
          <span key={index} className={/\d/.test(char) ? '' : 'text-primary'}>
            {char}
          </span>
        ))}
      </p>
      <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">
        {eyebrow}
      </p>
      <h1
        id="error-title"
        className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            className="min-h-11 gap-2 px-5"
          >
            <IconRefresh size={17} aria-hidden="true" />
            Try again
          </Button>
        )}
        <Link
          href={homeHref}
          className={cn(
            buttonVariants({ variant: onRetry ? 'outline' : 'default' }),
            'min-h-11 gap-2 px-5',
          )}
        >
          <IconArrowLeft size={17} aria-hidden="true" />
          {homeLabel}
        </Link>
      </div>
      {children}
      {reference && (
        <p className="mt-8 text-xs text-nook-text-muted">
          Reference: <code className="font-mono">{reference}</code>
        </p>
      )}
    </section>
  );

  if (!standalone)
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        {content}
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7 md:px-12 lg:px-16">
        <Link
          href="/"
          aria-label="Nook home"
          className="inline-flex min-h-11 min-w-11 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <NookLogo className="text-4xl" />
        </Link>
        <ThemeSelector />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12 md:py-20">
        {content}
      </main>
      <footer className="px-6 py-8 text-center text-xs text-nook-text-muted">
        A place for your people.
      </footer>
    </div>
  );
}
