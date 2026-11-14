'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { IconMessageCircle } from '@tabler/icons-react';
import { io } from 'socket.io-client';
import { useAuth } from '@/components/auth/auth-provider';
import { FeedComposer } from '@/components/app/feed/feed-composer';
import { PostCard } from '@/components/app/feed/post-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { chatApi, type ChatMessage } from '@/lib/chat/client';

const feedKey = (userId?: string) => ['chat', 'feed', userId] as const;
// Same key shape as the chat workspace, so both views share one cache entry.
const messagesKey = (userId: string | undefined, channelId: string) =>
  ['chat', 'messages', userId, channelId] as const;

function isPost(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === 'string' &&
    typeof message.conversationId === 'string' &&
    typeof message.createdAt === 'string' &&
    typeof message.clientRequestId === 'string' &&
    typeof message.version === 'number' &&
    Array.isArray(message.attachments) &&
    Boolean(message.author && typeof message.author.id === 'string')
  );
}

function PostSkeleton() {
  return (
    <div role="status" aria-label="Loading posts" className="grid gap-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function FeedView() {
  const { session, isRestoring, requestWithSession, refreshSession } =
    useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const accessToken = session?.accessToken;
  const expiresIn = session?.expiresIn;
  const ready = Boolean(session) && !isRestoring;
  const [live, setLive] = useState(false);

  const feed = useQuery({
    queryKey: feedKey(userId),
    queryFn: () => requestWithSession((token) => chatApi.feed(token)),
    enabled: ready,
    retry: false,
    staleTime: Infinity,
  });
  const channelId = feed.data?.channelId;

  const history = useInfiniteQuery({
    queryKey: messagesKey(userId, channelId ?? 'none'),
    queryFn: ({ pageParam }) =>
      requestWithSession((token) =>
        chatApi.messages(channelId!, token, pageParam),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length >= 51 ? lastPage[lastPage.length - 2]?.id : undefined,
    enabled: ready && Boolean(channelId),
    refetchInterval: channelId ? (live ? 60000 : 8000) : false,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Live updates: new posts arrive over the chat socket and are merged into the cache.
  useEffect(() => {
    if (
      !userId ||
      !accessToken ||
      expiresIn === undefined ||
      !channelId ||
      isRestoring
    )
      return;
    const socket = io(`${window.location.origin}/chat`, {
      path: '/api/chat/socket.io/',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', (error: Error) => {
      setLive(false);
      if (/unauthorized/i.test(error.message))
        refreshSession().catch(() => socket.disconnect());
    });
    socket.on('message:created', (payload: unknown) => {
      if (!isPost(payload) || payload.conversationId !== channelId) return;
      queryClient.setQueryData<InfiniteData<ChatMessage[]>>(
        messagesKey(userId, channelId),
        (previous) => {
          if (!previous) return previous;
          let found = false;
          const pages = previous.pages.map((page) =>
            page.map((item) => {
              if (
                item.id !== payload.id &&
                item.clientRequestId !== payload.clientRequestId
              )
                return item;
              found = true;
              return item.version > payload.version ? item : payload;
            }),
          );
          if (!found)
            pages[0] = [payload, ...pages[0]].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            );
          return { ...previous, pages };
        },
      );
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setLive(false);
    };
  }, [
    userId,
    accessToken,
    expiresIn,
    channelId,
    isRestoring,
    queryClient,
    refreshSession,
  ]);

  const posts = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const page of history.data?.pages ?? [])
      for (const message of page.slice(0, 50)) {
        if (message.deletedAt) continue;
        if (
          !byId.has(message.id) ||
          (byId.get(message.id)?.version ?? 0) < message.version
        )
          byId.set(message.id, message);
      }
    return [...byId.values()].sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  }, [history.data]);

  if (!isRestoring && !session) {
    return (
      <section className="grid flex-1 place-items-center p-6">
        <div className="max-w-sm bg-card p-8 text-center">
          <IconMessageCircle
            className="mx-auto size-8 text-primary"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-xl font-semibold">
            See what everyone is sharing
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in to read and post to the Nook feed.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants(), 'mt-5 min-h-11 px-5')}
          >
            Log in
          </Link>
        </div>
      </section>
    );
  }

  const failed = feed.isError || history.isError;
  const loading =
    isRestoring || feed.isPending || (Boolean(channelId) && history.isPending);

  return (
    <section
      aria-labelledby="feed-title"
      className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 md:pt-10"
    >
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1
            id="feed-title"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Feed
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything everyone is sharing on Nook.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${live ? 'bg-nook-success' : 'bg-muted-foreground/50'}`}
          />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
      </header>

      {channelId && (
        <div className="mb-5">
          <FeedComposer
            channelId={channelId}
            onPosted={() => {
              void queryClient.invalidateQueries({
                queryKey: messagesKey(userId, channelId),
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {failed ? (
        <div
          role="alert"
          className="border border-border bg-card p-6 text-center"
        >
          <p className="text-sm">We couldn’t load the feed.</p>
          <Button
            variant="outline"
            className="mt-4 min-h-11 px-5"
            onClick={() => {
              void feed.refetch();
              void history.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : loading ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-border bg-card/50 p-10 text-center">
          <h2 className="text-lg font-medium">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Be the first to post something.
          </p>
        </div>
      ) : (
        <>
          <ol className="grid gap-4" aria-label="Posts">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} own={post.authorId === userId} />
              </li>
            ))}
          </ol>
          {history.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                className="min-h-11 px-5"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                {history.isFetchingNextPage ? 'Loading…' : 'Load older posts'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
