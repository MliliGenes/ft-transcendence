export type AccountProfile = {
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
  role: string;
  hasPassword: boolean;
  hasDiscord: boolean;
  hasGithub: boolean;
};

export type UpdateAccount = Partial<Pick<AccountProfile, "username" | "email" | "firstName" | "lastName" | "displayName" | "bio" | "statusText" | "statusIcon">>;
export type ImageKind = "avatar" | "banner";

export function profileName(profile: Pick<AccountProfile, "username" | "displayName" | "firstName" | "lastName">) {
  return profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username;
}

export function profileImageUrl(profile: Pick<AccountProfile, "id" | "avatarUrl" | "bannerUrl" | "updatedAt">, kind: ImageKind) {
  const url = profile[kind === "avatar" ? "avatarUrl" : "bannerUrl"];
  if (!url) return undefined;
  if (url === `/accounts/${profile.id}/${kind}`) return `/api${url}?v=${encodeURIComponent(profile.updatedAt)}`;
  // OAuth avatars may be hosted by the identity provider.
  return url.startsWith("https://") ? url : undefined;
}

export class AccountRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AccountRequestError";
  }
}

async function requestAccount<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/accounts/${path}`, {
      ...init,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new AccountRequestError("Unable to reach your profile. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    let detail: string | string[] | undefined;
    try {
      detail = (await response.json() as { message?: string | string[] }).message;
    } catch {
      // Use a safe fallback when the service does not return JSON.
    }
    const message = response.status === 401
      ? "Your session expired. Log in again to continue."
      : response.status === 404
        ? "Your profile could not be found."
      : response.status === 409
        ? "That username or email is already in use."
        : response.status === 400 && detail
          ? Array.isArray(detail) ? detail[0] : detail
          : response.status === 413
            ? "That image is too large. Choose a smaller file."
            : "Unable to load or update your profile. Please try again.";
    throw new AccountRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const accountApi = {
  getMe: (token: string) => requestAccount<AccountProfile>("me", token),
  updateMe: (token: string, update: UpdateAccount) => requestAccount<AccountProfile>("me", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  }),
  uploadAvatar: (token: string, file: File) => uploadImage("me/avatar", token, file),
  uploadBanner: (token: string, file: File) => uploadImage("me/banner", token, file),
  removeImage: (token: string, kind: ImageKind) => requestAccount<void>(`me/${kind}`, token, { method: "DELETE" }),
};

function uploadImage(path: string, token: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return requestAccount<AccountProfile>(path, token, { method: "PUT", body: form });
}
