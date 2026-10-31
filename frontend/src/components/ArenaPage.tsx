import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArenaHeader } from "./ArenaHeader.js";
import { MatchResult } from "./MatchResult.js";
import { PhaseBanner } from "./PhaseBanner.js";
import { RoundScoreReveal } from "./RoundScoreReveal.js";
import type { CollabClient } from "../arena/collab.js";
import type { TeamChatClient } from "../arena/chat.js";
import { draftScopeFor, drafts } from "../arena/draft.js";
import { createArenaSidecarLifecycle, type LiveClientConfig } from "../arena/sidecars.js";
import type { ArenaTransport, FixtureTransportControls } from "../arena/transport.js";
import type { ArenaSnapshot, RoundPhase } from "../arena/types.js";
import { useArena } from "../arena/useArena.js";
import { useMatchClock } from "../arena/clock.js";

const ArenaWorkspace = lazy(() =>
  import("./ArenaWorkspace.js").then(({ ArenaWorkspace: workspace }) => ({ default: workspace })),
);

function resolveSidecarConfigs(transport: ArenaTransport, snapshot: ArenaSnapshot) {
  const collabConfig: LiveClientConfig | null =
    snapshot.mode === "2v2" && typeof transport.collabConfig === "function"
      ? transport.collabConfig()
      : null;
  const chatConfig: LiveClientConfig | null =
    snapshot.mode === "2v2" && typeof transport.chatConfig === "function"
      ? transport.chatConfig()
      : null;
  return { collabConfig, chatConfig };
}

function useCollabBinding(
  collab: CollabClient | null,
  setCollabError: (err: string | null) => void,
  onSource?: (source: string) => void,
) {
  useEffect(() => {
    if (!collab) return;
    setCollabError(null);
    let cancelled = false;
    collab
      .connect()
      .then(() => {
        if (!cancelled && onSource) onSource(collab.getSource());
      })
      .catch((e: unknown) => {
        if (!cancelled) setCollabError(e instanceof Error ? e.message : "shared doc unavailable");
      });
    const unsub = collab.subscribe(() => {
      if (onSource) onSource(collab.getSource());
    });
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaCollab?: CollabClient | null }).__arenaCollab = collab;
    }
    return () => {
      cancelled = true;
      unsub();
      if (typeof window !== "undefined") {
        (window as unknown as { __arenaCollab?: CollabClient | null }).__arenaCollab = null;
      }
    };
  }, [collab, setCollabError, onSource]);
}

function useChatBinding(chat: TeamChatClient | null) {
  useEffect(() => {
    if (!chat) return;
    chat.connect().catch(() => {});
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaChat?: TeamChatClient | null }).__arenaChat = chat;
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as unknown as { __arenaChat?: TeamChatClient | null }).__arenaChat = null;
      }
    };
  }, [chat]);
}

function useArenaSidecars(
  transport: ArenaTransport,
  snapshot: ArenaSnapshot,
  onAuthSignal?: (listener: () => void) => () => void,
  onCollabSource?: (source: string) => void,
) {
  const sidecarLifecycle = useMemo(() => createArenaSidecarLifecycle(), []);
  const { collabConfig, chatConfig } = useMemo(
    () => resolveSidecarConfigs(transport, snapshot),
    [transport, snapshot.mode, snapshot.round],
  );

  const sidecarScope = useMemo(
    () => ({ transportKey: transport, round: snapshot.round, collabConfig, chatConfig }),
    [transport, snapshot.round, collabConfig, chatConfig],
  );

  const [collab, setCollab] = useState<CollabClient | null>(null);
  const [chat, setChat] = useState<TeamChatClient | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCollabError(null);

    const pending = sidecarLifecycle.sync(sidecarScope);
    const current = sidecarLifecycle.getState();
    setCollab(current.collab);
    setChat(current.chat);
    setClientsLoading(sidecarScope.collabConfig !== null || sidecarScope.chatConfig !== null);

    void pending
      .then((next) => {
        if (cancelled || !next) return;
        setCollab(next.collab);
        setChat(next.chat);
        setClientsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setClientsLoading(false);
        setCollabError(error instanceof Error ? error.message : "Unable to load live collaboration.");
      });

    return () => {
      cancelled = true;
    };
  }, [sidecarLifecycle, sidecarScope]);

  useEffect(() => () => sidecarLifecycle.dispose(), [sidecarLifecycle]);

  useEffect(() => {
    if (!onAuthSignal) return;
    return onAuthSignal(() => {
      void sidecarLifecycle.renew().catch(() => {});
    });
  }, [onAuthSignal, sidecarLifecycle]);

  useCollabBinding(collab, setCollabError, onCollabSource);
  useChatBinding(chat);

  return { collab, chat, clientsLoading, collabError, collabConfig };
}

