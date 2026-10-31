import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserAuthClient, type AuthSnapshot, type BrowserAuthClient } from "browser-auth";
import { ArenaPage } from "./components/ArenaPage.js";
import { MockArenaTransport } from "./arena/mock.js";
import { SocketArenaTransport } from "./arena/socket.js";
import { LobbyClient } from "./arena/lobby.js";
import type { MatchMode } from "./arena/types.js";

const LobbyPage = lazy(() =>
  import("./components/LobbyPage.js").then(({ LobbyPage: page }) => ({ default: page })),
);

export const GAME_URL = (import.meta.env.VITE_GAME_URL as string | undefined)?.trim();
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "");
const SOCKET_BASE = GAME_URL || (typeof window !== "undefined" ? window.location.origin : "");

interface ActiveClients {
  transport: SocketArenaTransport | null;
  lobby: LobbyClient | null;
}

function LiveApp({ baseUrl, userId, matchId }: { baseUrl: string; userId: string; matchId: string }) {
  const transport = useMemo(() => new SocketArenaTransport({ baseUrl, userId, matchId }), [baseUrl, userId, matchId]);
  const [state, setState] = useState<"connecting" | "ready" | "failed">("connecting");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaTransport?: SocketArenaTransport }).__arenaTransport = transport;
    }
    transport
      .connect()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "connect failed");
          setState("failed");
        }
      });
    return () => {
      cancelled = true;
      transport.disconnect();
    };
  }, [transport]);
  if (state === "connecting") return <p className="p-4 font-mono text-sm">Connecting to match…</p>;
  if (state === "failed") return <p role="alert" className="p-4 font-mono text-sm text-red-700">Connection failed: {error}</p>;
  return <ArenaPage transport={transport} />;
}

/** Auth is created and disposed by the same effect, including StrictMode restarts. */
function PlayApp({ initialMatchId }: { initialMatchId: string }) {
  const [auth, setAuth] = useState<BrowserAuthClient | null>(null);
  useEffect(() => {
    const channel = new BroadcastChannel("fieldnote-auth-session");
    const client = createBrowserAuthClient({ apiBase: API_BASE, locks: navigator.locks, channel });
    setAuth(client);
    return () => { client.dispose(); channel.close(); };
  }, []);
  return auth ? <PlaySession auth={auth} initialMatchId={initialMatchId} /> : <p className="p-4 font-mono text-sm">Restoring session…</p>;
}

function resolveSessionUserId(snapshot: AuthSnapshot, devUser: string | null): string | null {
  const profileId = snapshot.profile?.id;
  const hasProfile = typeof profileId === "string" && profileId.length > 0;
  if (hasProfile && (snapshot.status === "authenticated" || snapshot.status === "unavailable")) {
    return profileId;
  }
  return snapshot.status !== "loading" ? devUser : null;
}

function isIdentityReplaced(
  previous: { id: string; generation: number } | null,
  next: AuthSnapshot
): boolean {
  if (!previous) return false;
  const id = next.profile?.id;
  return next.sessionGeneration !== previous.generation || (typeof id === "string" && id !== previous.id);
}

function createSessionTransport(
  auth: BrowserAuthClient,
  userId: string,
  matchId: string,
  devUser: string | null
): SocketArenaTransport {
  if (import.meta.env.DEV && devUser === userId && !auth.getAccessToken()) {
    return new SocketArenaTransport({ baseUrl: SOCKET_BASE, userId, matchId });
  }
  return new SocketArenaTransport({
    apiBase: API_BASE,
    socketBase: SOCKET_BASE,
    matchId,
    getAccessToken: () => auth.getAccessToken(),
    onAuthExpired: () => auth.restore(true),
  });
}

function createSessionLobby(
  auth: BrowserAuthClient,
  userId: string,
  devUser: string | null
): LobbyClient {
  if (import.meta.env.DEV && devUser === userId && !auth.getAccessToken()) {
    return new LobbyClient(SOCKET_BASE, userId);
  }
  return new LobbyClient({
    apiBase: API_BASE,
    socketBase: SOCKET_BASE,
    getAccessToken: () => auth.getAccessToken(),
    onAuthExpired: () => auth.restore(true),
  });
}

function clearMatchSearchParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("match");
  window.history.replaceState({}, "", url);
}

function recordFoundMatch(id: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("match", id);
  window.history.pushState({}, "", url);
}

