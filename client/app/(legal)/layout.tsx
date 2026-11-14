import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { NookLogo } from '@/components/nook-logo';
import { ThemeSelector } from '@/components/theme-selector';

const footerLink = 'inline-flex min-h-11 items-center hover:text-foreground';

export default function LegalLayout({ children }: { children: ReactNode }) {
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 md:py-16">
        {children}
      </main>
      <footer className="px-6 py-8 text-xs text-nook-text-muted">
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center justify-center gap-x-6"
        >
          <Link href="/privacy" className={footerLink}>
            Privacy Policy
          </Link>
          <Link href="/terms" className={footerLink}>
            Terms of Service
          </Link>
        </nav>
      </footer>
    </div>
  );
}
