"use client";

import { useState } from "react";
import { IconClock, IconDeviceGamepad2, IconDoorExit, IconWifi, IconWifiOff } from "@tabler/icons-react";
import type { ArenaSnapshot } from "@/lib/arena/types";
import type { ConnectionState } from "@/lib/arena/transport";
import { Button } from "@/components/ui/button";

export interface ArenaHeaderProps {
  snapshot: ArenaSnapshot;
  connection: ConnectionState;
  onLeave: () => Promise<void>;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ArenaHeader({ snapshot, connection, onLeave }: ArenaHeaderProps) {
  const [leaving, setLeaving] = useState(false);
  const { round, totalRounds, remainingSeconds, mode, roundPhase, you, opponent } = snapshot;

  async function handleLeave() {
    if (confirm("Are you sure you want to forfeit and leave the match?")) {
      setLeaving(true);
      try {
        await onLeave();
      } finally {
        setLeaving(false);
      }
    }
  }

  const isLowTime = remainingSeconds <= 30 && remainingSeconds > 0 && roundPhase === "CODING";

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4 text-card-foreground">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <IconDeviceGamepad2 className="size-5 text-primary" aria-hidden="true" />
          <span>Code Arena</span>
        </div>
        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {mode.toUpperCase()}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Round {round} / {totalRounds}</span>
          <span>•</span>
          <span className="uppercase tracking-wide">{roundPhase.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm font-medium tabular-nums">
          <span className="text-foreground">{you.name}: {snapshot.reveal?.totals.you ?? 0}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="text-muted-foreground">{opponent.name}: {snapshot.reveal?.totals.opponent ?? 0}</span>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded border px-3 py-1 font-mono text-base font-semibold tabular-nums ${
            isLowTime
              ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
              : "border-border bg-background text-foreground"
          }`}
          aria-label="Remaining round time"
        >
          <IconClock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{formatClock(remainingSeconds)}</span>
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
            disabled={leaving}
            aria-label="Forfeit and leave match"
            className="text-muted-foreground hover:text-destructive"
          >
            <IconDoorExit className="size-4 mr-1" aria-hidden="true" />
            <span>Leave</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