function AuthRequiredView({
  status,
  onRetry,
}: {
  status: AuthSnapshot["status"];
  onRetry: () => void;
}) {
  const message = status === "unavailable"
    ? "Session unavailable. Please try again."
    : "Sign in to play.";
  return (
    <main className="p-4">
      <p role={status === "unavailable" ? "alert" : undefined} className="font-mono text-sm">
        {message}
      </p>
      <button
        type="button"
        className="mt-2 rounded border px-2 py-1 font-mono text-xs"
        onClick={onRetry}
      >
        Try again
      </button>
    </main>
  );
}

function ActiveMatchView({
  transport,
  matchKey,
  onAuthSignal,
}: {
  transport: SocketArenaTransport;
  matchKey: string;
  onAuthSignal: (listener: () => void) => () => void;
}) {
  const [state, setState] = useState<"connecting" | "ready" | "failed">("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (window as unknown as { __arenaTransport?: SocketArenaTransport }).__arenaTransport = transport;
    setState("connecting");
    void transport
      .connect()
      .then(() => {
        if (active) setState("ready");
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "connect failed");
          setState("failed");
        }
      });
    return () => {
      active = false;
      transport.disconnect();
      const browser = window as unknown as { __arenaTransport?: SocketArenaTransport };
      if (browser.__arenaTransport === transport) delete browser.__arenaTransport;
    };
  }, [transport]);

  if (state === "connecting") return <p className="p-4 font-mono text-sm">Connecting to match…</p>;
  if (state === "failed") return <p role="alert" className="p-4 font-mono text-sm text-red-700">Connection failed: {error}</p>;
  return <ArenaPage key={matchKey} transport={transport} onAuthSignal={onAuthSignal} />;
}

function handleTokenRotation(
  next: AuthSnapshot,
  previous: { id: string; generation: number } | null,
  clients: React.MutableRefObject<ActiveClients>,
  lastRevision: number
): void {
  if (previous && next.sessionGeneration === previous.generation && next.tokenRevision !== lastRevision) {
    void clients.current.transport?.renewSocket().catch(() => {});
    void clients.current.lobby?.renewSocket().catch(() => {});
  }
}

function handleAuthSnapshotUpdate(
  next: AuthSnapshot,
  identity: React.MutableRefObject<{ id: string; generation: number } | null>,
  clients: React.MutableRefObject<ActiveClients>,
  lastRevision: number,
  onSessionReplaced: () => void
): number {
  const previous = identity.current;
  const id = next.profile?.id;
  const replaced = isIdentityReplaced(previous, next);
  if (replaced) {
    clients.current.transport?.disconnect();
    clients.current.lobby?.disconnect();
    identity.current = null;
    onSessionReplaced();
  } else {
    handleTokenRotation(next, previous, clients, lastRevision);
  }
  if (next.status === "authenticated" && typeof id === "string" && id) {
    identity.current = { id, generation: next.sessionGeneration };
  }
  return next.tokenRevision;
}

function useAuthSession(auth: BrowserAuthClient, onSessionReplaced: () => void) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() => auth.getSnapshot());
  const identity = useRef<{ id: string; generation: number } | null>(null);
  const clients = useRef<ActiveClients>({ transport: null, lobby: null });

  useEffect(() => {
    let active = true;
    let lastRevision = auth.getSnapshot().tokenRevision;
    const consume = (next: AuthSnapshot) => {
      if (!active) return;
      lastRevision = handleAuthSnapshotUpdate(next, identity, clients, lastRevision, onSessionReplaced);
      setSnapshot(next);
    };
    const unsubscribe = auth.subscribe(consume);
    consume(auth.getSnapshot());
    void auth.restore().then(consume).catch(() => { if (active) consume(auth.getSnapshot()); });
    return () => { active = false; unsubscribe(); };
  }, [auth, onSessionReplaced]);

  return { snapshot, clients, generation: snapshot.sessionGeneration };
}

