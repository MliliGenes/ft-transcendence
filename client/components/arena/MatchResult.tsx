'use client';

import Link from 'next/link';
import { IconTrophy, IconArrowLeft } from '@tabler/icons-react';
import type { MatchFinalView, RevealView } from '@/lib/arena/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MatchResultProps {
  final: MatchFinalView;
  rounds?: RevealView[];
}

export function MatchResult({ final, rounds = [] }: MatchResultProps) {
  const isWinner = final.you > final.opponent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-lg rounded-none border border-border bg-card p-8 text-center text-card-foreground">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <IconTrophy className="size-8" />
        </div>

        {rounds.length > 0 && (
          <div className="mb-6 border-b border-border pb-4 text-left">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Round scores</h3>
            <div className="space-y-1">
              {rounds.map((round) => (
                <div key={round.round} className="flex justify-between font-mono text-sm tabular-nums">
                  <span>Problem {round.round}</span>
                  <span>{round.roundScore} : {round.opponentRoundScore}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          {final.outcome}
        </h2>

        <div className="my-6 flex items-center justify-center gap-8 border-t border-b border-border py-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Your Score
            </div>
            <div
              className={`font-mono text-3xl font-bold tabular-nums ${isWinner ? 'text-primary' : 'text-foreground'}`}
            >
              {final.you}
            </div>
          </div>
          <div className="text-xl font-bold text-muted-foreground">:</div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Opponent
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums text-muted-foreground">
              {final.opponent}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/play"
            className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}
          >
            <IconArrowLeft className="size-4 mr-2" />
            <span>Return to Play Lobby</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
