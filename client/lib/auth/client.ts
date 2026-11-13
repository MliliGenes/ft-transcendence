export type AuthSession = {
  user: { id: string; email: string; username: string };
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type AuthenticatedRequest = <T>(send: (accessToken: string) => Promise<T>) => Promise<T>;

type ApiErrorBody = { message?: string | string[]; error?: string };

export class AuthRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new AuthRequestError("Unable to reach Nook. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await response.json() as ApiErrorBody;
    } catch {
      // Use a safe fallback if the service did not return JSON.
    }
    const detail = Array.isArray(body.message) ? body.message[0] : body.message;
    const message = response.status === 401
      ? path === "login" ? "Email or password is incorrect." : "Your session has expired. Please log in again."
      : response.status === 409
        ? path === "register" ? "That email or username is already in use."
          : path.endsWith("/link") ? "That provider is already connected to another Nook account."
            : "That account is already connected to another Nook account."
        : response.status === 400 && detail
          ? detail
          : "Unable to complete that request. Please try again.";
    throw new AuthRequestError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function post<T>(path: string, body?: object) {
  return request<T>(path, {
    method: "POST",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

export const authApi = {
  login: (email: string, password: string) => post<AuthSession>("login", { email, password }),
  register: (username: string, email: string, password: string) =>
    post<AuthSession>("register", { username, email, password }),
  refresh: () => post<AuthSession>("refresh"),
  logout: () => post<void>("logout"),
  requestPasswordReset: (email: string) => post<{ requested: boolean }>("password-reset/request", { email }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    post<{ confirmed: boolean }>("password-reset/confirm", { token, newPassword }),
  verifyEmail: (token: string) =>
    request<{ verified: boolean }>(`verify-email/${encodeURIComponent(token)}`),
  linkProvider: (provider: "discord" | "github", accessToken: string) =>
    request<{ authorizationUrl: string }>(`${provider}/link`, { method: "POST" }, accessToken),
  unlinkProvider: (provider: "discord" | "github", accessToken: string) =>
    request<void>(`${provider}/link`, { method: "DELETE" }, accessToken),
};