function AuthenticatedPlayView({
  auth,
  userId,
  matchId,
  generation,
  onMatchFound,
  clients,
}: {
  auth: BrowserAuthClient;
  userId: string;
  matchId: string;
  generation: number;
  onMatchFound: (id: string) => void;
  clients: React.MutableRefObject<ActiveClients>;
}) {
  const devUser = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("user") : null;
  const transport = useMemo(() => {
    if (!matchId) return null;
    return createSessionTransport(auth, userId, matchId, devUser);
  }, [auth, userId, matchId, devUser]);

  const lobby = useMemo(() => {
    return createSessionLobby(auth, userId, devUser);
  }, [auth, userId, devUser]);

  clients.current = { transport, lobby };
  useEffect(() => () => lobby.disconnect(), [lobby]);

  const subscribeRenewal = useCallback((listener: () => void) => {
    let last = auth.getSnapshot().tokenRevision;
    return auth.subscribe((next) => {
      if (next.sessionGeneration === generation && next.tokenRevision !== last) listener();
      last = next.tokenRevision;
    });
  }, [auth, generation]);

  if (!matchId || !transport) {
    return (
      <LobbyPage
        key={`${generation}:${userId}`}
        client={lobby}
        userId={userId}
        initialMode="1v1"
        onMatchFound={onMatchFound}
      />
    );
  }

  return (
    <ActiveMatchView
      transport={transport}
      matchKey={`${generation}:${userId}:${matchId}`}
      onAuthSignal={subscribeRenewal}
    />
  );
}

function PlaySession({ auth, initialMatchId }: { auth: BrowserAuthClient; initialMatchId: string }) {
  const [matchId, setMatchId] = useState(initialMatchId);
  const handleSessionReplaced = useCallback(() => {
    setMatchId("");
    clearMatchSearchParam();
  }, []);

  const { snapshot, clients, generation } = useAuthSession(auth, handleSessionReplaced);
  const devUser = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("user") : null;
  const userId = resolveSessionUserId(snapshot, devUser);

  const onMatchFound = useCallback((id: string) => {
    setMatchId(id);
    recordFoundMatch(id);
  }, []);

  if (snapshot.status === "loading") return <p className="p-4 font-mono text-sm">Restoring session…</p>;
  if (!userId) {
    return <AuthRequiredView status={snapshot.status} onRetry={() => void auth.restore().catch(() => {})} />;
  }

  return (
    <AuthenticatedPlayView
      auth={auth}
      userId={userId}
      matchId={matchId}
      generation={generation}
      onMatchFound={onMatchFound}
      clients={clients}
    />
  );
}

function isPlayPath(pathname: string): boolean {
  return !import.meta.env.DEV || pathname === "/play/" || pathname === "/play";
}

function updateMatchUrl(mId: string): void {
  if (typeof window === "undefined") return;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("match", mId);
  window.history.pushState({}, "", nextUrl.toString());
}

function DevLiveSession({
  gameUrl,
  userId,
  initialMatchId,
}: {
  gameUrl: string;
  userId: string;
  initialMatchId: string;
}) {
  const [liveMatchId, setLiveMatchId] = useState<string>(initialMatchId);

  if (liveMatchId) {
    return <LiveApp baseUrl={gameUrl} userId={userId} matchId={liveMatchId} />;
  }

  const lobbyClient = new LobbyClient(gameUrl, userId);
  return (
    <LobbyPage
      client={lobbyClient}
      userId={userId}
      initialMode="1v1"
      onMatchFound={(mId) => {
        setLiveMatchId(mId);
        updateMatchUrl(mId);
      }}
    />
  );
}

function DevMockSession() {
  const [mode, setMode] = useState<MatchMode>("1v1");
  const transport = useMemo(() => new MockArenaTransport(mode), [mode]);

  return (
    <div>
      <div className="flex gap-2 border-b border-neutral-200 bg-white px-4 py-1" role="group" aria-label="Mode (mock)">
        {(["1v1", "2v2"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            className={`rounded px-2 py-1 font-mono text-xs ${mode === m ? "bg-teal-700 text-white" : "border border-neutral-300"}`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <ArenaPage transport={transport} />
    </div>
  );
}

function AppContent() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const paramMatchId = params.get("match") ?? "";

  if (isPlayPath(pathname)) {
    return <PlayApp initialMatchId={paramMatchId} />;
  }

  if (import.meta.env.DEV && params.get("live") === "1") {
    if (!GAME_URL) {
      return <p role="alert" className="p-4 font-mono text-sm">Live mode requested but VITE_GAME_URL is not configured.</p>;
    }
    const userId = params.get("user") ?? "user-a";
    return <DevLiveSession gameUrl={GAME_URL} userId={userId} initialMatchId={paramMatchId} />;
  }

  return <DevMockSession />;
}

export function App() {
  return (
    <Suspense
      fallback={
        <p className="p-4 font-mono text-sm" role="status">
          Loading Code Arena…
        </p>
      }
    >
      <AppContent />
    </Suspense>
  );
}
