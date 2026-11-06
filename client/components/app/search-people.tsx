"use client";

import { useMemo, useState } from "react";
import { IconCheck, IconSearch, IconUserPlus } from "@tabler/icons-react";
import { ProfileAvatar } from "@/components/app/profile-avatar";

const people = [
  { name: "Maya Tan", username: "@mayatan", bio: "Design, coffee, and calmer internet.", mutual: 12, initials: "MT", color: "bg-[#382820] text-[#f2c3a2]" },
  { name: "Noah Patel", username: "@noahpatel", bio: "Hiking, photography, and big plans.", mutual: 14, initials: "NP", color: "bg-[#24313a] text-[#b5d0e1]" },
  { name: "Liam Parker", username: "@liamparker", bio: "Building small things on the web.", mutual: 8, initials: "LP", color: "bg-[#34313d] text-[#cdc0e4]" },
  { name: "Grace Liu", username: "@graceliu", bio: "Products, people, and a happier web.", mutual: 10, initials: "GL", color: "bg-[#39312a] text-[#e8c49f]" },
  { name: "Sophie Kim", username: "@sophiekim", bio: "Films, food, and finding good spots.", mutual: 6, initials: "SK", color: "bg-[#2a3530] text-[#b8ddc3]" },
  { name: "Ethan Rivera", username: "@ethanrivera", bio: "Music, movement, and better days.", mutual: 9, initials: "ER", color: "bg-[#3b2d26] text-[#e7b894]" },
];

const tabs = ["People", "Suggested", "Requests"] as const;
type Tab = (typeof tabs)[number];

export function SearchPeople() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("People");
  const [requested, setRequested] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);

  const visiblePeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people.filter((person, index) => {
      const inTab = tab === "People" || (tab === "Suggested" ? index % 2 === 0 : index < 2);
      const matches = `${person.name} ${person.username} ${person.bio}`.toLowerCase().includes(normalizedQuery);
      return inTab && matches;
    });
  }, [query, tab]);

  return (
    <section aria-labelledby="search-title" className="mx-auto w-full max-w-[1400px] px-6 py-10 md:px-10 md:py-12 lg:px-14">
      <div className="mb-7">
        <h1 id="search-title" className="text-3xl font-semibold tracking-[-0.025em] md:text-4xl">Find your people</h1>
        <p className="mt-2 text-sm leading-6 text-nook-text-secondary md:text-base">Discover people with similar interests, hobbies, and communities.</p>
      </div>

      <label className="flex h-14 items-center gap-3 border border-border bg-nook-surface px-4 focus-within:border-nook-control-border">
        <IconSearch size={21} stroke={1.75} aria-hidden="true" className="shrink-0 text-nook-text-secondary" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          type="search"
          aria-label="Search people"
          placeholder="Search by name, username, or interest..."
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-nook-text-muted md:text-base"
        />
        <kbd className="hidden border border-border px-2 py-1 text-xs text-nook-text-muted sm:inline">⌘ K</kbd>
      </label>

      <div role="group" aria-label="Filter people" className="mt-7 flex gap-8 border-b border-border">
        {tabs.map(item => (
          <button
            key={item}
            type="button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
            className={`relative flex min-h-12 items-center gap-2 text-sm transition-colors ${tab === item ? "font-medium text-foreground after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-primary" : "text-nook-text-secondary hover:text-foreground"}`}
          >
            {item}
            {item === "Requests" && <span className="flex size-5 items-center justify-center bg-primary text-xs font-medium text-primary-foreground">{Math.max(0, 2 - accepted.length)}</span>}
          </button>
        ))}
      </div>

      <div id="people-results" aria-live="polite" className="grid gap-x-10 md:grid-cols-2 md:gap-x-12">
        {visiblePeople.map(person => {
          const isRequest = tab === "Requests";
          const isAccepted = accepted.includes(person.username);
          const isRequested = requested.includes(person.username);
          return (
            <article key={person.username} className="flex min-w-0 items-center gap-4 border-b border-border py-6 md:gap-5 md:py-7">
              <ProfileAvatar username={person.username.slice(1)} size={76} className="size-14 shrink-0 md:size-[76px]" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h2 className="truncate text-sm font-semibold md:text-base">{person.name}</h2>
                  <span className="truncate text-xs text-nook-text-muted">{person.username}</span>
                </div>
                <p className="mt-1 truncate text-xs text-nook-text-secondary md:text-sm">{person.bio}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-nook-text-muted">
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    {person.initials.slice(0, 3).split("").map((letter, index) => <span key={`${letter}-${index}`} className="flex size-5 items-center justify-center rounded-full border border-background bg-nook-surface-raised text-[9px] text-nook-text-secondary">{letter}</span>)}
                  </span>
                  <span>{person.mutual} mutual friends</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isAccepted}
                onClick={() => isRequest ? setAccepted(current => [...current, person.username]) : setRequested(current => [...current, person.username])}
                aria-label={isRequest ? `${isAccepted ? "Accepted" : "Accept request from"} ${person.name}` : `${isRequested ? "Request sent to" : "Add"} ${person.name}`}
                className={`flex h-10 shrink-0 items-center justify-center gap-2 border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3 md:text-sm ${isAccepted || isRequested ? "border-border bg-nook-surface text-nook-text-secondary" : "border-border hover:bg-nook-surface-hover"}`}
              >
                {isRequest ? <IconCheck size={17} stroke={1.75} aria-hidden="true" /> : <IconUserPlus size={17} stroke={1.75} aria-hidden="true" />}
                <span className="hidden sm:inline">{isAccepted ? "Accepted" : isRequest ? "Accept" : isRequested ? "Requested" : "Add friend"}</span>
              </button>
            </article>
          );
        })}
        {visiblePeople.length === 0 && <p className="col-span-full py-12 text-center text-sm text-nook-text-muted">No people match that search.</p>}
      </div>
      <p className="sr-only" role="status">Showing {visiblePeople.length} {visiblePeople.length === 1 ? "person" : "people"}.</p>
    </section>
  );
}
