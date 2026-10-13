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

function PlaySession({ auth, initialMatchId }: { auth: BrowserAuthClient; initialMatchId: string }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() => auth.getSnapshot());
  const [matchId, setMatchId] = useState(initialMatchId);
  const identity = useRef<{ id: string; generation: number } | null>(null);
  const clients = useRef<{ transport: SocketArenaTransport | null; lobby: LobbyClient | null }>({ transport: null, lobby: null });
  const devUser = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("user") : null;
  const profileId = snapshot.profile?.id;
  const userId = typeof profileId === "string" && profileId && (snapshot.status === "authenticated" || snapshot.status === "unavailable")
    ? profileId : snapshot.status !== "loading" ? devUser : null;
  const generation = snapshot.sessionGeneration;

  useEffect(() => {
    let active = true;
    let lastRevision = auth.getSnapshot().tokenRevision;
    const consume = (next: AuthSnapshot) => {
      if (!active) return;
      const previous = identity.current;
      const id = next.profile?.id;
      const replaced = previous && (next.sessionGeneration !== previous.generation || (typeof id === "string" && id !== previous.id));
      if (replaced) {
        // Close immediately: async commands cannot cross the identity boundary.
        clients.current.transport?.disconnect();
        clients.current.lobby?.disconnect();
        identity.current = null;
        setMatchId("");
        const url = new URL(window.location.href);
        url.searchParams.delete("match");
        window.history.replaceState({}, "", url);
      }
      if (next.status === "authenticated" && typeof id === "string" && id) {
        identity.current = { id, generation: next.sessionGeneration };
      }
      if (!replaced && previous && next.sessionGeneration === previous.generation && next.tokenRevision !== lastRevision) {
        void clients.current.transport?.renewSocket().catch(() => {});
        void clients.current.lobby?.renewSocket().catch(() => {});
      }
      lastRevision = next.tokenRevision;
      setSnapshot(next);
    };
    const unsubscribe = auth.subscribe(consume);
    consume(auth.getSnapshot());
    void auth.restore().then(consume).catch(() => { if (active) consume(auth.getSnapshot()); });
    return () => { active = false; unsubscribe(); };
  }, [auth]);

  const transport = useMemo(() => {
    if (!userId || !matchId) return null;
    if (import.meta.env.DEV && devUser === userId && !auth.getAccessToken()) {
      return new SocketArenaTransport({ baseUrl: SOCKET_BASE, userId, matchId });
    }
    return new SocketArenaTransport({ apiBase: API_BASE, socketBase: SOCKET_BASE, matchId,
      getAccessToken: () => auth.getAccessToken(), onAuthExpired: () => auth.restore(true) });
  }, [auth, userId, generation, matchId, devUser]);
  const lobby = useMemo(() => {
    if (!userId) return null;
    if (import.meta.env.DEV && devUser === userId && !auth.getAccessToken()) return new LobbyClient(SOCKET_BASE, userId);
    return new LobbyClient({ apiBase: API_BASE, socketBase: SOCKET_BASE,
      getAccessToken: () => auth.getAccessToken(), onAuthExpired: () => auth.restore(true) });
  }, [auth, userId, generation, devUser]);
  clients.current = { transport, lobby };
  useEffect(() => () => lobby?.disconnect(), [lobby]);

  const subscribeRenewal = useCallback((listener: () => void) => {
    let last = auth.getSnapshot().tokenRevision;
    return auth.subscribe((next) => {
      if (next.sessionGeneration === generation && next.tokenRevision !== last) listener();
      last = next.tokenRevision;
    });
  }, [auth, generation]);

  const [state, setState] = useState<{ transport: SocketArenaTransport | null; status: "connecting" | "ready" | "failed"; error: string }>({ transport: null, status: "connecting", error: "" });
  useEffect(() => {
    if (!transport) return;
    let active = true;
    (window as unknown as { __arenaTransport?: SocketArenaTransport }).__arenaTransport = transport;
    setState({ transport, status: "connecting", error: "" });
    void transport.connect().then(() => { if (active) setState({ transport, status: "ready", error: "" }); })
      .catch((error: unknown) => { if (active) setState({ transport, status: "failed", error: error instanceof Error ? error.message : "connect failed" }); });
    return () => {
      active = false;
      transport.disconnect();
      const browser = window as unknown as { __arenaTransport?: SocketArenaTransport };
      if (browser.__arenaTransport === transport) delete browser.__arenaTransport;
    };
  }, [transport]);

  const onMatchFound = useCallback((id: string) => {
    setMatchId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("match", id);
    window.history.pushState({}, "", url);
  }, []);

  if (snapshot.status === "loading") return <p className="p-4 font-mono text-sm">Restoring session…</p>;
  if (!userId) return <main className="p-4">
    <p role={snapshot.status === "unavailable" ? "alert" : undefined} className="font-mono text-sm">
      {snapshot.status === "unavailable" ? "Session unavailable. Please try again." : "Sign in to play."}
    </p>
    <button type="button" className="mt-2 rounded border px-2 py-1 font-mono text-xs" onClick={() => void auth.restore().catch(() => {})}>Try again</button>
  </main>;
  if (!matchId || !transport) return lobby ? <LobbyPage key={`${generation}:${userId}`} client={lobby} userId={userId} initialMode="1v1" onMatchFound={onMatchFound} /> : null;
  if (state.transport !== transport || state.status === "connecting") return <p className="p-4 font-mono text-sm">Connecting to match…</p>;
  if (state.status === "failed") return <p role="alert" className="p-4 font-mono text-sm text-red-700">Connection failed: {state.error}</p>;
  return <ArenaPage key={`${generation}:${userId}:${matchId}`} transport={transport} onAuthSignal={subscribeRenewal} />;
}

function AppContent() {
  const [mode, setMode] = useState<MatchMode>("1v1");
  const transport = useMemo(() => new MockArenaTransport(mode), [mode]);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const paramMatchId = params.get("match") ?? "";
  const [liveMatchId, setLiveMatchId] = useState<string>(paramMatchId);

  if (!import.meta.env.DEV || pathname === "/play/" || pathname === "/play") {
    return <PlayApp initialMatchId={paramMatchId} />;
  }

  if (import.meta.env.DEV && params.get("live") === "1") {
    if (!GAME_URL)
      return <p role="alert" className="p-4 font-mono text-sm">Live mode requested but VITE_GAME_URL is not configured.</p>;
    const userId = params.get("user") ?? "user-a";

    if (liveMatchId) {
      return <LiveApp baseUrl={GAME_URL} userId={userId} matchId={liveMatchId} />;
    }

    const lobbyClient = new LobbyClient(GAME_URL, userId);
    return (
      <LobbyPage
        client={lobbyClient}
        userId={userId}
        initialMode="1v1"
        onMatchFound={(mId) => {
          setLiveMatchId(mId);
          if (typeof window !== "undefined") {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("match", mId);
            window.history.pushState({}, "", nextUrl.toString());
          }
        }}
      />
    );
  }
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
