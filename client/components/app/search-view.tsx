'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tabs } from '@base-ui/react/tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconUserPlus } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import { AccountAvatar } from '@/components/app/account-avatar';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useCurrentAccount } from '@/hooks/use-current-account';
import { accountApi, type PeopleSearchOptions } from '@/lib/accounts/client';
import { accountImageSource } from '@/lib/accounts/images';
import {
  friendshipQueryKey,
  socialApi,
  type Friendship,
} from '@/lib/social/client';

const resultQueryKey = (
  term: string,
  page: number,
  sort: string,
  filters: PeopleFilters,
) => ['accounts', 'discovery', term, page, sort, filters] as const;

// Each sort option maps to one backend sortBy + sortOrder pair.
const SORT_OPTIONS = {
  'username-asc': {
    label: 'Username (A–Z)',
    sortBy: 'username',
    sortOrder: 'asc',
  },
  'username-desc': {
    label: 'Username (Z–A)',
    sortBy: 'username',
    sortOrder: 'desc',
  },
  'displayName-asc': {
    label: 'Display name (A–Z)',
    sortBy: 'displayName',
    sortOrder: 'asc',
  },
  'createdAt-desc': {
    label: 'Newest members',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  'createdAt-asc': {
    label: 'Oldest members',
    sortBy: 'createdAt',
    sortOrder: 'asc',
  },
} as const satisfies Record<
  string,
  { label: string } & Required<
    Pick<PeopleSearchOptions, 'sortBy' | 'sortOrder'>
  >
>;
type SortKey = keyof typeof SORT_OPTIONS;

type PeopleFilters = {
  joinedWithin: '' | '7d' | '30d' | '365d';
  hasStatus: boolean;
  hasBio: boolean;
};
const DEFAULT_FILTERS: PeopleFilters = {
  joinedWithin: '',
  hasStatus: false,
  hasBio: false,
};

const selectClass =
  'h-11 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

function accountName(account: {
  displayName: string | null;
  username: string;
}) {
  return account.displayName?.trim() || account.username;
}

export function SearchView() {
  const { session, isRestoring, requestWithSession } = useAuth();
  const currentAccount = useCurrentAccount();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('people');
  const [sort, setSort] = useState<SortKey>('username-asc');
  const [filters, setFilters] = useState<PeopleFilters>(DEFAULT_FILTERS);
  const filtersActive =
    filters.joinedWithin !== '' || filters.hasStatus || filters.hasBio;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [term]);

  // Any change to sorting or filters starts again from the first page.
  function updateFilters(changes: Partial<PeopleFilters>) {
    setFilters((previous) => ({ ...previous, ...changes }));
    setPage(1);
  }

  const people = useQuery({
    queryKey: resultQueryKey(debouncedTerm, page, sort, filters),
    queryFn: () =>
      accountApi.searchPeople(debouncedTerm, page, 10, {
        sortBy: SORT_OPTIONS[sort].sortBy,
        sortOrder: SORT_OPTIONS[sort].sortOrder,
        joinedWithin: filters.joinedWithin || undefined,
        hasStatus: filters.hasStatus || undefined,
        hasBio: filters.hasBio || undefined,
      }),
    enabled: !isRestoring,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const friendshipKey = friendshipQueryKey(session?.user.id);
  const friendships = useQuery({
    queryKey: friendshipKey,
    queryFn: () =>
      requestWithSession((token) => socialApi.getFriendshipState(token)),
    enabled: !!session && !isRestoring,
    retry: false,
  });
  const friendshipAction = useMutation({
    mutationFn: ({
      action,
      targetId,
      friendshipId,
    }: {
      action: 'add' | 'accept' | 'decline' | 'cancel';
      targetId?: string;
      friendshipId?: string;
    }) =>
      requestWithSession((token) => {
        if (action === 'add') {
          if (!targetId)
            throw new Error('This profile is no longer available.');
          return socialApi.addFriend(targetId, token);
        }
        if (!friendshipId)
          throw new Error('This request is no longer available.');
        if (action === 'accept')
          return socialApi.acceptFriend(friendshipId, token);
        if (action === 'decline')
          return socialApi.declineFriend(friendshipId, token);
        return socialApi.removeFriendship(friendshipId, token);
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendshipKey }),
  });

  const users = (people.data?.users ?? []).filter(
    (user) => user.id !== session?.user.id,
  );
  const incoming = friendships.data?.incoming ?? [];
  const outgoing = friendships.data?.outgoing ?? [];
  const currentUserId = currentAccount.data?.id ?? session?.user.id;
  const mutationError =
    friendshipAction.error instanceof Error
      ? friendshipAction.error.message
      : 'Unable to update the friend request. Please try again.';

  function relationshipFor(userId: string) {
    if (friendships.data?.friends.some((friend) => friend.id === userId))
      return 'friends' as const;
    if (
      friendships.data?.outgoing.some(
        (request) => request.addresseeId === userId,
      )
    )
      return 'sent' as const;
    if (
      friendships.data?.incoming.some(
        (request) => request.requesterId === userId,
      )
    )
      return 'incoming' as const;
    return 'none' as const;
  }

  function respondToRequest(
    action: 'accept' | 'decline',
    friendship: Friendship,
  ) {
    friendshipAction.mutate({ action, friendshipId: friendship.id });
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:px-8"
      aria-labelledby="search-title"
    >
      <header className="mb-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Find your people
        </p>
        <h1
          id="search-title"
          className="mt-2 text-3xl font-semibold tracking-tight"
        >
          Search
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Discover Nook members and connect with people you know.
        </p>
      </header>

      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(String(value))}
        className="min-w-0"
      >
        <Tabs.List
          aria-label="Search sections"
          className="flex gap-1 border-b border-border"
        >
          <Tabs.Tab
            value="people"
            className="min-h-11 border-b-2 border-transparent px-4 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:border-primary data-[active]:font-medium data-[active]:text-foreground"
          >
            People
          </Tabs.Tab>
          <Tabs.Tab
            value="requests"
            className="min-h-11 border-b-2 border-transparent px-4 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:border-primary data-[active]:font-medium data-[active]:text-foreground"
          >
            Requests
            {session && incoming.length > 0 ? ` (${incoming.length})` : ''}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel
          value="people"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="mt-6 w-full">
            <label
              htmlFor="people-search"
              className="mb-2 block text-sm font-medium"
            >
              Search by name or username
            </label>
            <Input
              id="people-search"
              type="search"
              value={term}
              maxLength={100}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Try a name or @username"
              className="h-11 w-full"
              autoComplete="off"
            />
          </div>

          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
            <legend className="sr-only">Sort and filter people</legend>
            <div>
              <label
                htmlFor="people-sort"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Sort by
              </label>
              <select
                id="people-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortKey);
                  setPage(1);
                }}
                className={selectClass}
              >
                {Object.entries(SORT_OPTIONS).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="people-joined"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Joined
              </label>
              <select
                id="people-joined"
                value={filters.joinedWithin}
                onChange={(event) =>
                  updateFilters({
                    joinedWithin: event.target
                      .value as PeopleFilters['joinedWithin'],
                  })
                }
                className={selectClass}
              >
                <option value="">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="365d">Last year</option>
              </select>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.hasStatus}
                onChange={(event) =>
                  updateFilters({ hasStatus: event.target.checked })
                }
                className="size-4 accent-[var(--nook-accent)]"
              />
              Has a status
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.hasBio}
                onChange={(event) =>
                  updateFilters({ hasBio: event.target.checked })
                }
                className="size-4 accent-[var(--nook-accent)]"
              />
              Has a bio
            </label>
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={!filtersActive && sort === 'username-asc'}
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setSort('username-asc');
                setPage(1);
              }}
            >
              Reset
            </Button>
          </fieldset>

          {friendshipAction.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {mutationError}
            </p>
          )}
          {session && friendships.error && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <p role="alert" className="text-destructive">
                Friendship status could not be loaded.
              </p>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => friendships.refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {people.isPending && (
            <p role="status" className="mt-8 text-sm text-muted-foreground">
              Finding people…
            </p>
          )}
          {people.error && (
            <div className="mt-8 border border-border p-5">
              <p role="alert" className="text-sm text-destructive">
                Unable to load people. Please try again.
              </p>
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => people.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {people.isSuccess && users.length === 0 && (
            <p className="mt-8 border border-border px-5 py-10 text-center text-sm text-muted-foreground">
              {debouncedTerm || filtersActive
                ? 'No people matched these filters.'
                : 'No people to show yet.'}
            </p>
          )}

          {users.length > 0 && (
            <div className="mt-5 divide-y divide-border border-y border-border">
              {users.map((user) => {
                const relation = relationshipFor(user.id);
                const request =
                  relation === 'incoming'
                    ? incoming.find((item) => item.requesterId === user.id)
                    : undefined;
                const sentRequest =
                  relation === 'sent'
                    ? friendships.data?.outgoing.find(
                        (item) => item.addresseeId === user.id,
                      )
                    : undefined;
                const name = accountName(user);
                return (
                  <article
                    key={user.id}
                    className="flex flex-wrap items-center gap-4 py-4 sm:flex-nowrap"
                  >
                    <Link
                      href={`/profile/${encodeURIComponent(user.id)}`}
                      aria-label={`View ${name}'s profile`}
                      className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <AccountAvatar
                        source={accountImageSource(user.avatarUrl)}
                        seed={user.id}
                        label={`${name}'s avatar`}
                        size={48}
                        className="size-12 object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${encodeURIComponent(user.id)}`}
                        className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {name}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        @{user.username}
                      </p>
                      {user.statusText && (
                        <p className="mt-1 truncate text-sm text-foreground">
                          {user.statusText}
                        </p>
                      )}
                      {user.bio && (
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          <ReactMarkdown>{user.bio}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                      {!session ? (
                        <Link
                          href="/login"
                          className={cn(
                            buttonVariants({ variant: 'outline' }),
                            'min-h-11 w-full sm:w-auto',
                          )}
                        >
                          Log in to connect
                        </Link>
                      ) : relation === 'friends' ? (
                        <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground">
                          <IconCheck size={17} aria-hidden="true" /> Friends
                        </span>
                      ) : relation === 'sent' ? (
                        <Button
                          variant="outline"
                          className="min-h-11 w-full sm:w-auto"
                          onClick={() =>
                            sentRequest &&
                            friendshipAction.mutate({
                              action: 'cancel',
                              friendshipId: sentRequest.id,
                            })
                          }
                          disabled={friendshipAction.isPending || !sentRequest}
                        >
                          Cancel request
                        </Button>
                      ) : relation === 'incoming' && request ? (
                        <Button
                          variant="outline"
                          className="min-h-11 w-full sm:w-auto"
                          onClick={() => respondToRequest('accept', request)}
                          disabled={friendshipAction.isPending}
                        >
                          Accept request
                        </Button>
                      ) : (
                        <Button
                          className="min-h-11 w-full sm:w-auto"
                          onClick={() =>
                            friendshipAction.mutate({
                              action: 'add',
                              targetId: user.id,
                            })
                          }
                          disabled={
                            friendshipAction.isPending ||
                            friendships.isPending ||
                            friendships.isError ||
                            !currentUserId
                          }
                        >
                          <IconUserPlus size={17} aria-hidden="true" /> Add
                          friend
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {people.data && people.data.totalPages > 1 && (
            <nav
              aria-label="People search pages"
              className="mt-5 flex items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">
                Page {people.data.page} of {people.data.totalPages} ·{' '}
                {people.data.total} people
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={page <= 1 || people.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={page >= people.data.totalPages || people.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </Tabs.Panel>

        <Tabs.Panel
          value="requests"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {!session && !isRestoring && (
            <div className="mt-8 border border-border px-5 py-10 text-center">
              <h2 className="text-lg font-medium">Log in to see requests</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to manage friend requests sent to you.
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants(), 'mt-4 min-h-11')}
              >
                Log in
              </Link>
            </div>
          )}
          {session && friendships.isPending && (
            <p role="status" className="mt-8 text-sm text-muted-foreground">
              Loading requests…
            </p>
          )}
          {session && friendships.error && (
            <div className="mt-8 border border-border p-5">
              <p role="alert" className="text-sm text-destructive">
                Unable to load friend requests. Please try again.
              </p>
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => friendships.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {session && friendships.isSuccess && (
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <section aria-labelledby="incoming-requests-title">
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2
                    id="incoming-requests-title"
                    className="text-lg font-semibold"
                  >
                    Pending requests
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {incoming.length}
                  </span>
                </header>
                {incoming.length === 0 ? (
                  <p className="border border-border px-4 py-7 text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                ) : (
                  <div className="divide-y divide-border border-y border-border">
                    {incoming.map((friendship) => {
                      const requester = friendship.requester;
                      const name = requester
                        ? accountName(requester)
                        : 'Nook member';
                      return (
                        <article
                          key={friendship.id}
                          className="flex flex-wrap items-center gap-4 py-4"
                        >
                          <Link
                            href={`/profile/${encodeURIComponent(friendship.requesterId)}`}
                            aria-label={`View ${name}'s profile`}
                            className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <AccountAvatar
                              source={accountImageSource(
                                requester?.avatarUrl ?? null,
                              )}
                              seed={friendship.requesterId}
                              label={`${name}'s avatar`}
                              size={48}
                              className="size-12 object-cover"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/profile/${encodeURIComponent(friendship.requesterId)}`}
                              className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              {name}
                            </Link>
                            {requester && (
                              <p className="text-sm text-muted-foreground">
                                @{requester.username}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Wants to connect with you
                            </p>
                          </div>
                          <div className="flex w-full gap-2">
                            <Button
                              className="min-h-11 flex-1"
                              onClick={() =>
                                respondToRequest('accept', friendship)
                              }
                              disabled={friendshipAction.isPending}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-11 flex-1"
                              onClick={() =>
                                respondToRequest('decline', friendship)
                              }
                              disabled={friendshipAction.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section aria-labelledby="sent-requests-title">
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2
                    id="sent-requests-title"
                    className="text-lg font-semibold"
                  >
                    Sent requests
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {outgoing.length}
                  </span>
                </header>
                {outgoing.length === 0 ? (
                  <p className="border border-border px-4 py-7 text-sm text-muted-foreground">
                    No sent requests.
                  </p>
                ) : (
                  <div className="divide-y divide-border border-y border-border">
                    {outgoing.map((friendship) => {
                      const addressee = friendship.addressee;
                      const name = addressee
                        ? accountName(addressee)
                        : 'Nook member';
                      return (
                        <article
                          key={friendship.id}
                          className="flex items-center gap-4 py-4"
                        >
                          <Link
                            href={`/profile/${encodeURIComponent(friendship.addresseeId)}`}
                            aria-label={`View ${name}'s profile`}
                            className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <AccountAvatar
                              source={accountImageSource(
                                addressee?.avatarUrl ?? null,
                              )}
                              seed={friendship.addresseeId}
                              label={`${name}'s avatar`}
                              size={48}
                              className="size-12 object-cover"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/profile/${encodeURIComponent(friendship.addresseeId)}`}
                              className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              {name}
                            </Link>
                            {addressee && (
                              <p className="text-sm text-muted-foreground">
                                @{addressee.username}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Request awaiting response
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="min-h-11 shrink-0"
                            onClick={() =>
                              friendshipAction.mutate({
                                action: 'cancel',
                                friendshipId: friendship.id,
                              })
                            }
                            disabled={friendshipAction.isPending}
                          >
                            Cancel request
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
          {friendshipAction.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {mutationError}
            </p>
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}