function useArenaDraftSync(
  draftScope: ReturnType<typeof draftScopeFor>,
  snapshot: ArenaSnapshot,
  collab: CollabClient | null,
  starter: string,
  code: string,
  setCode: (code: string) => void,
) {
  const draftPlayerId = draftScope.playerId;
  const draftMatchKey = draftScope.scopeKey;

  useEffect(() => {
    if (collab) return;
    const scope = { playerId: draftPlayerId, scopeKey: draftMatchKey };
    setCode(drafts.load(scope, snapshot.round, snapshot.problem.id, snapshot.language) ?? starter);
  }, [collab, draftPlayerId, draftMatchKey, snapshot.round, snapshot.problem.id, snapshot.language, starter, setCode]);

  useEffect(() => {
    if (collab) return;
    const scope = { playerId: draftPlayerId, scopeKey: draftMatchKey };
    drafts.save(scope, snapshot.round, snapshot.problem.id, snapshot.language, code);
  }, [collab, draftPlayerId, draftMatchKey, snapshot.round, snapshot.problem.id, snapshot.language, code]);
}

function createActionDispatcher(setActionError: (msg: string | null) => void) {
  return (fn: () => Promise<unknown>) => () => {
    setActionError(null);
    fn().catch((e: unknown) => setActionError(e instanceof Error ? e.message : "action failed"));
  };
}

async function handleStartRound(transport: ArenaTransport, roundPhase: string) {
  if (roundPhase === "MATCH_FOUND") await transport.startRound();
  if (transport.connection() === "connected") await transport.beginCoding();
}

function ArenaTopControls({
  phase,
  round,
  totalRounds,
  terminal,
  commandsPaused,
  onLeave,
}: {
  phase: RoundPhase;
  round: number;
  totalRounds: number;
  terminal: boolean;
  commandsPaused: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <PhaseBanner phase={phase} round={round} totalRounds={totalRounds} />
      </div>
      {!terminal && (
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-600"
          disabled={commandsPaused}
          onClick={() => {
            if (window.confirm("Leave the match? Leaving forfeits immediately.")) {
              onLeave();
            }
          }}
        >
          Leave match
        </button>
      )}
    </div>
  );
}

