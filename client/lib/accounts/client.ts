import { AuthRequestError } from "@/lib/auth/client";

export type UserAccount = {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  statusText: string | null;
  statusIcon: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  hasDiscord: boolean;
  hasGithub: boolean;
};

export type PublicAccount = Pick<UserAccount,
  "id" | "username" | "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusText" | "statusIcon" | "createdAt"
>;

export type PublicAccountPage = {
  users: PublicAccount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AccountUpdate = Partial<Pick<UserAccount,
  "email" | "username" | "firstName" | "lastName" | "displayName" | "bio" | "statusText" | "statusIcon"
>>;

type ImageKind = "avatar" | "banner";

function parseAccount(value: unknown): UserAccount {
  const nullableFields = ["firstName", "lastName", "displayName", "avatarUrl", "bannerUrl", "bio", "statusText", "statusIcon", "emailVerifiedAt"] as const;
  if (typeof value !== "object" || value === null) {
    throw new AuthRequestError("Unable to load your account. Please try again.", 502);
  }
  const account = value as Record<string, unknown>;
  if (typeof account.id !== "string" || typeof account.email !== "string" || typeof account.username !== "string"
    || typeof account.createdAt !== "string" || typeof account.updatedAt !== "string"
    || typeof account.hasPassword !== "boolean" || typeof account.hasDiscord !== "boolean" || typeof account.hasGithub !== "boolean"
    || nullableFields.some(field => !(field in account) || (account[field] !== null && typeof account[field] !== "string"))) {
    throw new AuthRequestError("Unable to load your account. Please try again.", 502);
  }
  return account as UserAccount;
}

async function accountResponse(promise: Promise<unknown>) {
  return parseAccount(await promise);
}

function parsePublicAccount(value: unknown): PublicAccount {
  if (typeof value !== "object" || value === null) {
    throw new AuthRequestError("Unable to load this profile. Please try again.", 502);
  }
  const account = value as Record<string, unknown>;
  const nullableFields = ["displayName", "avatarUrl", "bannerUrl", "bio", "statusText", "statusIcon"] as const;
  if (typeof account.id !== "string" || typeof account.username !== "string" || typeof account.createdAt !== "string"
    || nullableFields.some(field => !(field in account) || (account[field] !== null && typeof account[field] !== "string"))) {
    throw new AuthRequestError("Unable to load this profile. Please try again.", 502);
  }
  return {
    id: account.id as string,
    username: account.username as string,
    displayName: account.displayName as string | null,
    avatarUrl: account.avatarUrl as string | null,
    bannerUrl: account.bannerUrl as string | null,
    bio: account.bio as string | null,
    statusText: account.statusText as string | null,
    statusIcon: account.statusIcon as string | null,
    createdAt: account.createdAt as string,
  };
}

async function publicAccountRequest(id: string): Promise<PublicAccount> {
  let response: Response;
  try {
    response = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new AuthRequestError("Unable to reach Nook. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    throw new AuthRequestError(response.status === 404 ? "This profile could not be found." : "Unable to load this profile. Please try again.", response.status);
  }
  return parsePublicAccount(await response.json());
}

async function publicAccountsRequest(path: string): Promise<PublicAccountPage> {
  let response: Response;
  try {
    response = await fetch(`/api/accounts${path}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new AuthRequestError("Unable to reach Nook. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    throw new AuthRequestError("Unable to find people. Please try again.", response.status);
  }
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || !Array.isArray((value as Record<string, unknown>).users)) {
    throw new AuthRequestError("Unable to load people. Please try again.", 502);
  }
  const page = value as Record<string, unknown>;
  if (!["total", "page", "limit", "totalPages"].every(field => typeof page[field] === "number")) {
    throw new AuthRequestError("Unable to load people. Please try again.", 502);
  }
  return {
    users: (page.users as unknown[]).map(parsePublicAccount),
    total: page.total as number,
    page: page.page as number,
    limit: page.limit as number,
    totalPages: page.totalPages as number,
  };
}

async function accountRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/accounts${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new AuthRequestError("Unable to reach Nook. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "message" in body) {
        const message = body.message;
        detail = Array.isArray(message) ? String(message[0] ?? "") : typeof message === "string" ? message : "";
      }
    } catch {
      // Fall through to a safe status-based message.
    }

    const message = response.status === 401 ? "Your session has expired. Please log in again."
      : response.status === 404 ? "Your account could not be found."
        : response.status === 409 ? "That email or username is already in use."
          : response.status === 403 ? "Your current password is incorrect."
          : response.status === 413 ? "That image is too large. Choose a smaller file."
            : response.status === 400 && detail ? detail
              : "Unable to complete that request. Please try again.";
    throw new AuthRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const accountApi = {
  getMe: (accessToken: string) => accountResponse(accountRequest<unknown>("/me", accessToken)),
  getPublic: publicAccountRequest,
  getPeople: (page: number, limit = 10) => publicAccountsRequest(`?page=${page}&limit=${limit}`),
  searchPeople: (username: string, page: number, limit = 10) => publicAccountsRequest(`/search?username=${encodeURIComponent(username)}&page=${page}&limit=${limit}`),
  updateMe: (accessToken: string, changes: AccountUpdate) => accountResponse(accountRequest<unknown>("/me", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  })),
  uploadImage: (accessToken: string, kind: ImageKind, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return accountResponse(accountRequest<unknown>(`/me/${kind}`, accessToken, { method: "PUT", body }));
  },
  removeImage: (accessToken: string, kind: ImageKind) =>
    accountRequest<void>(`/me/${kind}`, accessToken, { method: "DELETE" }),
  setPassword: (accessToken: string, newPassword: string) => accountRequest<void>("/me/password", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  }),
  changePassword: (accessToken: string, oldPassword: string, newPassword: string) => accountRequest<void>("/me/password", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPassword, newPassword }),
  }),
};
