import { AuthRequestError } from "@/lib/auth/client";
import type { PublicAccount } from "@/lib/accounts/client";

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  requester?: Pick<PublicAccount, "id" | "username" | "displayName" | "avatarUrl">;
  addressee?: Pick<PublicAccount, "id" | "username" | "displayName" | "avatarUrl">;
};

export type FriendshipState = {
  friends: Pick<PublicAccount, "id" | "username" | "displayName" | "avatarUrl" | "bannerUrl">[];
  incoming: Friendship[];
  outgoing: Friendship[];
};

export const friendshipQueryKey = (userId?: string) => ["social", "friendships", userId] as const;

async function request<T>(path: string, accessToken: string, method = "GET"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/social/${path}`, {
      method,
      credentials: "include",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    throw new AuthRequestError("Unable to reach Nook. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    throw new AuthRequestError(response.status === 409 ? "A friend request or friendship already exists." : "Unable to update this friendship. Please try again.", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const socialApi = {
  getFriendshipState: async (accessToken: string): Promise<FriendshipState> => {
    const [friends, incoming, outgoing] = await Promise.all([
      request<FriendshipState["friends"]>("friendships", accessToken),
      request<Friendship[]>("friendships/requests", accessToken),
      request<Friendship[]>("friendships/sent", accessToken),
    ]);
    return { friends, incoming, outgoing };
  },
  addFriend: (id: string, accessToken: string) => request<Friendship>(`friendships/${encodeURIComponent(id)}`, accessToken, "POST"),
  acceptFriend: (id: string, accessToken: string) => request<Friendship>(`friendships/${encodeURIComponent(id)}/accept`, accessToken, "PATCH"),
  declineFriend: (id: string, accessToken: string) => request<Friendship>(`friendships/${encodeURIComponent(id)}/reject`, accessToken, "PATCH"),
  removeFriendship: (id: string, accessToken: string) => request<Friendship>(`friendships/${encodeURIComponent(id)}`, accessToken, "DELETE"),
};
