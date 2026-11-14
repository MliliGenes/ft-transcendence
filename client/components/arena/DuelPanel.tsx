'use client';

import type { ArenaSnapshot, SideView } from '@/lib/arena/types';

export interface DuelPanelProps {
  snapshot: ArenaSnapshot;
}

function PlayerCard({ side, isYou }: { side: SideView; isYou: boolean }) {
  const isOnline = side.presence === 'online';

  return (
    <div className="flex items-center justify-between rounded-none border border-border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="flex size-7 items-center justify-center rounded-none bg-secondary text-xs font-semibold text-secondary-foreground font-mono">
            {side.name.slice(0, 1).toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-none ring-2 ring-card ${
              isOnline ? 'bg-success' : 'bg-muted-foreground'
            }`}
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">
            {side.name} {isYou && <span className="text-primary">(You)</span>}
          </div>
          <div className="text-[11px] text-muted-foreground capitalize">
            {side.status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      <div className="text-right text-[11px] text-muted-foreground">
        <div>
          Submissions:{' '}
          <strong className="text-foreground font-mono tabular-nums">
            {side.submissions}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function DuelPanel({ snapshot }: DuelPanelProps) {
  const { mode, you, opponent, ready } = snapshot;

  if (mode === '2v2') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Your Team (Alpha)</span>
            <span
              className={`text-[11px] font-medium ${ready.you && ready.mate ? 'text-success' : 'text-muted-foreground'}`}
            >
              {ready.you && ready.mate ? 'Team Ready' : 'Waiting for ready…'}
            </span>
          </div>
          <PlayerCard side={you} isYou={true} />
          <PlayerCard side={snapshot.alpha.members[1]} isYou={false} />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground">
            Opponents (Beta)
          </div>
          <PlayerCard side={opponent} isYou={false} />
          <PlayerCard side={snapshot.beta.members[1]} isYou={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <PlayerCard side={you} isYou={true} />
      <PlayerCard side={opponent} isYou={false} />
    </div>
  );
}
