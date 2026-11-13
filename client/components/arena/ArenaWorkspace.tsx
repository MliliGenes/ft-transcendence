"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { IconCheck, IconCode, IconFlag, IconPlayerPlay, IconSend } from "@tabler/icons-react";
import type { ArenaTransport } from "@/lib/arena/transport";
import { useArena } from "@/hooks/useArena";
import { createArenaSidecarLifecycle, type SidecarState } from "@/lib/arena/sidecars";
import { ArenaHeader } from "./ArenaHeader";
import { ProblemPanel } from "./ProblemPanel";
import { DuelPanel } from "./DuelPanel";
import { TestPanel } from "./TestPanel";
import { RoundScoreReveal } from "./RoundScoreReveal";
import { MatchResult } from "./MatchResult";
import { TeamChat } from "./TeamChat";
import { Button } from "@/components/ui/button";

// Dynamic import with SSR disabled per next-frontend rules to guard CodeMirror & Yjs browser globals
const EditorAdapter = dynamic(
  () => import("./EditorAdapter").then((mod) => mod.EditorAdapter),
  { ssr: false, loading: () => <div className="h-full w-full bg-card animate-pulse" /> },
);

export interface ArenaWorkspaceProps {
  transport: ArenaTransport;
}

export function ArenaWorkspace({ transport }: ArenaWorkspaceProps) {
  const snapshot = useArena(transport);
  const [sidecars, setSidecars] = useState<SidecarState>({ collab: null, chat: null });
  const codeKey = `${snapshot.problem.id}:${snapshot.language}`;
  const starterCode = snapshot.problem.starters[snapshot.language as "C++" | "Python" | "C"] ?? "";
  const [codeState, setCodeState] = useState(() => ({ key: codeKey, value: starterCode }));
  if (!sidecars.collab && codeState.key !== codeKey) setCodeState({ key: codeKey, value: starterCode });
  const code = codeState.value;
  const setCode = (value: string) => setCodeState({ key: codeKey, value });
  const [fontSize, setFontSize] = useState(14);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isRunning = pendingAction === "run";
  const isSubmitting = pendingAction === "submit";
  const feedback = actionError ?? snapshot.notice;

  const sidecarLifecycleRef = useRef(createArenaSidecarLifecycle());

  // Synchronize 2v2 sidecars (collab and team chat)
  useEffect(() => {
    const lifecycle = sidecarLifecycleRef.current;
    let active = true;

    lifecycle.sync({
      transportKey: transport,
      round: snapshot.round,
      collabConfig: transport.collabConfig ? transport.collabConfig() : null,
      chatConfig: transport.chatConfig ? transport.chatConfig() : null,
    }).then((state) => {
      if (active && state) setSidecars(state);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [transport, snapshot.round, snapshot.mode]);

  async function performAction(name: string, action: () => Promise<void>, message: string) {
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

  const isCoding = snapshot.roundPhase === "CODING";
  const canSubmit2v2 = snapshot.mode === "2v2" ? (snapshot.ready.you && snapshot.ready.mate) : true;
  const isSubmitDisabled = !isCoding || Boolean(pendingAction) || !canSubmit2v2;

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <ArenaHeader
        snapshot={snapshot}
        connection={transport.connection()}
        pending={Boolean(pendingAction)}
        onLeave={() => performAction("leave", () => transport.leave(), "Unable to leave the match. Please try again.")}
      />
      {feedback && snapshot.roundPhase !== "SCORE_REVEAL" && (
        <p role="alert" className="border-b border-border bg-card px-4 py-2 text-sm text-destructive">{feedback}</p>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Problem & Match Panels */}
        <div className="flex w-[40%] flex-col border-r border-border bg-card">
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
        <div className="flex w-[60%] flex-col bg-background">
          {/* Editor Toolbar */}
          <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-muted-foreground">Language:</span>
              <select
                value={snapshot.language}
                onChange={(e) => performAction("language", () => transport.setLanguage(e.target.value), "Unable to change language. Please try again.")}
                disabled={!isCoding || Boolean(pendingAction)}
                className="rounded-none border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
              >
                <option value="C++">C++</option>
                <option value="Python">Python</option>
                <option value="C">C</option>
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={!isCoding || Boolean(pendingAction)}
                className="h-7 text-xs font-medium"
              >
                <IconPlayerPlay className="size-3.5 mr-1" />
                <span>{isRunning ? "Running…" : "Run Tests"}</span>
              </Button>

              {snapshot.mode === "2v2" && (
                <Button
                  variant={snapshot.ready.you ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleReady}
                  disabled={!isCoding || Boolean(pendingAction)}
                  className="h-7 text-xs font-medium"
                >
                  <IconCheck className={`size-3.5 mr-1 ${snapshot.ready.you ? "text-success" : ""}`} />
                  <span>{snapshot.ready.you ? "Ready (click to cancel)" : "Mark Ready"}</span>
                </Button>
              )}

              {snapshot.mode === "2v2" && (
                <Button
                  variant={snapshot.surrender.you ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleSurrender}
                  disabled={snapshot.roundPhase === "MATCH_COMPLETE" || Boolean(pendingAction)}
                  className="h-7 text-xs font-medium"
                  title="Both active teammates must approve. After a teammate leaves or is disconnected for 90 seconds, you may decide alone."
                >
                  <IconFlag className="size-3.5 mr-1" />
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
                className="h-7 text-xs font-medium"
                title="Your latest completed submission replaces your team's scored answer. The round reveals and closes after both teams have scored."
              >
                <IconSend className="size-3.5 mr-1" />
                <span>{isSubmitting ? "Evaluating…" : "Submit"}</span>
              </Button>
            </div>
          </div>

          <p className="border-t border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground" role="status">
            Your latest completed submission replaces your team&apos;s scored answer. The round reveals and closes after both teams have scored.
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
                  className="mt-6 font-semibold"
                  size="lg"
                >
                  <IconCode className="size-4 mr-2" />
                  <span>Begin Coding</span>
                </Button>
                {feedback && <p role="alert" className="mt-3 text-sm text-destructive">{feedback}</p>}
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
      {snapshot.roundPhase === "SCORE_REVEAL" && (
        <RoundScoreReveal
          reveal={snapshot.reveal}
          round={snapshot.round}
          totalRounds={snapshot.totalRounds}
          onAdvance={() => performAction("advance", () => transport.advance(), "Unable to advance the match. Please try again.")}
          pending={Boolean(pendingAction)}
          error={feedback}
        />
      )}

      {(snapshot.roundPhase === "MATCH_COMPLETE" || snapshot.matchFinal) && snapshot.matchFinal && (
        <MatchResult final={snapshot.matchFinal} />
      )}
    </div>
  );
}