function ConnectionRecoveryAlert({
  commandsPaused,
  connectionError,
  connect,
  onRetry,
}: {
  commandsPaused: boolean;
  connectionError?: string | null;
  connect?: () => Promise<void>;
  onRetry: () => void;
}) {
  if (!commandsPaused || !connectionError || !connect) return null;
  return (
    <section className="rounded border border-red-700 bg-white p-3" aria-label="Connection recovery">
      <p role="alert" className="font-mono text-xs text-red-700">{connectionError}</p>
      <button type="button" className="mt-2 rounded border px-2 py-1 text-sm" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

function StartRoundButton({
  phase,
  commandsPaused,
  onStart,
}: {
  phase: RoundPhase;
  commandsPaused: boolean;
  onStart: () => void;
}) {
  if (phase !== "ROUND_INTRO" && phase !== "MATCH_FOUND") return null;
  return (
    <button
      type="button"
      className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
      disabled={commandsPaused}
      onClick={onStart}
    >
      Start round
    </button>
  );
}

function ArenaAlerts({ actionError, collabError }: { actionError: string | null; collabError: string | null }) {
  return (
    <>
      {actionError && (
        <p role="alert" className="rounded-md border border-red-700 bg-white px-3 py-2 font-mono text-xs text-red-700">
          {actionError}
        </p>
      )}
      {collabError && (
        <p role="alert" className="rounded-md border border-red-700 bg-white px-3 py-2 font-mono text-xs text-red-700">
          Shared editor: {collabError}
        </p>
      )}
    </>
  );
}

function ActiveWorkspaceView({
  snapshot,
  transport,
  code,
  onCode,
  collab,
  chat,
  clientsLoading,
  collabConfig,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  code: string;
  onCode: (code: string) => void;
  collab: CollabClient | null;
  chat: TeamChatClient | null;
  clientsLoading: boolean;
  collabConfig: LiveClientConfig | null;
}) {
  if (snapshot.roundPhase !== "CODING" && snapshot.roundPhase !== "SCORE_REVEAL") return null;
  if (clientsLoading || (collabConfig !== null && collab === null)) {
    return (
      <p className="rounded border border-neutral-200 bg-white p-4 font-mono text-sm text-neutral-500" role="status">
        {clientsLoading ? "Loading shared workspace…" : "The shared workspace is unavailable."}
      </p>
    );
  }
  return (
    <Suspense
      fallback={
        <p className="rounded border border-neutral-200 bg-white p-4 font-mono text-sm text-neutral-500" role="status">
          Loading editor…
        </p>
      }
    >
      <ArenaWorkspace snapshot={snapshot} transport={transport} code={code} onCode={onCode} collab={collab} chat={chat} />
    </Suspense>
  );
}

function RoundRevealSection({
  snapshot,
  commandsPaused,
  onAdvance,
}: {
  snapshot: ArenaSnapshot;
  commandsPaused: boolean;
  onAdvance: () => void;
}) {
  if (snapshot.roundPhase !== "SCORE_REVEAL" || !snapshot.reveal) return null;
  const buttonText = snapshot.round < snapshot.totalRounds ? "Next round" : "See final result";
  return (
    <>
      <RoundScoreReveal reveal={snapshot.reveal} round={snapshot.round} />
      <button
        type="button"
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
        disabled={commandsPaused}
        onClick={onAdvance}
      >
        {buttonText}
      </button>
    </>
  );
}

function MatchCompletionSection({
  snapshot,
  matchScopeKey,
  deadlineResultScopeKey,
  onShowDeadlineResult,
}: {
  snapshot: ArenaSnapshot;
  matchScopeKey: string;
  deadlineResultScopeKey: string | null;
  onShowDeadlineResult: () => void;
}) {
  if (snapshot.roundPhase !== "MATCH_COMPLETE") return null;

  if (!snapshot.reveal && snapshot.matchFinal) {
    return <MatchResult reveal={null} round={snapshot.round} matchFinal={snapshot.matchFinal} />;
  }

  if (!snapshot.reveal) return null;

  if (snapshot.remainingSeconds > 0) {
    return <MatchResult reveal={snapshot.reveal} round={snapshot.round} matchFinal={snapshot.matchFinal} />;
  }

  if (deadlineResultScopeKey === matchScopeKey) {
    return (
      <>
        <RoundScoreReveal reveal={snapshot.reveal} round={snapshot.round} />
        <MatchResult reveal={snapshot.reveal} round={snapshot.round} matchFinal={snapshot.matchFinal} />
      </>
    );
  }

  return (
    <>
      <RoundScoreReveal reveal={snapshot.reveal} round={snapshot.round} />
      <button
        type="button"
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
        onClick={onShowDeadlineResult}
      >
        See final result
      </button>
    </>
  );
}

function ArenaFooter() {
  return (
    <footer className="mx-auto max-w-7xl border-t border-neutral-200 px-3 py-4 text-xs text-neutral-500 flex justify-between items-center">
      <span>Code Arena</span>
      <nav className="flex gap-4" aria-label="Legal">
        <a href="/privacy" className="underline hover:text-neutral-700">Privacy Policy</a>
        <a href="/terms" className="underline hover:text-neutral-700">Terms of Service</a>
      </nav>
    </footer>
  );
}

function DevFixtureControls({ controls }: { controls: FixtureTransportControls | null }) {
  if (!controls) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-2" aria-label="Mock controls">
      <span className="font-mono text-xs text-neutral-500">mock:</span>
      <button
        type="button"
        className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
        onClick={() => controls.publishReveal()}
      >
        publish reveal
      </button>
      <button
        type="button"
        className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
        onClick={() => controls.nextRound()}
      >
        next round
      </button>
      <button
        type="button"
        className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
        onClick={() => controls.setMateReady(true)}
      >
        mate ready
      </button>
    </div>
  );
}

/**
 * Local draft (ticket 11 §5): server state and the unsent editor draft are
 * different things. Drafts live in this browser only, keyed by the signed-in
 * player plus Match scope and round/problem/language, so a stale reconnect or
 * a shared browser can never carry another account's code forward. Hard
 * refresh restores the draft; a new device starts from the starter. The
 * server never sees the draft — only explicit Run/Submit payloads leave the
 * browser.
 */
export function ArenaPage({ transport, onAuthSignal }: { transport: ArenaTransport; onAuthSignal?: (listener: () => void) => () => void }) {
  const snapshot = useArena(transport);
  const liveRemainingSeconds = useMatchClock(snapshot);
  const starter = snapshot.problem.starters[snapshot.language as "Python"] ?? "";
  const draftScope = useMemo(() => draftScopeFor(transport), [transport]);

  const [code, setCode] = useState(
    () => drafts.load(draftScope, snapshot.round, snapshot.problem.id, snapshot.language) ?? starter,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [deadlineResultScopeKey, setDeadlineResultScopeKey] = useState<string | null>(null);

  const act = useMemo(() => createActionDispatcher(setActionError), []);
  const fixtureControls = transport.fixtureControls?.() ?? null;
  const terminal = snapshot.roundPhase === "MATCH_COMPLETE";
  const commandsPaused = transport.connection() !== "connected";
  const matchScopeKey = transport.scopeKey();

  const { collab, chat, clientsLoading, collabError, collabConfig } = useArenaSidecars(
    transport,
    snapshot,
    onAuthSignal,
    setCode,
  );

  useArenaDraftSync(draftScope, snapshot, collab, starter, code, setCode);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <a href="#arena-main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Skip to arena
      </a>
      <ArenaHeader mode={snapshot.mode} remainingSeconds={liveRemainingSeconds} connection={transport.connection()} />
      <main id="arena-main" className="mx-auto max-w-7xl space-y-3 p-3">
        <ArenaTopControls
          phase={snapshot.roundPhase}
          round={snapshot.round}
          totalRounds={snapshot.totalRounds}
          terminal={terminal}
          commandsPaused={commandsPaused}
          onLeave={act(() => transport.leave())}
        />
        <ConnectionRecoveryAlert
          commandsPaused={commandsPaused}
          connectionError={transport.connectionError}
          connect={transport.connect}
          onRetry={act(() => transport.connect!())}
        />
        {snapshot.notice && (
          <p role="status" className="rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs">
            {snapshot.notice}
          </p>
        )}
        <StartRoundButton
          phase={snapshot.roundPhase}
          commandsPaused={commandsPaused}
          onStart={act(() => handleStartRound(transport, snapshot.roundPhase))}
        />
        <ArenaAlerts actionError={actionError} collabError={collabError} />
        <ActiveWorkspaceView
          snapshot={snapshot}
          transport={transport}
          code={code}
          onCode={setCode}
          collab={collab}
          chat={chat}
          clientsLoading={clientsLoading}
          collabConfig={collabConfig}
        />
        <RoundRevealSection
          snapshot={snapshot}
          commandsPaused={commandsPaused}
          onAdvance={act(() => transport.advance())}
        />
        <MatchCompletionSection
          snapshot={snapshot}
          matchScopeKey={matchScopeKey}
          deadlineResultScopeKey={deadlineResultScopeKey}
          onShowDeadlineResult={() => setDeadlineResultScopeKey(matchScopeKey)}
        />
        <DevFixtureControls controls={fixtureControls} />
      </main>
      <ArenaFooter />
    </div>
  );
}
