import { JudgeInfraError, type SnippetOptions, type SupportedLanguage } from "./judge-types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INT64_MIN = -(1n << 63n);
const INT64_MAX = (1n << 63n) - 1n;

function validateSnippetConfig(language: SupportedLanguage, options?: SnippetOptions): void {
  if (language !== "C" && language !== "C++") {
    throw new JudgeInfraError("unsupported compiled snippet configuration");
  }
  if (options?.signature !== "int64-array" || !options.entrypoint) {
    throw new JudgeInfraError("unsupported compiled snippet configuration");
  }
  if (!IDENTIFIER_PATTERN.test(options.entrypoint)) {
    throw new JudgeInfraError("unsupported compiled snippet configuration");
  }
  if (language === "C++" && (!options.className || !IDENTIFIER_PATTERN.test(options.className))) {
    throw new JudgeInfraError("unsupported compiled snippet configuration");
  }
}

function parseIntegerArrayInput(input: string): string[] {
  // Parse only a single integer-array assignment. Never evaluate bank input on the host.
  const match = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*\[\s*((?:[+-]?\d+\s*(?:,\s*[+-]?\d+\s*)*)?)\]\s*$/.exec(input);
  if (!match) throw new JudgeInfraError("invalid integer-array test input");
  const raw = match[1]!.trim();
  const values = raw ? raw.split(",").map((value) => value.trim()) : [];
  if (values.length > 100000) {
    throw new JudgeInfraError("integer-array test input exceeds its ABI bounds");
  }
  for (const value of values) {
    const bi = BigInt(value);
    if (bi < INT64_MIN || bi > INT64_MAX) {
      throw new JudgeInfraError("integer-array test input exceeds its ABI bounds");
    }
  }
  return values;
}

function generateCppHarness(source: string, className: string, entrypoint: string): string {
  return `${source}\n#include <iostream>
#include <vector>
int main() {
  int n;
  if (!(std::cin >> n) || n < 0 || n > 100000) return 1;
  std::vector<long long> values(n);
  for (int i = 0; i < n; ++i) if (!(std::cin >> values[i])) return 1;
  std::cout << ${className}().${entrypoint}(values) << '\\n';
  return 0;
}\n`;
}

function generateCHarness(source: string, entrypoint: string): string {
  return `${source}\n#include <stdio.h>\n#include <stdlib.h>
int main(void) {
  int n;
  if (scanf("%d", &n) != 1 || n < 0 || n > 100000) return 1;
  long long *values = malloc((n ? n : 1) * sizeof(long long));
  if (!values) return 1;
  for (int i = 0; i < n; ++i) if (scanf("%lld", &values[i]) != 1) { free(values); return 1; }
  long long result = ${entrypoint}(values, n);
  printf("%lld\\n", result);
  free(values);
  return 0;
}\n`;
}

/** Only trusted bank metadata chooses an ABI; contestant source is never inspected. */
export function prepareCompiledSnippet(
  language: SupportedLanguage,
  source: string,
  input: string,
  options?: SnippetOptions,
): { source: string; input: string } {
  validateSnippetConfig(language, options);
  const values = parseIntegerArrayInput(input);
  const compiledSource = language === "C++"
    ? generateCppHarness(source, options!.className!, options!.entrypoint!)
    : generateCHarness(source, options!.entrypoint!);
  return {
    source: compiledSource,
    input: `${values.length}\n${values.join(" ")}\n`,
  };
}
