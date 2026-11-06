import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft, IconChessKnight } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Chess — Nook" };

export default function ChessPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-7 flex size-16 items-center justify-center bg-nook-surface text-primary">
        <IconChessKnight size={32} stroke={1.5} aria-hidden="true" />
      </span>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-primary">Chess at Nook</p>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] md:text-4xl">A good match is coming.</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-nook-text-secondary md:text-base">We’re getting chess ready so you can challenge your people and play together.</p>
      <Link href="/play" className="mt-8 inline-flex min-h-12 items-center gap-3 border border-border px-5 text-sm font-medium transition-colors hover:bg-nook-surface-hover">
        <IconArrowLeft size={18} stroke={1.75} aria-hidden="true" />Back to games
      </Link>
      <p className="mt-6 text-xs text-nook-text-muted">Chess preview · Coming soon</p>
    </section>
  );
}
