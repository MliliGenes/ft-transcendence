import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserAuthClient, type BrowserAuthClient } from "browser-auth";
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

/**
 * /play/ (canonical live entry): session-first, no ?user=/?live=/mock. The
 * player id comes from GET /accounts/me over the shared browser-auth client;
 * the transport is stable per user/match and never recreated on rotation.
 */
function PlayApp({ initialMatchId }: { initialMatchId: string }) {
  const auth = useMemo<BrowserAuthClient>(
    () =>
      createBrowserAuthClient({
        apiBase: API_BASE,
        locks: navigator.locks,
        channel: new BroadcastChannel("fieldnote-auth-session"),
      }),
    [],
  );
  useEffect(() => () => auth.dispose(), [auth]);
  const [matchId, setMatchId] = useState(initialMatchId);
  const [boot, setBoot] = useState<"loading" | "anonymous" | "ready">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const devUser = params.get("user");

  useEffect(() => {
    let cancelled = false;
    auth
      .restore()
      .then((snapshot) => {
        if (cancelled) return;
        const id = (snapshot.profile as { id?: unknown } | null)?.id;
        if (snapshot.status === "authenticated" && typeof id === "string" && id) {
          setUserId(id);
          setBoot("ready");
        } else if (devUser) {
          // DEV servers only (x-dev-user-id seam): session-first in prod.
          setUserId(devUser);
          setBoot("ready");
        } else {
          setBoot("anonymous");
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (devUser) {
            setUserId(devUser);
            setBoot("ready");
          } else setBoot("anonymous");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth, devUser]);

  // Stable per user/match: rotation changes the token, never these keys.
  const transport = useMemo<SocketArenaTransport | null>(() => {
    if (!userId || !matchId) return null;
    if (devUser && userId === devUser && auth.getAccessToken() === null)
      return new SocketArenaTransport({ baseUrl: SOCKET_BASE, userId: devUser, matchId });
    return new SocketArenaTransport({
      apiBase: API_BASE,
      socketBase: SOCKET_BASE,
      matchId,
      getAccessToken: () => auth.getAccessToken(),
      onAuthExpired: () => auth.restore(true),
    });
  }, [auth, userId, matchId, devUser]);

  // Shared renewal signal: fresh socket in the same transport; logout ends it.
  useEffect(() => {
    let last = auth.getSnapshot().tokenRevision;
    return auth.subscribe((snapshot) => {
      if (snapshot.tokenRevision !== last) {
        last = snapshot.tokenRevision;
        if (transport) void transport.renewSocket().catch(() => {});
      }
      if (snapshot.status === "anonymous") {
        transport?.disconnect();
        setBoot("anonymous");
        setUserId(null);
      }
    });
  }, [auth, transport]);

  const subscribeRenewal = useCallback(
    (listener: () => void) => {
      let last = auth.getSnapshot().tokenRevision;
      return auth.subscribe((snapshot) => {
        if (snapshot.tokenRevision !== last) {
          last = snapshot.tokenRevision;
          listener();
        }
      });
    },
    [auth],
  );

  const [state, setState] = useState<"connecting" | "ready" | "failed">("connecting");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!transport) return;
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

  const onMatchFound = useCallback(
    (mId: string) => {
      setMatchId(mId);
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("match", mId);
        window.history.pushState({}, "", nextUrl.toString());
      }
    },
    [],
  );

  if (boot === "loading") return <p className="p-4 font-mono text-sm">Restoring session…</p>;
  if (boot === "anonymous" || !userId)
    return (
      <main className="p-4">
        <p className="font-mono text-sm">Sign in to play.</p>
        <button type="button" className="mt-2 rounded border px-2 py-1 font-mono text-xs" onClick={() => void auth.restore()}>
          Try again
        </button>
      </main>
    );
  if (!matchId || !transport) {
    const lobbyClient = new LobbyClient({
      apiBase: API_BASE,
      socketBase: SOCKET_BASE,
      getAccessToken: () => auth.getAccessToken(),
      onAuthExpired: () => auth.restore(true),
    });
    return <LobbyPage client={lobbyClient} userId={userId} initialMode="1v1" onMatchFound={onMatchFound} />;
  }
  if (state === "connecting") return <p className="p-4 font-mono text-sm">Connecting to match…</p>;
  if (state === "failed") return <p role="alert" className="p-4 font-mono text-sm text-red-700">Connection failed: {error}</p>;
  return <ArenaPage transport={transport} onAuthSignal={subscribeRenewal} />;
}

function AppContent() {
  const [mode, setMode] = useState<MatchMode>("1v1");
  const transport = useMemo(() => new MockArenaTransport(mode), [mode]);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const paramMatchId = params.get("match") ?? "";
  const [liveMatchId, setLiveMatchId] = useState<string>(paramMatchId);

  if (pathname === "/play/" || pathname === "/play") {
    return <PlayApp initialMatchId={paramMatchId} />;
  }

  if (params.get("live") === "1") {
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
