"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { IconCheck, IconCode, IconDeviceFloppy, IconPlayerPlay, IconRefresh, IconSend } from "@tabler/icons-react";
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
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidecars, setSidecars] = useState<SidecarState>({ collab: null, chat: null });

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

  // Update initial starter code when problem/language changes
  useEffect(() => {
    const starter = snapshot.problem.starters[snapshot.language as "C++" | "Python" | "C"] ?? "";
    if (!sidecars.collab) {
      setCode(starter);
    }
  }, [snapshot.problem.id, snapshot.language, sidecars.collab]);

  async function handleRun() {
    setIsRunning(true);
    try {
      const currentCode = sidecars.collab ? sidecars.collab.getSource() : code;
      await transport.run({ code: currentCode, language: snapshot.language });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const currentCode = sidecars.collab ? sidecars.collab.getSource() : code;
      await transport.submit({
        code: currentCode,
        language: snapshot.language,
        documentRevision: snapshot.docRevision ?? undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleReady() {
    await transport.setReady(!snapshot.ready.you);
  }

  const isCoding = snapshot.roundPhase === "CODING";
  const canSubmit2v2 = snapshot.mode === "2v2" ? (snapshot.ready.you && snapshot.ready.mate) : true;
  const isSubmitDisabled = !isCoding || isSubmitting || !canSubmit2v2;

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <ArenaHeader
        snapshot={snapshot}
        connection={transport.connection()}
        onLeave={() => transport.leave()}
      />

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
                onChange={(e) => transport.setLanguage(e.target.value)}
                disabled={!isCoding}
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
                disabled={!isCoding || isRunning}
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
                  disabled={!isCoding}
                  className="h-7 text-xs font-medium"
                >
                  <IconCheck className={`size-3.5 mr-1 ${snapshot.ready.you ? "text-success" : ""}`} />
                  <span>{snapshot.ready.you ? "Ready (click to cancel)" : "Mark Ready"}</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="h-7 text-xs font-medium"
              >
                <IconSend className="size-3.5 mr-1" />
                <span>{isSubmitting ? "Evaluating…" : "Submit"}</span>
              </Button>
            </div>
          </div>

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
                  onClick={async () => {
                    try {
                      if (snapshot.roundPhase === "MATCH_FOUND") {
                        await transport.startRound();
                      }
                      await transport.beginCoding();
                    } catch (e) {
                      console.error("Failed to begin coding:", e);
                    }
                  }}
                  className="mt-6 font-semibold"
                  size="lg"
                >
                  <IconCode className="size-4 mr-2" />
                  <span>Begin Coding</span>
                </Button>
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
          onAdvance={() => transport.advance()}
        />
      )}

      {(snapshot.roundPhase === "MATCH_COMPLETE" || snapshot.matchFinal) && snapshot.matchFinal && (
        <MatchResult final={snapshot.matchFinal} />
      )}
    </div>
  );
}
