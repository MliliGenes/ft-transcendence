"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { IconCheck, IconCode, IconFlag, IconLoader2, IconPlayerPlay, IconSend } from "@tabler/icons-react";
import type { ArenaTransport } from "@/lib/arena/transport";
import { useArena } from "@/hooks/useArena";
import { createArenaSidecarLifecycle, type SidecarState } from "@/lib/arena/sidecars";
import { ArenaHeader } from "./ArenaHeader";
import { ProblemPanel } from "./ProblemPanel";
import { DuelPanel } from "./DuelPanel";
import { TestPanel } from "./TestPanel";
import { MatchResult } from "./MatchResult";
import { TeamChat } from "./TeamChat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Dynamic import with SSR disabled per next-frontend rules to guard CodeMirror & Yjs browser globals
const EditorAdapter = dynamic(
  () => import("./EditorAdapter").then((mod) => mod.EditorAdapter),
  { ssr: false, loading: () => <div className="h-full w-full bg-card animate-pulse" /> },
);

export interface ArenaWorkspaceProps {
  transport: ArenaTransport;
}

// The workspace runs one arena action at a time, so the pending state is a closed
// set of action names rather than an arbitrary string.
type ArenaPendingAction =
  | "run"
  | "submit"
  | "ready"
  | "surrender"
  | "language"
  | "leave"
  | "begin";

// Progress for every action that stays on screen while its request runs. The
// action label is preserved while loading, so the announcement carries the
// progress instead (Nook design system: preserve the label while loading).
const arenaActionStatus: Record<ArenaPendingAction, string> = {
  run: "Running visible tests…",
  submit: "Evaluating your submission…",
  ready: "Updating readiness…",
  surrender: "Updating surrender approval…",
  language: "Changing language…",
  leave: "Leaving the match…",
  begin: "Preparing the coding round…",
};

// These two run behind a full overlay, so the overlay itself carries the
// progress instead of the toolbar status line.
const overlayPendingActions: ArenaPendingAction[] = ["begin"];

