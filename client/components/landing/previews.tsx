import {
  IconBold,
  IconCheck,
  IconCode,
  IconDeviceGamepad2,
  IconFileTypePdf,
  IconHash,
  IconHome2,
  IconMessageCircle,
  IconMoodSmile,
  IconPaperclip,
  IconPhoto,
  IconPlayerPlayFilled,
  IconSend2,
  IconUser,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { StatusDot, type Presence } from '@/components/app/status-dot';

/*
 * Decorative product previews for the landing page.
 * They are built from the real design tokens (not bitmaps), so they follow the
 * light/dark theme and stay sharp. All names and messages are fictional.
 * Every preview is aria-hidden: the surrounding <figure> carries the description.
 */

function Window({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none select-none overflow-hidden border border-border bg-background shadow-glow',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-nook-surface px-3 py-2">
        <span className="size-2 rounded-full bg-nook-text-muted/40" />
        <span className="size-2 rounded-full bg-nook-text-muted/40" />
        <span className="size-2 rounded-full bg-nook-text-muted/40" />
        <span className="ml-3 truncate text-[11px] text-nook-text-muted">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Avatar({
  name,
  status,
  className,
}: {
  name: string;
  status?: Presence;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-full bg-nook-surface-raised text-xs font-medium text-foreground',
        className,
      )}
    >
      {name[0]}
      {status && (
        <StatusDot
          status={status}
          className="absolute -right-0.5 -bottom-0.5 size-2"
          ring
        />
      )}
    </span>
  );
}

function Bubble({
  who,
  mine,
  children,
}: {
  who: string;
  mine?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
      <Avatar name={who} className="size-7" />
      <div
        className={cn(
          'max-w-[78%] space-y-1.5',
          mine && 'items-end text-right',
        )}
      >
        <div
          className={cn(
            'inline-block px-3 py-2 text-left text-[12px] leading-5',
            mine
              ? 'bg-primary text-primary-foreground'
              : 'bg-nook-surface text-foreground',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Composer({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-nook-surface px-3 py-2.5">
      <IconPaperclip size={16} className="text-nook-text-muted" />
      <span className="flex-1 truncate text-[12px] text-nook-text-muted">
        {placeholder}
      </span>
      <IconMoodSmile size={16} className="text-nook-text-muted" />
      <span className="grid size-7 place-items-center bg-primary text-primary-foreground">
        <IconSend2 size={14} />
      </span>
    </div>
  );
}

/** Hero: app shell with navigation, conversation list and a direct message. */
export function HeroPreview() {
  const nav = [
    { Icon: IconHome2, active: false },
    { Icon: IconMessageCircle, active: true },
    { Icon: IconDeviceGamepad2, active: false },
    { Icon: IconUser, active: false },
  ];
  const chats: {
    name: string;
    last: string;
    status: Presence;
    unread?: number;
    active?: boolean;
  }[] = [
    {
      name: 'Amina',
      last: 'you around tonight?',
      status: 'ONLINE',
      unread: 2,
      active: true,
    },
    {
      name: 'Project crew',
      last: 'Sara: pushed the new build',
      status: 'ONLINE',
    },
    { name: 'Yassine', last: 'send me the diagram', status: 'AWAY' },
    { name: 'Omar', last: 'see you tomorrow', status: 'OFFLINE' },
  ];
  return (
    <Window title="nook / chat" className="mx-auto w-full max-w-5xl">
      <div className="flex h-[360px] sm:h-[420px]">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-nook-surface py-4 md:flex">
          <span className="mb-3 text-xl leading-none font-semibold tracking-[-1.5px]">
            n<span className="text-primary">.</span>
          </span>
          {nav.map(({ Icon, active }, i) => (
            <span
              key={i}
              className={cn(
                'grid size-9 place-items-center',
                active
                  ? 'bg-nook-accent-subtle text-primary'
                  : 'text-nook-text-muted',
              )}
            >
              <Icon size={18} stroke={1.75} />
            </span>
          ))}
        </div>
        <div className="hidden w-60 shrink-0 flex-col border-r border-border sm:flex">
          <div className="border-b border-border px-4 py-3 text-[13px] font-medium">
            Messages
          </div>
          <div className="flex-1 space-y-0.5 p-2">
            {chats.map((c) => (
              <div
                key={c.name}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2',
                  c.active && 'bg-nook-accent-subtle',
                )}
              >
                <Avatar name={c.name} status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">
                    {c.name}
                  </div>
                  <div className="truncate text-[11px] text-nook-text-muted">
                    {c.last}
                  </div>
                </div>
                {c.unread && (
                  <span className="grid size-4 place-items-center bg-primary text-[9px] font-semibold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Avatar name="Amina" status="ONLINE" />
            <div>
              <div className="text-[13px] font-medium leading-tight">Amina</div>
              <div className="text-[11px] text-nook-success">Online</div>
            </div>
          </div>
          <div className="flex-1 space-y-3.5 overflow-hidden p-4">
            <Bubble who="Amina">
              you around tonight? thinking of a quick match
            </Bubble>
            <Bubble who="Y" mine>
              yes! just finishing my project. 20 min?
            </Bubble>
            <Bubble who="Amina">
              perfect. here is the lobby I made
              <span className="mt-2 flex h-20 w-44 items-end bg-gradient-to-br from-primary/70 via-primary/30 to-nook-surface-raised p-2 text-[10px] text-foreground/80">
                lobby.png
              </span>
            </Bubble>
            <Bubble who="Y" mine>
              nice. see you there
            </Bubble>
          </div>
          <Composer placeholder="Write a message to Amina" />
        </div>
      </div>
    </Window>
  );
}

function PreviewPost({
  name,
  handle,
  time,
  children,
}: {
  name: string;
  handle: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-nook-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={name} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12px] font-semibold">{name}</div>
          <div className="truncate text-[11px] text-nook-text-muted">
            @{handle} · {time}
          </div>
        </div>
      </div>
      <div className="mt-2.5 text-[12px] leading-5">{children}</div>
    </div>
  );
}

/** Feed: post composer above post cards, one with a video. */
export function FeedPreview({ className }: { className?: string }) {
  return (
    <Window title="nook / feed" className={className}>
      <div className="h-[420px] space-y-3 overflow-hidden p-4">
        <div className="border border-border bg-nook-surface p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name="You" />
            <span className="truncate text-[12px] text-nook-text-muted">
              What’s on your mind?
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-nook-text-secondary">
              <IconPhoto size={14} className="text-primary" />
              Photo / video
            </span>
            <span className="bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
              Post
            </span>
          </div>
        </div>
        <PreviewPost name="Sara" handle="sara" time="2m">
          First run of the game night highlights. Who’s in for round two?
          <span className="relative mt-2.5 grid h-32 place-items-center bg-gradient-to-br from-primary/70 via-primary/30 to-nook-surface-raised">
            <span className="grid size-10 place-items-center rounded-full bg-background/90 text-primary">
              <IconPlayerPlayFilled size={16} />
            </span>
            <span className="absolute bottom-1.5 right-2 text-[10px] text-foreground/80">
              0:42
            </span>
          </span>
        </PreviewPost>
        <PreviewPost name="Yassine" handle="yassine" time="18m">
          Finally got the <b>build</b> green. Coffee is on me tomorrow.
        </PreviewPost>
      </div>
    </Window>
  );
}

/** Group channel with markdown, a file attachment and channel list. */
export function GroupPreview({ className }: { className?: string }) {
  const channels = ['general', 'projects', 'game-night'];
  return (
    <Window title="nook / Project crew" className={className}>
      <div className="flex h-[360px]">
        <div className="hidden w-40 shrink-0 border-r border-border bg-nook-surface p-3 sm:block">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-nook-text-muted">
            Channels
          </div>
          {channels.map((c) => (
            <div
              key={c}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 text-[12px]',
                c === 'projects'
                  ? 'bg-nook-accent-subtle text-foreground'
                  : 'text-nook-text-secondary',
              )}
            >
              <IconHash size={14} />
              {c}
            </div>
          ))}
          <div className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-nook-text-muted">
            Members
          </div>
          {(
            [
              ['Sara', 'ONLINE'],
              ['Yassine', 'AWAY'],
              ['Omar', 'OFFLINE'],
            ] as const
          ).map(([n, s]) => (
            <div
              key={n}
              className="flex items-center gap-2 px-2 py-1 text-[12px] text-nook-text-secondary"
            >
              <StatusDot status={s} className="size-2" />
              {n}
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-[13px] font-medium">
            <IconHash size={15} className="text-nook-text-muted" />
            projects
          </div>
          <div className="flex-1 space-y-3.5 overflow-hidden p-4">
            <Bubble who="Yassine">
              Pushed the new build, thoughts?
              <span className="mt-2 flex items-center gap-2.5 border border-border bg-background px-2.5 py-2">
                <IconFileTypePdf size={22} className="text-primary" />
                <span>
                  <span className="block text-[11px] font-medium leading-tight">
                    spec-v2.pdf
                  </span>
                  <span className="text-[10px] text-nook-text-muted">
                    PDF · 214 KB
                  </span>
                </span>
              </span>
            </Bubble>
            <Bubble who="Sara">
              Looks great. <b>Ship it</b> with{' '}
              <code className="bg-nook-surface-raised px-1 font-mono text-[11px]">
                v1.0
              </code>
            </Bubble>
            <Bubble who="Y" mine>
              on it. deploying now
            </Bubble>
          </div>
          <div className="flex items-center gap-1 border-t border-border px-3 pt-2 text-nook-text-muted">
            <IconBold size={14} />
            <IconCode size={14} />
            <span className="ml-auto text-[10px]">Markdown supported</span>
          </div>
          <Composer placeholder="Message #projects" />
        </div>
      </div>
    </Window>
  );
}

/** Profile card: banner, avatar, custom status, bio. */
export function ProfilePreview({ className }: { className?: string }) {
  return (
    <Window title="nook / profile / amina" className={className}>
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary via-primary/60 to-nook-surface-raised sm:h-32">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,rgb(255_255_255/60%)_1px,transparent_1.25px)] [background-size:14px_14px]" />
      </div>
      <div className="relative px-5 pb-5">
        <Avatar
          name="Amina"
          className="-mt-9 size-[72px] border-4 border-background text-2xl"
        />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold leading-tight">Amina</div>
            <div className="text-[12px] text-nook-text-muted">@amina</div>
          </div>
          <div className="flex gap-2 text-[12px]">
            <span className="border border-nook-control-border px-3 py-1.5">
              Message
            </span>
            <span className="bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              Add friend
            </span>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 border border-border bg-nook-surface px-2.5 py-1 text-[12px]">
          <span className="size-1.5 rounded-full bg-primary" />
          Building something small
        </div>
        <p className="mt-3 max-w-md text-[12px] leading-5 text-nook-text-secondary">
          Student, tinkerer, mediocre at chess but never tired of a rematch.
          Always up for a good side project.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Gaming', 'Open source', 'Design'].map((t) => (
            <span
              key={t}
              className="border border-border px-2 py-0.5 text-[11px] text-nook-text-secondary"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Window>
  );
}

/** Decorative Code Arena preview matching the live Play integration. */
export function CodeArenaPreview({ className }: { className?: string }) {
  return (
    <Window title="nook / play / code arena" className={className}>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center bg-primary/10 text-primary">
              <IconCode size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-foreground">
                1v1 · Even Ledger
              </p>
              <p className="text-[10px] text-nook-text-muted">Round 1 of 3</p>
            </div>
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
            08:42
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
          <div className="border border-border bg-nook-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-nook-text-muted">
              Problem
            </p>
            <p className="mt-2 text-[12px] font-medium text-foreground">
              Balance the ledger
            </p>
            <p className="mt-1 text-[11px] leading-5 text-nook-text-secondary">
              Count the values that meet the even-ledger rule, then return their
              total.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px]">
              <span className="text-nook-text-muted">Your score</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                640
              </span>
            </div>
          </div>
          <div className="min-w-0 border border-border bg-background p-3 font-mono text-[10px] leading-6 sm:text-[11px]">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-2 text-[10px] text-nook-text-muted">
              <span>solution.py</span>
              <span>Python</span>
            </div>
            <p>
              <span className="mr-3 text-nook-text-muted">1</span>
              <span className="text-primary">def</span>{' '}
              <span className="text-foreground">solve</span>(values):
            </p>
            <p>
              <span className="mr-3 text-nook-text-muted">2</span> total ={' '}
              <span className="text-primary">0</span>
            </p>
            <p>
              <span className="mr-3 text-nook-text-muted">3</span>{' '}
              <span className="text-primary">for</span> value{' '}
              <span className="text-primary">in</span> values:
            </p>
            <p>
              <span className="mr-3 text-nook-text-muted">4</span> total +=
              value
            </p>
            <p>
              <span className="mr-3 text-nook-text-muted">5</span>{' '}
              <span className="text-primary">return</span> total
            </p>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-[10px] text-nook-success">
              <IconCheck size={13} aria-hidden="true" /> Visible examples passed
            </div>
          </div>
        </div>
      </div>
    </Window>
  );
}
