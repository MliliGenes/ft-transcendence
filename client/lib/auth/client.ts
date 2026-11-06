export type AuthSession = {
  user: { id: string; email: string; username: string };
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

type ApiErrorBody = { message?: string | string[]; error?: string };

export class AuthRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AuthRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      ...init,
      credentials: "include",
      headers: { Accept: "application/json", ...init?.headers },
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
      ? "Email or password is incorrect."
      : response.status === 409
        ? "That email or username is already in use."
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
};
