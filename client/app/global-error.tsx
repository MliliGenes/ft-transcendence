"use client";

import "./globals.css";

// Replaces the root layout when it fails, so this page brings its own document
// and cannot rely on providers, fonts or client-side navigation.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p aria-hidden="true" className="select-none text-8xl font-semibold leading-none tracking-[-4px] sm:text-9xl">
            5<span className="text-primary">0</span>0
          </p>
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">Something went wrong</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Nook ran into a problem</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">The app couldn’t start. Try again, and if it keeps happening, come back in a little while.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => retry()} className="inline-flex min-h-11 items-center bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Try again</button>
            <button type="button" onClick={() => window.location.assign("/")} className="inline-flex min-h-11 items-center border border-border px-5 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Back to Nook</button>
          </div>
        </main>
      </body>
    </html>
  );
}
