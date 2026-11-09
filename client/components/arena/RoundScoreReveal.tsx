"use client";

import { IconAward, IconCheck, IconPlayerPlay } from "@tabler/icons-react";
import type { RevealView } from "@/lib/arena/types";
import { Button } from "@/components/ui/button";

export interface RoundScoreRevealProps {
  reveal: RevealView | null;
  round: number;
  totalRounds: number;
  onAdvance: () => Promise<void>;
}

export function RoundScoreReveal({ reveal, round, totalRounds, onAdvance }: RoundScoreRevealProps) {
  if (!reveal) return null;

  const isFinalRound = round >= totalRounds;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-md rounded-none border border-border bg-card p-6 text-card-foreground">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
          <IconAward className="size-5" />
          <span>Round {round} Score Reveal</span>
        </div>

        <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {reveal.roundScore} <span className="text-sm font-normal text-muted-foreground">points earned</span>
        </h3>

        <div className="mt-4 space-y-2 border-t border-b border-border py-3 text-xs">
          <div className="font-semibold text-muted-foreground">Hidden Test Evaluation:</div>
          {reveal.groups.map((g, idx) => (
            <div key={idx} className="flex items-center justify-between font-mono tabular-nums">
              <span className="text-foreground">{g.name} (weight: {g.weight})</span>
              <span className={`font-semibold ${g.earned > 0 ? "text-success" : "text-danger"}`}>
                +{g.earned}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm font-medium tabular-nums">
          <span>Match Totals:</span>
          <span className="font-mono text-foreground">
            You: <strong className="text-primary">{reveal.totals.you}</strong> | Opponent: <strong>{reveal.totals.opponent}</strong>
          </span>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onAdvance} className="w-full">
            <IconPlayerPlay className="size-4 mr-2" />
            <span>{isFinalRound ? "View Match Results" : "Next Round"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