export function ArenaWorkspace({ transport }: ArenaWorkspaceProps) {
  const snapshot = useArena(transport);
  const [sidecars, setSidecars] = useState<SidecarState>({ collab: null, chat: null });
  const currentRound = snapshot.progress?.self?.currentRound ?? snapshot.round ?? 1;
  const matchId = transport.scopeKey?.() ?? (snapshot as unknown as { matchId?: string }).matchId ?? "";
  const codeKey = `${matchId}:${currentRound}:${snapshot.problem.id}:${snapshot.language}`;
  const starterCode = snapshot.problem.starters[snapshot.language as "C++" | "Python" | "C"] ?? "";
  const [codeState, setCodeState] = useState(() => ({ key: codeKey, value: starterCode }));
  if (!sidecars.collab && codeState.key !== codeKey) setCodeState({ key: codeKey, value: starterCode });
  const code = codeState.value;
  const setCode = (value: string) => setCodeState({ key: codeKey, value });
  const [fontSize, setFontSize] = useState(14);
  const [pendingAction, setPendingAction] = useState<ArenaPendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedScoredState, setDismissedScoredState] = useState<{ matchId: string; round: number | null }>(() => ({ matchId, round: null }));
  const dismissedScoredRound = dismissedScoredState.matchId === matchId ? dismissedScoredState.round : null;
  const lastScoredRound = snapshot.progress?.self?.lastScoredRound;
  const lastScore = snapshot.progress?.self?.lastScore;

  useEffect(() => {
    if (lastScoredRound && dismissedScoredRound !== lastScoredRound) {
      const timer = setTimeout(() => {
        setDismissedScoredState({ matchId, round: lastScoredRound });
      }, 5000);
      return () => {
        if (typeof clearTimeout !== "undefined") clearTimeout(timer);
      };
    }
  }, [matchId, lastScoredRound, dismissedScoredRound]);

  const scoreNoticeText = (lastScoredRound && dismissedScoredRound !== lastScoredRound)
    ? `Problem ${lastScoredRound} scored: ${lastScore ?? 0}/100 — moving to problem ${snapshot.progress?.self?.currentRound ?? (lastScoredRound + 1)}${snapshot.progress?.self?.stage === "FINISHED" ? " (finished)" : ""}.`
    : null;

  const isRunning = pendingAction === "run";
  const isSubmitting = pendingAction === "submit";
  const pendingInOverlay = pendingAction !== null && overlayPendingActions.includes(pendingAction);

  const sidecarLifecycleRef = useRef(createArenaSidecarLifecycle());

  // Synchronize 2v2 sidecars when the match scope or its credentials change.
  // Subscribe directly so a token update is observed even though the match
  // snapshot itself has not changed.
  useEffect(() => {
    const lifecycle = sidecarLifecycleRef.current;
    let active = true;
    let lastScopeKey: string | null = null;

    const sync = () => {
      const currentSnapshot = transport.snapshot();
      const collabConfig = transport.collabConfig ? transport.collabConfig() : null;
      const chatConfig = transport.chatConfig ? transport.chatConfig() : null;
      const scopeKey = JSON.stringify([currentSnapshot.mode, currentSnapshot.round, collabConfig, chatConfig]);
      if (scopeKey === lastScopeKey) return;
      lastScopeKey = scopeKey;

      void lifecycle.sync({
        transportKey: transport,
        round: currentSnapshot.round,
        collabConfig,
        chatConfig,
      }).then((state) => {
        if (active && state) setSidecars(state);
      }).catch(() => {});
    };

    sync();
    const unsubscribe = transport.subscribe(sync);

    return () => {
      active = false;
      unsubscribe();
      lifecycle.dispose();
    };
  }, [transport]);

  async function performAction(name: ArenaPendingAction, action: () => Promise<void>, message: string) {
    if (pendingAction) return;
    setPendingAction(name);
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRun() {
    await performAction("run", async () => {
      const currentCode = sidecars.collab ? sidecars.collab.getSource() : code;
      await transport.run({ code: currentCode, language: snapshot.language });
    }, "Unable to run tests. Please try again.");
  }

  async function handleSubmit() {
    await performAction("submit", async () => {
      const currentCode = sidecars.collab ? sidecars.collab.getSource() : code;
      await transport.submit({
        code: currentCode,
        language: snapshot.language,
        documentRevision: snapshot.docRevision ?? undefined,
      });
    }, "Unable to submit your code. Please try again.");
  }

  async function handleToggleReady() {
    await performAction("ready", () => transport.setReady(!snapshot.ready.you), "Unable to update readiness. Please try again.");
  }

  async function handleSurrender() {
    await performAction("surrender", () => transport.surrender(!snapshot.surrender.you), "Unable to update surrender approval. Please try again.");
  }

  const isCoding = snapshot.roundPhase === "CODING" && (snapshot.progress?.self?.stage ? snapshot.progress.self.stage === "CODING" : true);
  const canSubmit2v2 = snapshot.mode === "2v2" ? (snapshot.ready?.you && snapshot.ready?.mate) : true;
  const isSubmitDisabled = !isCoding || Boolean(pendingAction) || !canSubmit2v2;

  return (
    <div className="flex h-screen min-w-0 w-full flex-col bg-background text-foreground overflow-hidden">
      <ArenaHeader
        snapshot={snapshot}
        connection={transport.connection()}
        pending={Boolean(pendingAction)}
        pendingAction={pendingAction}
        onLeave={() => performAction("leave", () => transport.leave(), "Unable to leave the match. Please try again.")}
      />
      {actionError && snapshot.roundPhase !== "SCORE_REVEAL" && (
        <p role="alert" className="border-b border-border bg-card px-4 py-2 text-sm text-destructive">{actionError}</p>
      )}
      {scoreNoticeText && snapshot.roundPhase !== "SCORE_REVEAL" && (
        <p role="status" aria-live="polite" className="border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">{scoreNoticeText}</p>
      )}
      {snapshot.notice && snapshot.roundPhase !== "SCORE_REVEAL" && (
        <p role="alert" className="border-b border-border bg-card px-4 py-2 text-sm text-destructive">{snapshot.notice}</p>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Left Side: Problem & Match Panels */}
        <div className="flex min-w-0 w-[40%] flex-col border-r border-border bg-card">
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={snapshot.problem} />
          </div>

          <div className="border-t border-border">
            <DuelPanel snapshot={snapshot} />
          </div>

          {snapshot.mode === "2v2" && sidecars.chat && (
            <div className="h-64 border-t border-border">
              <TeamChat client={sidecars.chat} />
            </div>
          )}
        </div>

        {/* Right Side: Editor & Tests */}
        <div className="flex min-w-0 w-[60%] flex-col bg-background">
          {/* Editor Toolbar */}
          <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 text-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label htmlFor="arena-language" className="font-semibold text-muted-foreground">Language:</label>
              <select
                id="arena-language"
                value={snapshot.language}
                onChange={(e) => performAction("language", () => transport.setLanguage(e.target.value), "Unable to change language. Please try again.")}
                disabled={!isCoding || Boolean(pendingAction)}
                aria-busy={pendingAction === "language"}
                className="rounded-none border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
              >
                {Object.keys(snapshot.problem.starters).map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>

              <span className="ml-2 text-muted-foreground">Font:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="rounded-none border border-border bg-background px-1.5 py-1 text-foreground focus:outline-none font-mono text-xs"
              >
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
              </select>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={!isCoding || Boolean(pendingAction)}
                aria-busy={isRunning}
                className={cn("h-7 text-xs font-medium", isRunning && "disabled:opacity-100")}
              >
                {isRunning
                  ? <IconLoader2 className="size-3.5 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  : <IconPlayerPlay className="size-3.5 mr-1" />}
                <span>Run Tests</span>
              </Button>

              {snapshot.mode === "2v2" && (
                <Button
                  variant={snapshot.ready.you ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleReady}
                  disabled={!isCoding || Boolean(pendingAction)}
                  aria-busy={pendingAction === "ready"}
                  className={cn("h-7 text-xs font-medium", pendingAction === "ready" && "disabled:opacity-100")}
                >
                  {pendingAction === "ready"
                    ? <IconLoader2 className="size-3.5 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    : <IconCheck className={`size-3.5 mr-1 ${snapshot.ready.you ? "text-success" : ""}`} />}
                  <span>{snapshot.ready.you ? "Ready (click to cancel)" : "Mark Ready"}</span>
                </Button>
              )}

              {snapshot.mode === "2v2" && (
                <Button
                  variant={snapshot.surrender.you ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleSurrender}
                  disabled={snapshot.roundPhase === "MATCH_COMPLETE" || Boolean(pendingAction)}
                  aria-busy={pendingAction === "surrender"}
                  className={cn("h-7 text-xs font-medium", pendingAction === "surrender" && "disabled:opacity-100")}
                  title="Both active teammates must approve. After a teammate leaves or is disconnected for 90 seconds, you may decide alone."
                >
                  {pendingAction === "surrender"
                    ? <IconLoader2 className="size-3.5 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    : <IconFlag className="size-3.5 mr-1" />}
                  <span>
                    {snapshot.surrender.you
                      ? "Cancel surrender"
                      : snapshot.surrender.mate
                        ? "Approve surrender"
                        : "Request surrender"}
                  </span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                aria-busy={isSubmitting}
                className={cn("h-7 text-xs font-medium", isSubmitting && "disabled:opacity-100")}
                title="A counted score advances your side to its next problem immediately. Your opponent's scores stay hidden until the match ends."
              >
                {isSubmitting
                  ? <IconLoader2 className="size-3.5 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  : <IconSend className="size-3.5 mr-1" />}
                <span>Submit</span>
              </Button>
            </div>

            {/* Keep progress readable without competing with the action controls. */}
            <p role="status" aria-live="polite" aria-atomic="true" className="min-h-4 min-w-0 basis-full text-muted-foreground">
              {pendingAction && !pendingInOverlay ? arenaActionStatus[pendingAction] : ""}
            </p>
          </div>

          <p className="border-t border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground" role="status">
            A counted score advances your side immediately. Opponent scores stay hidden until the match ends.
          </p>
          {snapshot.mode === "2v2" && (
            <p className="border-t border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground" role="status">
              Both teammates must approve until one leaves or stays disconnected for 90 seconds. A returning teammate must approve again.
            </p>
          )}

          {snapshot.mode === "2v2" && snapshot.surrender.mate && !snapshot.surrender.you && (
            <p className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground" role="status">
              Your teammate requested surrender. Approve to end the match, or keep playing.
            </p>
          )}
          {snapshot.mode === "2v2" && snapshot.surrender.you && !snapshot.surrender.mate && (
            <p className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground" role="status">
              Surrender requested. The match ends if your teammate approves.
            </p>
          )}
          {snapshot.mode === "2v2" && snapshot.alpha.members[1].departed && (
            <p className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground" role="status">
              Your teammate left. You can continue the match on your own.
            </p>
          )}

          {/* Editor Container */}
          <div className="flex-1 overflow-hidden relative">
            <EditorAdapter
              language={snapshot.language}
              code={code}
              readOnly={!isCoding}
              fontSize={fontSize}
              onChange={setCode}
              collab={sidecars.collab ?? undefined}
            />

            {snapshot.roundPhase === "CODING" && snapshot.progress.self.stage === "FINISHED" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 p-6 text-center">
                <h3 className="text-2xl font-bold text-foreground">You finished all problems</h3>
                <p className="mt-2 text-sm text-muted-foreground">Waiting for opponent (problem {snapshot.progress.opponent.currentRound} of {snapshot.totalRounds}{snapshot.progress.opponent.stage === "FINISHED" ? ", finished" : ""})</p>
              </div>
            )}

            {/* Round Intro / Match Found Banner */}
            {(snapshot.roundPhase === "MATCH_FOUND" || snapshot.roundPhase === "ROUND_INTRO") && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                <div className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">
                  {snapshot.roundPhase === "MATCH_FOUND" ? "Match Ready" : `Round ${snapshot.round}`}
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  {snapshot.problem?.title ?? `Round ${snapshot.round}`}
                </h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Read the problem description and examples on the left. Click below to begin coding!
                </p>
                <Button
                  onClick={() => performAction("begin", async () => {
                    if (snapshot.roundPhase === "MATCH_FOUND") {
                      await transport.startRound();
                    }
                    await transport.beginCoding();
                  }, "Unable to begin coding. Please try again.")}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "begin"}
                  className={cn("mt-6 font-semibold", pendingAction === "begin" && "disabled:opacity-100")}
                  size="lg"
                >
                  {pendingAction === "begin"
                    ? <IconLoader2 className="size-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    : <IconCode className="size-4 mr-2" />}
                  <span>Begin Coding</span>
                </Button>
                {pendingAction === "begin" && (
                  <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
                    {arenaActionStatus.begin}
                  </p>
                )}
                {(actionError ?? snapshot.notice) && (
                  <p role="alert" className="mt-3 text-sm text-destructive">{actionError ?? snapshot.notice}</p>
                )}
              </div>
            )}
          </div>

          {/* Bottom Test Results Panel */}
          <div className="h-48 border-t border-border">
            <TestPanel tests={snapshot.tests} isRunning={isRunning} reveal={snapshot.reveal} />
          </div>
        </div>
      </div>

      {/* Overlays for Reveal and Match Result */}
      {(snapshot.roundPhase === "MATCH_COMPLETE" || snapshot.matchFinal) && snapshot.matchFinal && (
        <MatchResult final={snapshot.matchFinal} rounds={snapshot.reveals} />
      )}
    </div>
  );
}
