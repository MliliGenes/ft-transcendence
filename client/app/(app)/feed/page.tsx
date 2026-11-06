import type { Metadata } from "next";
import Link from "next/link";
import { IconHome2, IconSearch } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Feed — Nook" };

export default function FeedPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-7 flex size-16 items-center justify-center bg-nook-surface text-primary"><IconHome2 size={30} stroke={1.5} aria-hidden="true" /></span>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-primary">A little room to breathe</p>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] md:text-4xl">Your feed is on its way.</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-nook-text-secondary md:text-base">The best feeds start with people you care about. We’re getting this corner ready for their posts and your conversations.</p>
      <Link href="/search" className="mt-8 inline-flex min-h-12 items-center gap-3 bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover"><IconSearch size={18} stroke={1.75} aria-hidden="true" />Find your people</Link>
      <p className="mt-6 text-xs text-nook-text-muted">Feed preview · Coming soon</p>
    </section>
  );
}
