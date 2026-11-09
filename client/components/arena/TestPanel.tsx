"use client";

import { useState } from "react";
import { IconCheck, IconX, IconClock, IconAlertTriangle } from "@tabler/icons-react";
import type { TestView, VisibleTestStatus } from "@/lib/arena/types";

export interface TestPanelProps {
  tests: TestView[];
  isRunning?: boolean;
}

function StatusBadge({ status }: { status: VisibleTestStatus }) {
  switch (status) {
    case "passed":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          <IconCheck className="size-3.5" aria-hidden="true" />
          <span>Passed</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
          <IconX className="size-3.5" aria-hidden="true" />
          <span>Failed</span>
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning animate-pulse">
          <IconClock className="size-3.5" aria-hidden="true" />
          <span>Running…</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <span>{status}</span>
        </span>
      );
  }
}

export function TestPanel({ tests, isRunning = false }: TestPanelProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (tests.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-muted-foreground">
        {isRunning ? "Running example tests…" : "Click \"Run Tests\" to check your solution against visible examples."}
      </div>
    );
  }

  const current = tests[activeTab] ?? tests[0];

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex border-b border-border bg-secondary/30 px-3 py-1">
        {tests.map((test, idx) => (
          <button
            key={test.id ?? idx}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === idx
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Case {idx + 1}</span>
            <StatusBadge status={test.status} />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-xs font-mono">
        {current && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Status: <strong className="text-foreground">{current.status.toUpperCase()}</strong></span>
              {current.ms !== null && <span>Runtime: {current.ms} ms</span>}
            </div>

            {current.output ? (
              <div>
                <span className="font-semibold text-muted-foreground">Program Output:</span>
                <pre className="mt-1 overflow-x-auto rounded border border-border bg-background p-3 text-foreground whitespace-pre-wrap">
                  {current.output}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No output captured.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
