import type { ReactNode } from "react";
import Link from "next/link";
import { NookLogo } from "@/components/nook-logo";

export function LegalDocument({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen text-foreground [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-ring">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
        <Link href="/" aria-label="Nook home" className="inline-flex min-h-11 min-w-11 items-center">
          <NookLogo className="text-3xl" />
        </Link>
        <nav aria-label="Legal pages" className="flex min-h-11 items-center gap-5 text-sm text-nook-text-secondary">
          <Link href="/privacy" aria-current={title === "Privacy Policy" ? "page" : undefined} className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" aria-current={title === "Terms of Service" ? "page" : undefined} className="hover:text-foreground">Terms</Link>
          <Link href="/" className="hover:text-foreground">Back to Nook</Link>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16 md:px-10 md:pb-24">
        <article className="border-y border-border py-10 md:py-14">
          <header className="mb-10 border-b border-border pb-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Nook · Project information</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {updatedAt}</p>
          </header>
          <div className="max-w-3xl space-y-9 text-sm leading-7 text-nook-text-secondary [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:max-w-3xl [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-foreground">
            {children}
          </div>
        </article>
      </main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-7 text-xs text-muted-foreground md:px-10">
        <span>Nook · A place for your people.</span>
        <span>For questions, contact the operator of the Nook instance you use.</span>
      </footer>
    </div>
  );
}
