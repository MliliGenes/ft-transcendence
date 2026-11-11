import {
  IconArrowRight,
  IconBrandDiscord,
  IconBrandGithub,
  IconCheck,
  IconDeviceGamepad2,
  IconHome2,
  IconLogin2,
  IconMessageCircle,
  IconMoon,
  IconPaperclip,
  IconUser,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { NookLogo } from "@/components/nook-logo";
import { ThemeSelector } from "@/components/theme-selector";
import { CodeArenaPreview, FeedPreview, GroupPreview, HeroPreview, ProfilePreview } from "@/components/landing/previews";

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

// Feed, Chat, Profile and Code Arena are available.
const spaces = [
  { icon: IconHome2, name: "Feed", text: "Posts, photos and videos from everyone on Nook.", live: true },
  { icon: IconMessageCircle, name: "Chat", text: "Direct messages, groups and channels.", live: true },
  { icon: IconDeviceGamepad2, name: "Play", text: "Code Arena duels with friends or teams.", live: true },
  { icon: IconUser, name: "Profile", text: "Your avatar, banner, bio and status.", live: true },
];

const feedPoints = [
  "One shared feed for everyone on Nook, updated live",
  "Photos and videos posted straight from your device",
  "Your posts collected on your profile",
  "Edit or delete anything you’ve shared",
];

const chatPoints = [
  "Direct messages and group channels with live presence",
  "Images, PDFs and videos shared straight from your device",
  "Markdown and emoji for when plain text isn’t enough",
  "Unread counts so you always know where to pick up",
];

const primaryBtn = "inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover active:bg-nook-accent-pressed";
const ghostBtn = "inline-flex min-h-12 items-center justify-center gap-2 border border-nook-control-border px-6 text-sm font-medium transition-colors hover:bg-nook-surface-hover";
const eyebrow = "mb-5 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text";

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
          <a href="#feed" className="inline-flex min-h-11 items-center text-nook-text-secondary hover:text-foreground">Feed</a>
          <a href="#chat" className="inline-flex min-h-11 items-center text-nook-text-secondary hover:text-foreground">Chat</a>
          <a href="#community" className="inline-flex min-h-11 items-center text-nook-text-secondary hover:text-foreground">About Nook</a>
        </nav>
        <nav aria-label="Account" className="flex items-center gap-2 text-sm sm:gap-4 md:gap-6">
          <a href="/login" className="inline-flex min-h-11 items-center gap-2 text-nook-text-secondary hover:text-foreground"><IconLogin2 size={18} stroke={1.75} aria-hidden="true" />Log in</a>
          <a href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover active:bg-nook-accent-pressed"><IconUserPlus size={18} stroke={1.75} aria-hidden="true" />Register</a>
          <ThemeSelector />
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-6 md:px-12 lg:px-16">
        <section aria-labelledby="hero-title" className="pb-12 pt-16 text-center md:pb-14 md:pt-24">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-nook-accent-text">A little closer. A little more together.</p>
          <h1 id="hero-title" className="mx-auto max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.025em] sm:text-6xl md:text-7xl">
            A place for<br className="sm:hidden" /> your people<span className="text-primary">.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-nook-text-secondary md:text-lg">
            Share what you’re into, chat with friends, and play together.
            A small corner of the internet that feels like you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="/register" className={primaryBtn}>Join Nook <IconArrowRight size={16} stroke={1.75} aria-hidden="true" /></a>
            <a href="#features" className={ghostBtn}>Explore</a>
          </div>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-nook-text-muted">
            <span className="inline-flex items-center gap-1.5"><IconBrandGithub size={14} aria-hidden="true" />GitHub</span>
            <span className="inline-flex items-center gap-1.5"><IconBrandDiscord size={14} aria-hidden="true" />Discord</span>
            <span>or just your email</span>
          </p>
        </section>

        <figure className="mb-20 md:mb-28">
          <HeroPreview />
          <figcaption className="mx-auto mt-4 flex max-w-5xl flex-wrap justify-between gap-2 text-xs text-nook-text-muted">
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

          <ul aria-label="The four spaces of Nook" className="mt-14 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {spaces.map(({ icon: Icon, name, text, live }) => (
              <li key={name} className="flex flex-col gap-3 bg-background p-6 transition-colors hover:bg-nook-surface">
                <div className="flex items-center justify-between">
                  <Icon size={22} stroke={1.75} aria-hidden="true" />
                  <span className={live ? "text-[10px] font-medium uppercase tracking-[0.16em] text-nook-success" : "text-[10px] uppercase tracking-[0.16em] text-nook-text-muted"}>
                    {live ? "Available" : "Coming soon"}
                  </span>
                </div>
                <h3 className="text-base font-medium">{name}</h3>
                <p className="text-sm leading-6 text-nook-text-secondary">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="feed" aria-labelledby="feed-title" className="grid scroll-mt-8 items-center gap-10 border-t border-border py-14 md:grid-cols-[1.25fr_1fr] md:gap-14 md:py-20">
          <figure className="order-last md:order-first">
            <FeedPreview />
            <figcaption className="mt-3 text-xs text-nook-text-muted">The feed, with a new post box and a shared video.</figcaption>
          </figure>
          <div>
            <p className={eyebrow}>Feed</p>
            <h2 id="feed-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">See what everyone<br />is up to.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-nook-text-secondary">Post a thought, a photo or a clip, and it lands in front of everyone on Nook as it happens. No algorithm, just the newest posts first.</p>
            <ul className="mt-7 space-y-3">
              {feedPoints.map((p) => (
                <li key={p} className="flex gap-3 text-sm leading-6 text-nook-text-secondary">
                  <IconCheck size={18} stroke={2} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{p}
                </li>
              ))}
            </ul>
            <Link href="/feed" className={`${ghostBtn} mt-8`}>Open the feed</Link>
          </div>
        </section>

        <section id="chat" aria-labelledby="chat-title" className="grid scroll-mt-8 items-center gap-10 border-t border-border py-14 md:grid-cols-[1fr_1.25fr] md:gap-14 md:py-20">
          <div>
            <p className={eyebrow}>Chat</p>
            <h2 id="chat-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Conversations that<br />keep up with you.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-nook-text-secondary">Talk one-to-one, or build a group with channels for every topic. See who’s around, share a file, and pick up exactly where you left off.</p>
            <ul className="mt-7 space-y-3">
              {chatPoints.map((p) => (
                <li key={p} className="flex gap-3 text-sm leading-6 text-nook-text-secondary">
                  <IconCheck size={18} stroke={2} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{p}
                </li>
              ))}
            </ul>
          </div>
          <figure>
            <GroupPreview />
            <figcaption className="mt-3 flex items-center gap-2 text-xs text-nook-text-muted"><IconPaperclip size={14} aria-hidden="true" />A group channel with a shared file and formatted message.</figcaption>
          </figure>
        </section>

        <section id="community" aria-labelledby="community-title" className="grid scroll-mt-8 items-center gap-10 border-t border-border py-14 md:grid-cols-2 md:gap-16 md:py-20">
          <figure className="order-last md:order-first">
            <ProfilePreview />
            <figcaption className="mt-3 text-xs text-nook-text-muted">Make your profile yours: avatar, banner, bio and a status that says how you’re doing.</figcaption>
          </figure>
          <div>
            <p className={eyebrow}>Find your corner</p>
            <h2 id="community-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Big interests.<br />Small circles.<br />Room to be yourself.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-nook-text-secondary">Nook brings social life and play into one place. For the friends you already know, the people who share your interests, and the conversations you’ll pick up tomorrow.</p>
            <p className="mt-4 max-w-md text-base leading-7 text-nook-text-secondary">No big occasion needed. Just show up, share a little, and spend some time together.</p>
          </div>
        </section>

        <section id="play" aria-labelledby="play-title" className="grid scroll-mt-8 items-center gap-10 border-t border-border py-14 md:grid-cols-[1.25fr_1fr] md:gap-14 md:py-20">
          <div>
            <p className={eyebrow}>Play · Code Arena</p>
            <h2 id="play-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Write code.<br />Play together.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-nook-text-secondary">Challenge a friend to a 1v1 duel or team up for a 2v2 match. Code Arena brings timed programming rounds, live collaboration and team chat into Nook.</p>
            <a href="/play" className={`${primaryBtn} mt-7`}>Open Code Arena <IconArrowRight size={16} stroke={1.75} aria-hidden="true" /></a>
          </div>
          <figure>
            <CodeArenaPreview className="max-w-md md:ml-auto" />
            <figcaption className="mt-3 text-xs text-nook-text-muted md:text-right">Code Arena is available after you sign in.</figcaption>
          </figure>
        </section>

        <section aria-labelledby="yours-title" className="border-t border-border py-14 md:py-20">
          <h2 id="yours-title" className="mb-10 max-w-md text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Simple to start.<br />Yours to shape.</h2>
          <div className="grid gap-px border border-border bg-border md:grid-cols-3">
            {[
              { icon: IconUserPlus, title: "Sign in your way", text: "Create an account with your email, or continue with GitHub or Discord." },
              { icon: IconMoon, title: "Light, dark or system", text: "Pick the look that suits the hour. Nook follows your choice everywhere." },
              { icon: IconUsers, title: "Made for the 1337 / 42 community", text: "Built by students, for the people they study, build and play with." },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="bg-background p-7">
                <Icon size={22} stroke={1.75} className="mb-5 text-primary" aria-hidden="true" />
                <h3 className="mb-2 text-base font-medium">{title}</h3>
                <p className="text-sm leading-6 text-nook-text-secondary">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta-title" className="mb-16 border border-border bg-nook-surface px-6 py-14 text-center md:mb-24 md:py-20">
          <h2 id="cta-title" className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">Ready to find your people<span className="text-primary">?</span></h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-nook-text-secondary">It takes a minute to join. Say hello to someone today.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/register" className={primaryBtn}><IconUserPlus size={18} stroke={1.75} aria-hidden="true" />Create your account</a>
            <a href="/login" className={ghostBtn}>I already have one</a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 px-6 pb-8 md:px-12 lg:px-16">
        <div className="flex w-full flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
          <div className="flex items-center gap-4">
            <NookLogo />
            <span className="text-xs text-nook-text-muted">A place for your people.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 text-xs text-nook-text-secondary">
            <nav aria-label="Legal" className="flex items-center gap-x-6">
              <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">Privacy Policy</Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">Terms of Service</Link>
            </nav>
            <a href="#top" className="inline-flex min-h-11 items-center gap-3 hover:text-foreground">Back to top <IconArrowRight size={14} stroke={1.75} className="-rotate-90" aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
