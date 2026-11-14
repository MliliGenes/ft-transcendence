'use client';

import { useState } from 'react';
import { IconCheck, IconX, IconClock, IconAward } from '@tabler/icons-react';
import type {
  RevealView,
  TestView,
  VisibleTestStatus,
} from '@/lib/arena/types';

export interface TestPanelProps {
  tests: TestView[];
  isRunning?: boolean;
  reveal?: RevealView | null;
}

function StatusBadge({ status }: { status: VisibleTestStatus }) {
  switch (status) {
    case 'passed':
      return (
        <span className="inline-flex items-center gap-1 rounded-none bg-success/15 px-2 py-0.5 text-xs font-medium text-success font-mono">
          <IconCheck className="size-3.5" aria-hidden="true" />
          <span>Passed</span>
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-none bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger font-mono">
          <IconX className="size-3.5" aria-hidden="true" />
          <span>Failed</span>
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 rounded-none bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning animate-pulse font-mono">
          <IconClock className="size-3.5" aria-hidden="true" />
          <span>Running…</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-none bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground font-mono">
          <span>{status}</span>
        </span>
      );
  }
}

export function TestPanel({
  tests,
  isRunning = false,
  reveal,
}: TestPanelProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (tests.length === 0 && !reveal) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-muted-foreground">
        {isRunning
          ? 'Running example tests…'
          : 'Click "Run Tests" to check your solution against visible examples.'}
      </div>
    );
  }

  const isRevealTab = reveal && activeTab === tests.length;
  const current = tests[activeTab] ?? tests[0];

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex border-b border-border bg-secondary/30 px-3 py-1 overflow-x-auto">
        {tests.map((test, idx) => (
          <button
            key={test.id ?? idx}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === idx
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Case {idx + 1}</span>
            <StatusBadge status={test.status} />
          </button>
        ))}

        {reveal && (
          <button
            type="button"
            onClick={() => setActiveTab(tests.length)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              isRevealTab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <IconAward className="size-3.5 text-primary" />
            <span>Evaluation Breakdown</span>
            <span className="font-mono tabular-nums text-xs font-bold text-primary">
              +{reveal.roundScore}
            </span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-xs font-mono">
        {isRevealTab && reveal ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-semibold text-foreground text-sm">
                Round Evaluation Result
              </span>
              <span className="text-base font-bold text-primary font-mono tabular-nums">
                +{reveal.roundScore} pts
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground font-semibold">
                Test Groups:
              </div>
              {reveal.groups.map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border border-border p-2.5 rounded-none bg-background"
                >
                  <span className="text-foreground">
                    {g.name} (weight: {g.weight})
                  </span>
                  <span
                    className={`font-bold tabular-nums ${g.earned > 0 ? 'text-success' : 'text-danger'}`}
                  >
                    +{g.earned}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between text-muted-foreground">
              <span>Match Totals:</span>
              <span className="font-mono tabular-nums text-foreground">
                You:{' '}
                <strong className="text-primary">{reveal.totals.you}</strong> |
                Opponent: {reveal.totals.opponent}
              </span>
            </div>
          </div>
        ) : current ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>
                Status:{' '}
                <strong className="text-foreground">
                  {current.status.toUpperCase()}
                </strong>
              </span>
              {current.ms !== null && (
                <span>
                  Runtime:{' '}
                  <span className="font-mono tabular-nums">{current.ms}</span>{' '}
                  ms
                </span>
              )}
            </div>

            {current.output ? (
              <div>
                <span className="font-semibold text-muted-foreground">
                  Program Output:
                </span>
                <pre className="mt-1 overflow-x-auto rounded-none border border-border bg-background p-3 text-foreground whitespace-pre-wrap">
                  {current.output}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                No output captured.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
