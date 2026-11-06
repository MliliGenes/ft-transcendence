import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight, IconChessKnight, IconDeviceGamepad2 } from "@tabler/icons-react";

export const metadata: Metadata = { title: "Play — Nook" };

export default function PlayPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Play together</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] md:text-4xl">Pick a game.</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-nook-text-secondary">A little friendly competition, shared with your people.</p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        <Link href="/play/chess" className="group flex min-h-52 flex-col border border-border bg-nook-surface p-6 transition-colors hover:bg-nook-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <IconChessKnight size={28} stroke={1.5} aria-hidden="true" className="text-primary" />
          <span className="mt-7 flex items-center justify-between gap-4">
            <span><span className="block text-lg font-medium">Chess</span><span className="mt-1 block text-sm text-nook-text-muted">A thoughtful match with a friend.</span></span>
            <IconArrowRight size={19} stroke={1.75} aria-hidden="true" className="shrink-0 text-nook-text-muted transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <div aria-label="Another game coming soon" className="flex min-h-52 flex-col border border-border p-6 text-nook-text-muted">
          <IconDeviceGamepad2 size={28} stroke={1.5} aria-hidden="true" />
          <span className="mt-7 text-lg font-medium text-foreground">More games</span>
          <span className="mt-1 text-sm">Another game is on its way.</span>
          <span className="mt-auto pt-5 text-xs font-medium uppercase tracking-[0.14em]">Coming soon</span>
        </div>
      </div>
    </section>
  );
}
