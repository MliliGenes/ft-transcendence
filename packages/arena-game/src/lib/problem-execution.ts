import type { DriverKind, SnippetOptions, SupportedLanguage } from "./judge-types.js";

interface ProblemExecutionMetadata {
  driver?: DriverKind;
  entrypoint?: string;
  snippets?: Partial<Record<SupportedLanguage, SnippetOptions>>;
}

/** Keep Run, accepted Submit and recovered Submit on the same bank contract. */
export function resolveProblemExecution(problem: ProblemExecutionMetadata, language: SupportedLanguage): {
  driver: DriverKind;
  snippet: SnippetOptions;
} {
  return {
    driver: problem.driver ?? (language === "Python" ? "snippet" : "stdio"),
    snippet: { entrypoint: problem.entrypoint, ...problem.snippets?.[language] },
  };
}
