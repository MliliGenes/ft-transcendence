"use client";

import { useState } from "react";
import { IconClock, IconDeviceGamepad2, IconDoorExit, IconLoader2, IconWifi, IconWifiOff } from "@tabler/icons-react";
import type { ArenaSnapshot } from "@/lib/arena/types";
import type { ConnectionState } from "@/lib/arena/transport";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ArenaHeaderProps {
  snapshot: ArenaSnapshot;
  connection: ConnectionState;
  onLeave: () => Promise<void>;
  pending: boolean;
  /** Name of the action that is currently in flight, when it is the leave request. */
  pendingAction?: string | null;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ArenaHeader({ snapshot, connection, onLeave, pending, pendingAction }: ArenaHeaderProps) {
  const [leaving, setLeaving] = useState(false);
  const { round, totalRounds, remainingSeconds, mode, roundPhase, you, opponent } = snapshot;

  async function handleLeave() {
    const prompt = mode === "2v2"
      ? "Leave this match? Your teammate can continue playing."
      : "Are you sure you want to forfeit and leave the match?";
    if (confirm(prompt)) {
      setLeaving(true);
      try {
        await onLeave();
      } finally {
        setLeaving(false);
      }
    }
  }

  const isCoding = roundPhase === "CODING";
  const hasRoundTimer = isCoding && snapshot.roundRemainingSeconds != null;
  const displaySeconds = hasRoundTimer ? snapshot.roundRemainingSeconds! : remainingSeconds;
  const isLowTime = displaySeconds <= 30 && displaySeconds > 0 && isCoding;

  return (
    <header className="flex min-h-14 min-w-0 w-full shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <IconDeviceGamepad2 className="size-5 text-primary" aria-hidden="true" />
          <span>Code Arena</span>
        </div>
        <span className="rounded-none bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground font-mono">
          {mode.toUpperCase()}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">Round {round} / {totalRounds}</span>
          <span>•</span>
          <span className="uppercase tracking-wide">{roundPhase.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-4 text-sm font-medium font-mono tabular-nums">
          <span className="text-foreground">{you.name}: {snapshot.reveal?.totals.you ?? 0}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="text-muted-foreground">{opponent.name}: {snapshot.reveal?.totals.opponent ?? 0}</span>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-none border px-3 py-1 font-mono text-base font-semibold tabular-nums ${
            isLowTime
              ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
              : "border-border bg-background text-foreground"
          }`}
          aria-label={hasRoundTimer ? "Remaining round coding time" : "Remaining match time"}
          title={hasRoundTimer ? `Round: ${formatClock(snapshot.roundRemainingSeconds!)} | Match: ${formatClock(remainingSeconds)}` : `Match: ${formatClock(remainingSeconds)}`}
        >
          <IconClock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{formatClock(displaySeconds)}</span>
          {hasRoundTimer && (
            <span className="text-[10px] uppercase font-normal text-muted-foreground ml-1">round</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connection === "connected" ? (
            <span className="flex items-center gap-1 text-xs text-success" title="Connected">
              <IconWifi className="size-4" aria-hidden="true" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-warning animate-pulse" title={connection}>
              <IconWifiOff className="size-4" aria-hidden="true" />
              <span className="capitalize">{connection}</span>
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            disabled={leaving || pending}
            aria-busy={pendingAction === "leave"}
            aria-label={mode === "2v2" ? "Leave match" : "Forfeit and leave match"}
            className={cn("text-muted-foreground hover:text-destructive", pendingAction === "leave" && "disabled:opacity-100")}
          >
            {pendingAction === "leave"
              ? <IconLoader2 className="size-4 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <IconDoorExit className="size-4 mr-1" aria-hidden="true" />}
            <span>Leave</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
