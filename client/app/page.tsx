import { IconArrowDown, IconArrowRight, IconDeviceGamepad2, IconLogin2, IconPhoto, IconMessageCircle, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { NookLogo } from "@/components/nook-logo";
import { ThemeSelector } from "@/components/theme-selector";

const features = [
  {
    number: "01",
    icon: IconUsers,
    title: "Share freely.",
    description: "A thought, a small win, something you found. Share what you’re into and keep up with the people who make your day.",
  },
  {
    number: "02",
    icon: IconMessageCircle,
    title: "Stay in the conversation.",
    description: "Catch up one-to-one or bring the group together. A place for everyday conversations and plans that start with ‘you around?’",
  },
  {
    number: "03",
    icon: IconDeviceGamepad2,
    title: "Make time to play.",
    description: "Turn a quiet evening into a friendly match. Challenge a friend, take a break, and give the group something to talk about.",
  },
];

function ImagePlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`${label} — image placeholder`}
      className={`flex flex-col items-center justify-center gap-4 bg-nook-surface text-nook-text-muted ${className}`}
    >
      <IconPhoto size={28} stroke={1.25} aria-hidden="true" />
      <span className="text-xs tracking-wide">{label}</span>
      <span className="text-[10px] uppercase tracking-[0.18em]">Image coming soon</span>
    </div>
  );
}

export default function Home() {
  return (
    <div id="top" className="min-h-screen text-foreground [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-ring">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-50 focus:bg-primary focus:p-3 focus:text-primary-foreground">
        Skip to content
      </a>

      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-7 md:px-12 lg:px-16">
        <a href="#top" aria-label="Nook home" className="inline-flex min-h-11 min-w-11 items-center">
          <NookLogo className="text-4xl" />
        </a>
        <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-6 text-sm sm:order-none sm:w-auto sm:mr-auto md:gap-9">
          <a href="#features" className="inline-flex min-h-11 items-center text-nook-text-secondary hover:text-foreground">Explore</a>
          <a href="#community" className="inline-flex min-h-11 items-center text-nook-text-secondary hover:text-foreground">About Nook</a>
        </nav>
        <nav aria-label="Account" className="flex items-center gap-2 text-sm sm:gap-4 md:gap-6">
          <a href="/login" className="inline-flex min-h-11 items-center gap-2 text-nook-text-secondary hover:text-foreground"><IconLogin2 size={18} stroke={1.75} aria-hidden="true" />Log in</a>
          <a href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover active:bg-nook-accent-pressed"><IconUserPlus size={18} stroke={1.75} aria-hidden="true" />Register</a>
          <ThemeSelector />
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-6 md:px-12 lg:px-16">
        <section aria-labelledby="hero-title" className="pb-12 pt-16 text-center md:pb-16 md:pt-24">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-nook-accent-text">A little closer. A little more together.</p>
          <h1 id="hero-title" className="mx-auto max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.025em] sm:text-6xl md:text-7xl">
            A place for<br className="sm:hidden" /> your people<span className="text-primary">.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-nook-text-secondary md:text-lg">
            Share what you’re into, chat with friends, and play together.
            A small corner of the internet that feels like you.
          </p>
          <a href="#features" className="mt-9 inline-flex min-h-12 items-center justify-center gap-6 bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover active:bg-nook-accent-pressed">
            Explore Nook <IconArrowDown size={16} stroke={1.75} aria-hidden="true" />
          </a>
        </section>

        <figure className="mb-20 md:mb-28">
          {/* Replace this placeholder with the platform screenshot when ready. */}
          <ImagePlaceholder label="A look inside Nook" className="aspect-[4/3] w-full border border-border sm:aspect-[16/8]" />
          <figcaption className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-nook-text-muted">
            <span>Your people. Your conversations. Your next match.</span>
            <span>One shared space.</span>
          </figcaption>
        </figure>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-8 border-t border-border py-14 md:py-20">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 id="features-title" className="max-w-md text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Good company.<br />More ways to connect.</h2>
            <p className="max-w-sm text-sm leading-relaxed text-nook-text-secondary">From the first hello to one more game.<br />Keep the things you enjoy close together.</p>
          </div>
          <div className="grid gap-10 md:grid-cols-3 md:gap-12">
            {features.map(({ number, icon: Icon, title, description }) => (
              <article key={number}>
                <div className="mb-6 flex items-center justify-between">
                  <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                  <span className="text-xs text-nook-text-muted">{number}</span>
                </div>
                <h3 className="mb-3 text-lg font-medium tracking-tight">{title}</h3>
                <p className="text-sm leading-7 text-nook-text-secondary">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="community" aria-labelledby="community-title" className="grid scroll-mt-8 items-center gap-10 border-t border-border py-14 md:grid-cols-2 md:gap-16 md:py-20">
          {/* Replace this placeholder with a community photo when ready. */}
          <ImagePlaceholder label="Life around Nook" className="aspect-[5/4] w-full" />
          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">Find your corner</p>
            <h2 id="community-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Big interests.<br />Small circles.<br />Room to be yourself.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-nook-text-secondary">Nook brings social life and play into one place. For the friends you already know, the people who share your interests, and the conversations you’ll pick up tomorrow.</p>
            <p className="mt-4 max-w-md text-base leading-7 text-nook-text-secondary">No big occasion needed. Just show up, share a little, and spend some time together.</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 px-6 pb-8 md:px-12 lg:px-16">
        <div className="flex w-full flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
          <div className="flex items-center gap-4">
            <NookLogo />
            <span className="text-xs text-nook-text-muted">A place for your people.</span>
          </div>
          <a href="#top" className="inline-flex min-h-11 items-center gap-3 text-xs text-nook-text-secondary hover:text-foreground">Back to top <IconArrowRight size={14} stroke={1.75} className="-rotate-90" aria-hidden="true" /></a>
        </div>
      </footer>
    </div>
  );
}
