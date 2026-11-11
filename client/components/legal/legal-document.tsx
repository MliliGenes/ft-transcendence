import type { ReactNode } from "react";

export const LEGAL_LAST_UPDATED = "November 11, 2026";

export function LegalDocument({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article aria-labelledby="legal-title">
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">Legal</p>
        <h1 id="legal-title" className="text-4xl font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 text-sm text-nook-text-muted">Last updated {LEGAL_LAST_UPDATED}</p>
        <p className="mt-5 text-base leading-7 text-nook-text-secondary">{intro}</p>
      </header>
      <div className="space-y-9">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-nook-text-secondary [&_a]:text-nook-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li+li]:mt-1.5 [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
