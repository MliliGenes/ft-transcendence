import type { ReactNode } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { NookLogo } from "@/components/nook-logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-ring">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7 md:px-12 lg:px-16">
        <Link href="/" aria-label="Nook home" className="inline-flex min-h-11 min-w-11 items-center">
          <NookLogo className="text-4xl" />
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-nook-text-secondary hover:text-foreground"><IconArrowLeft size={18} stroke={1.75} aria-hidden="true" />Back to Nook</Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12 md:py-20">{children}</main>
      <footer className="px-6 py-8 text-center text-xs text-nook-text-muted">A place for your people.</footer>
    </div>
  );
}
