import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { NookLogo } from '@/components/nook-logo';
import { ThemeSelector } from '@/components/theme-selector';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-ring">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7 md:px-12 lg:px-16">
        <Link
          href="/"
          aria-label="Nook home"
          className="inline-flex min-h-11 min-w-11 items-center"
        >
          <NookLogo className="text-4xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-nook-text-secondary hover:text-foreground"
          >
            <IconArrowLeft size={18} stroke={1.75} aria-hidden="true" />
            Back to Nook
          </Link>
          <ThemeSelector />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12 md:py-20">
        {children}
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-8 text-center text-xs text-nook-text-muted">
        <span>A place for your people.</span>
        <Link
          href="/privacy"
          className="min-h-11 inline-flex items-center underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="min-h-11 inline-flex items-center underline-offset-4 hover:text-foreground hover:underline"
        >
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
