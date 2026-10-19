import { JudgeInfraError, type SnippetOptions, type SupportedLanguage } from "./judge-types.js";

/** Only trusted bank metadata chooses an ABI; contestant source is never inspected. */
export function prepareCompiledSnippet(language: SupportedLanguage, source: string, input: string, options?: SnippetOptions): { source: string; input: string } {
  if ((language !== "C" && language !== "C++") || options?.signature !== "int64-array" || !options.entrypoint
    || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.entrypoint)
    || (language === "C++" && (!options.className || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.className)))) {
    throw new JudgeInfraError("unsupported compiled snippet configuration");
  }
  // Parse only a single integer-array assignment. Never evaluate bank input on the host.
  const match = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*\[\s*((?:[+-]?\d+\s*(?:,\s*[+-]?\d+\s*)*)?)\]\s*$/.exec(input);
  if (!match) throw new JudgeInfraError("invalid integer-array test input");
  const values = match[1]!.trim() ? match[1]!.split(",").map((value) => value.trim()) : [];
  if (values.length > 100000 || values.some((value) => BigInt(value) < -(1n << 63n) || BigInt(value) >= (1n << 63n))) {
    throw new JudgeInfraError("integer-array test input exceeds its ABI bounds");
  }
  return {
    // Source contains no input, expected answer, or other test cases. Each job receives only its own stdin.
    source: language === "C++" ? `${source}\n#include <iostream>
#include <vector>
int main() {
  int n;
  if (!(std::cin >> n) || n < 0 || n > 100000) return 1;
  std::vector<long long> values(n);
  for (int i = 0; i < n; ++i) if (!(std::cin >> values[i])) return 1;
  std::cout << ${options.className}().${options.entrypoint}(values) << '\\n';
  return 0;
}\n` : `${source}\n#include <stdio.h>\n#include <stdlib.h>
int main(void) {
  int n;
  if (scanf("%d", &n) != 1 || n < 0 || n > 100000) return 1;
  long long *values = malloc((n ? n : 1) * sizeof(long long));
  if (!values) return 1;
  for (int i = 0; i < n; ++i) if (scanf("%lld", &values[i]) != 1) { free(values); return 1; }
  long long result = ${options.entrypoint}(values, n);
  printf("%lld\\n", result);
  free(values);
  return 0;
}\n`,
    input: `${values.length}\n${values.join(" ")}\n`,
  };
}
