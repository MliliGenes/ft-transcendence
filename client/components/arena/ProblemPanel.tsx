"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ArenaProblem } from "@/lib/arena/types";

export interface ProblemPanelProps {
  problem: ArenaProblem;
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card p-5 text-card-foreground">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{problem.title}</h2>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-sm text-foreground/90">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {problem.description}
        </ReactMarkdown>
      </div>

      {problem.constraints && problem.constraints.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Constraints
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground font-mono">
            {problem.constraints.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {problem.examples && problem.examples.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Examples
          </h3>
          {problem.examples.map((example, idx) => (
            <div key={example.id ?? idx} className="rounded border border-border bg-background p-3 text-xs font-mono">
              <div className="mb-2">
                <span className="font-semibold text-muted-foreground">Input:</span>
                <pre className="mt-1 overflow-x-auto rounded bg-secondary/50 p-2 text-foreground">
                  {example.input}
                </pre>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Output:</span>
                <pre className="mt-1 overflow-x-auto rounded bg-secondary/50 p-2 text-foreground">
                  {example.expected}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
