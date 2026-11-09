"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { PostCard } from "@/components/app/feed/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { chatApi } from "@/lib/chat/client";

const PAGE_SIZE = 20;

/** The Posts tab on a profile: everything this user has posted to the feed. */
export function ProfilePosts({ userId, name, isOwner }: { userId: string; name: string; isOwner: boolean }) {
  const { session, isRestoring, requestWithSession } = useAuth();
  const viewerId = session?.user.id;

  const posts = useInfiniteQuery({
    queryKey: ["chat", "feed-posts", viewerId, userId],
    queryFn: ({ pageParam }) => requestWithSession(token => chatApi.feedPosts(userId, token, pageParam)),
    initialPageParam: undefined as string | undefined,
    // The API returns one extra row when more exist; the last row shown is the cursor.
    getNextPageParam: lastPage => lastPage.length > PAGE_SIZE ? lastPage[PAGE_SIZE - 1]?.id : undefined,
    enabled: Boolean(session) && !isRestoring,
    staleTime: 0,
    retry: false,
  });

  if (!isRestoring && !session) {
    return (
      <div className="px-5 py-14 text-center">
        <h2 className="text-lg font-medium">Log in to see {name}’s posts</h2>
        <Button render={<Link href="/login" />} className="mt-4 min-h-11 px-5">Log in</Button>
      </div>
    );
  }

  if (posts.isError) {
    return (
      <div role="alert" className="px-5 py-14 text-center">
        <h2 className="text-lg font-medium">We couldn’t load these posts</h2>
        <Button variant="outline" className="mt-4 min-h-11 px-5" onClick={() => void posts.refetch()}>Try again</Button>
      </div>
    );
  }

  if (isRestoring || posts.isPending) {
    return (
      <div role="status" aria-label="Loading posts" className="grid gap-4">
        {[0, 1].map(index => <Skeleton key={index} className="h-32 w-full" />)}
      </div>
    );
  }

  const items = posts.data.pages.flatMap(page => page.slice(0, PAGE_SIZE)).filter(post => !post.deletedAt);

  if (items.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <h2 className="text-lg font-medium">No posts yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">{isOwner ? "Share something on the feed and it will show up here." : `${name} hasn’t posted anything yet.`}</p>
        {isOwner && <Button render={<Link href="/feed" />} variant="outline" className="mt-4 min-h-11 px-5">Go to the feed</Button>}
      </div>
    );
  }

  return (
    <>
      <ol className="grid gap-4" aria-label={`${name}'s posts`}>
        {items.map(post => <li key={post.id}><PostCard post={post} own={post.authorId === viewerId} /></li>)}
      </ol>
      {posts.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="min-h-11 px-5" disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>{posts.isFetchingNextPage ? "Loading…" : "Load older posts"}</Button>
        </div>
      )}
    </>
  );
}
