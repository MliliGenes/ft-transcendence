// Types for the shared memory-only browser auth client.
// The implementation is dependency-free ESM in `./client.js`.

export interface AuthSnapshot {
  status: 'loading' | 'anonymous' | 'authenticated' | 'unavailable';
  profile: Record<string, unknown> | null;
  sessionGeneration: number;
  tokenRevision: number;
  logoutPending: boolean;
}

export type AuthStatus = AuthSnapshot['status'];

export interface BrowserAuthClientOptions {
  apiBase: string;
  fetchImpl?: typeof fetch;
  /** Web Locks (required): one origin-wide lock serializes session work. */
  locks: Pick<LockManager, 'request'>;
  /** BroadcastChannel for session-control (required). */
  channel: Pick<BroadcastChannel, 'postMessage' | 'addEventListener' | 'removeEventListener'>;
  clock?: { now(): number };
  /** Shared credential-free logout intent; defaults to browser localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Optional shared memory session (lets app facades share one session). */
  store?: {
    read(): { accessToken: string; sessionKey: string; sessionGeneration: number; tokenRevision: number } | null;
    generation(): number;
    replace(tokens: { accessToken: string }): unknown;
    rotate(tokens: { accessToken: string }, expected: unknown): unknown;
    clear(sessionKey?: string, reason?: string): void;
    subscribe(listener: (value: unknown, reason?: string) => void): () => void;
  };
}

export interface LogoutReceipt {
  serverConfirmed: boolean;
}

export interface AuthFetchOptions extends RequestInit {
  json?: unknown;
  /** Exactly one retry, safe (GET/HEAD) reads only, including after a 401 renewal.
   * Mutations never replay, even when this is true. Other renewed calls reject
   * with ApiError.code = 'RETRY_REQUIRED' so callers choose whether to retry. */
  retrySafeRead?: boolean;
  /** `false` skips the Bearer attach (cookie-only endpoints like refresh). */
  auth?: boolean;
  /** Serialize under the session lock (cookie-session mutations). */
  cookieSession?: boolean;
}

export interface BrowserAuthClient {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
  /** Force refresh never bypasses a pending browser logout. */
  restore(force?: boolean): Promise<AuthSnapshot>;
  login(mode: string, values: unknown): Promise<AuthSnapshot>;
  logout(): Promise<LogoutReceipt>;
  getAccessToken(): string | null;
  fetch(path: string, options?: AuthFetchOptions): Promise<unknown>;
  /** Invalidates pending work and removes listeners; it does not log out shared sessions. */
  dispose(): void;
}

export declare function createBrowserAuthClient(
  options: BrowserAuthClientOptions,
): BrowserAuthClient;

export declare class ApiError extends Error {
  status: number;
  messages: string[] | undefined;
  code: string;
  constructor(message: string, status?: number, messages?: string[], code?: string);
}
