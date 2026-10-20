import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prepareCompiledSnippet } from "./compiled-snippet.js";
import {
  type CaseResult,
  type DriverKind,
  type ExecutionStatus,
  JudgeInfraError,
  type JudgeLimits,
  type SealedEvaluationRequest,
  type SealedGroupResult,
  type SnippetOptions,
  type SupportedLanguage,
  type VisibleTest,
  type GameJudge,
} from "./judge-types.js";

/**
 * Each test case runs in its own one-shot container. The caller keeps expected
 * answers and the rest of a suite in trusted memory and compares output only
 * after the isolated process exits.
 */
export interface ContainerJudgeOptions {
  dockerBin?: string;
  images?: Partial<Record<SupportedLanguage, string>>;
  outerTimeoutMs?: number;
}

const DEFAULT_IMAGES: Record<SupportedLanguage, string> = {
  Python: "python:3.12-slim",
  "C++": "gcc:14-bookworm",
  C: "gcc:14-bookworm",
};

const MAX_CASE_PAYLOAD_BYTES = 8 * 1024 * 1024;

const SOURCE_FILE: Record<SupportedLanguage, string> = {
  Python: "player.py",
  "C++": "player.cpp",
  C: "player.c",
};

/**
 * Runs exactly one Python snippet input. It reports output and execution
 * status, never a pass bit or expected answer. The trusted caller decides
 * whether `comparison_b64` matches the expected value.
 */
const SNIPPET_DRIVER = String.raw`
import importlib.util, inspect, os, signal, sys
class Timeout(Exception): pass
def _alarm_handler(signum, frame): raise Timeout()
def _fail(status, message=""):
    if message:
        os.write(2, (message + "\n").encode("utf8", "replace"))
    code = {
        "compile_error": 20,
        "runtime_error": 21,
        "internal_error": 22,
        "time_limit_exceeded": 124,
    }.get(status, 21)
    raise SystemExit(code)
def main():
    bound = int(sys.argv[1])
    with open("/scratch/input.txt", "r", encoding="utf8") as input_file:
        input_code = input_file.read()
    os.environ.pop("INP", None)
    entry = os.environ.pop("ENTRYPOINT", "")
    # Runner-only values are removed before submitted code is imported.
    os.environ.pop("SRC", None); os.environ.pop("DRV", None)
    # The player's Python writes go to the display channel. Stdout carries only
    # the candidate comparison bytes; the shell writes the runner record after
    # this process and all of its atexit handlers have exited.
    sys.stdout = sys.stderr
    spec = importlib.util.spec_from_file_location("player", "/scratch/player.py")
    player = importlib.util.module_from_spec(spec)
    signal.signal(signal.SIGALRM, _alarm_handler)
    signal.alarm(max(1, bound))
    try:
        spec.loader.exec_module(player)
    except Timeout:
        signal.alarm(0); _fail("time_limit_exceeded", "execution timed out during import")
    except Exception as error:
        signal.alarm(0)
        status = "compile_error" if isinstance(error, SyntaxError) else "runtime_error"
        _fail(status, f"{type(error).__name__}: {error}")
    signal.alarm(0)
    functions = [(name, fn) for name, fn in inspect.getmembers(player, inspect.isfunction)
                 if getattr(fn, "__module__", None) == "player" and not name.startswith("_")]
    solution_class = getattr(player, "Solution", None)
    methods = [(name, fn) for name, fn in inspect.getmembers(solution_class, inspect.isfunction)
               if getattr(fn, "__module__", None) == "player" and not name.startswith("_")] if inspect.isclass(solution_class) else []
    use_solution = False
    if entry:
        function = getattr(player, entry, None)
        if callable(function):
            functions = [(entry, function)]
        else:
            functions = [(name, fn) for name, fn in methods if name == entry]
            use_solution = True
            if not functions:
                _fail("runtime_error", f"missing entrypoint {entry}")
    elif not functions and methods:
        functions = methods
        use_solution = True
    if len(functions) != 1:
        _fail("runtime_error", "ambiguous entry")
    values = {}
    try:
        exec(compile(input_code, "input", "exec"), values)
    except Exception as error:
        _fail("internal_error", f"invalid test input: {type(error).__name__}")
    args = [value for name, value in values.items() if not name.startswith("__")]
    signal.signal(signal.SIGALRM, _alarm_handler); signal.alarm(max(1, bound))
    try:
        target = getattr(solution_class(), functions[0][0]) if use_solution else functions[0][1]
        result = target(*args)
    except Timeout:
        _fail("time_limit_exceeded", "execution timed out")
    except Exception as error:
        os.write(1, repr(f"{type(error).__name__}: {error}").encode("utf8", "replace"))
        _fail("runtime_error", f"{type(error).__name__}: {error}")
    finally:
        signal.alarm(0)
    os.write(1, repr(result).encode("utf8", "replace"))
if __name__ == "__main__": main()
`;

interface CaseInput {
  id: string;
  input: string;
  expected: string;
}

interface RawExecution {
  status: ExecutionStatus;
  output: string;
  comparison: string;
  ms: number;
}

interface TrustedVerdict extends RawExecution {
  id: string;
  passed: boolean;
}

interface RunnerRecord {
  status?: unknown;
  output_b64?: unknown;
  comparison_b64?: unknown;
  ms?: unknown;
}

const EXECUTION_STATUSES = new Set<ExecutionStatus>([
  "accepted",
  "compile_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
  "process_limit_exceeded",
  "internal_error",
]);

function decodeBase64(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function parseRunnerRecord(stdout: string): RawExecution | null {
  // The shell writes one record after the candidate process has exited. Do
  // not accept a record embedded in or appended to contestant output.
  let parsed: RunnerRecord;
  try {
    parsed = JSON.parse(stdout.trim()) as RunnerRecord;
  } catch {
    return null;
  }
  if (typeof parsed.status !== "string" || !EXECUTION_STATUSES.has(parsed.status as ExecutionStatus)) return null;
  if (typeof parsed.output_b64 !== "string" || typeof parsed.comparison_b64 !== "string") return null;
  return {
    status: parsed.status as ExecutionStatus,
    output: decodeBase64(parsed.output_b64),
    comparison: decodeBase64(parsed.comparison_b64),
    ms: typeof parsed.ms === "number" && Number.isFinite(parsed.ms) && parsed.ms >= 0 ? parsed.ms : 0,
  };
}

function verdictFromContainerExit(code: number): ExecutionStatus {
  if (code === 124 || code === 143) return "time_limit_exceeded";
  if (code === 137) return "memory_limit_exceeded";
  return "internal_error";
}

function expectedMatches(language: SupportedLanguage, driver: DriverKind, actual: string, expected: string): boolean {
  if (driver === "snippet" && language === "Python") return actual.trim() === expected.trim();
  // Match shell command substitution's removal of trailing line feeds while
  // preserving spaces and carriage returns in stdio answers.
  return actual.replace(/\n+$/, "") === expected.replace(/\n+$/, "");
}

export class ContainerJudge implements GameJudge {
  readonly provider = "container";
  private readonly dockerBin: string;
  private readonly images: Record<SupportedLanguage, string>;
  private readonly outerTimeoutMs: number;

  constructor(options: ContainerJudgeOptions = {}) {
    this.dockerBin = options.dockerBin ?? "docker";
    this.images = { ...DEFAULT_IMAGES, ...options.images };
    this.outerTimeoutMs = options.outerTimeoutMs ?? 240000;
  }

  async runVisible(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    tests: VisibleTest[],
    limits: JudgeLimits,
    snippet?: SnippetOptions,
  ): Promise<CaseResult[]> {
    const results: CaseResult[] = [];
    for (const test of tests) {
      const verdict = await this.runCase(language, driver, source, snippet, test, limits);
      results.push({
        id: test.id,
        passed: verdict.passed,
        status: verdict.status,
        output: verdict.output.slice(0, 4000),
        runtimeMs: verdict.ms,
      });
    }
    return results;
  }

  async evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }> {
    const groups: SealedGroupResult[] = [];
    for (const group of request.groups) {
      const results: SealedGroupResult["results"] = [];
      for (const test of group.tests) {
        const verdict = await this.runCase(
          request.language,
          request.driver,
          request.source,
          request,
          test,
          request.limits,
        );
        results.push({
          id: test.id,
          passed: verdict.passed,
          status: verdict.status,
          runtimeMs: verdict.ms,
        });
      }
      groups.push({ name: group.name, weight: group.weight, results });
    }
    return { groups };
  }

  private async runCase(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    snippet: SnippetOptions | undefined,
    test: CaseInput,
    limits: JudgeLimits,
  ): Promise<TrustedVerdict> {
    const compiled = driver === "snippet" && language !== "Python"
      ? prepareCompiledSnippet(language, source, test.input, snippet) : undefined;
    const execution = await this.executeOneCase({
      language, driver: compiled ? "stdio" : driver, source: compiled?.source ?? source,
      entrypoint: snippet?.entrypoint, input: compiled?.input ?? test.input, limits,
    });
    const passed = execution.status === "accepted"
      && expectedMatches(language, driver, execution.comparison, test.expected);
    return {
      id: test.id,
      passed,
      status: execution.status,
      output: execution.output,
      comparison: execution.comparison,
      ms: execution.ms,
    };
  }

  private executeOneCase(input: {
    language: SupportedLanguage;
    driver: DriverKind;
    source: string;
    entrypoint?: string;
    input: string;
    limits: JudgeLimits;
  }): Promise<RawExecution> {
    const image = this.images[input.language];
    const containerName = `arena-judge-${randomUUID()}`;
    const memory = `${input.limits.runMemoryMb}m`;
    const source = Buffer.from(input.source, "utf8");
    const caseInput = Buffer.from(input.input, "utf8");
    const driver = Buffer.from(SNIPPET_DRIVER, "utf8");
    if (source.length + caseInput.length + driver.length > MAX_CASE_PAYLOAD_BYTES) {
      throw new JudgeInfraError("judge case payload exceeds transport limit");
    }
    // Byte-length framing keeps source/current input off argv and out of the
    // environment. No expected answer or sibling case enters this payload.
    const payload = Buffer.concat([
      Buffer.from(`${source.length}\n${caseInput.length}\n${driver.length}\n`, "ascii"),
      source, caseInput, driver,
    ]);
    const args = [
      "run",
      "--interactive",
      "--rm",
      "--name",
      containerName,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--network",
      "none",
      "--cpus",
      String(input.limits.runCpus),
      "--memory",
      memory,
      "--memory-swap",
      memory,
      "--pids-limit",
      String(input.limits.runPids),
      "--read-only",
      "--tmpfs",
      `/scratch:rw,exec,size=${memory},mode=1777`,
      "--tmpfs",
      `/tmp:rw,exec,size=${memory},mode=1777`,
      "--workdir",
      "/scratch",
      "--user",
      "nobody",
      "-e",
      `ENTRY=${input.entrypoint ?? ""}`,
      image,
      "bash",
      "-c",
      this.oneCaseScript(input.language, input.driver, input.limits),
    ];

    const outputCap = Math.max(1, Math.floor(input.limits.runOutputBytes));
    const maxBuffer = Math.max(64 * 1024, Math.ceil((outputCap + 1) * 4 / 3) + 16 * 1024);
    const pythonSnippet = input.language === "Python" && input.driver === "snippet";

    return new Promise<RawExecution>((resolve, reject) => {
      const child = execFile(
        this.dockerBin,
        args,
        { timeout: this.outerTimeoutMs, maxBuffer, killSignal: "SIGKILL" },
        async (error, stdout, stderr) => {
          const errorCode = (error as NodeJS.ErrnoException | null)?.code;
          const captureAborted = errorCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
          const clientStopped = Boolean(error?.killed) || errorCode === "ETIMEDOUT";
          if (captureAborted || clientStopped) {
            // Killing the Docker client does not stop its daemon-owned job.
            // Wait for a bounded cleanup attempt before releasing this case.
            await new Promise<void>((done) => {
              execFile(this.dockerBin, ["rm", "-f", containerName],
                { timeout: 5000, maxBuffer: 64 * 1024, killSignal: "SIGKILL" }, () => done());
            });
          }
          const code = typeof (error as { code?: unknown } | null)?.code === "number"
            ? (error as { code: number }).code
            : 0;
          if (clientStopped && !captureAborted) {
            reject(new JudgeInfraError("judge orchestrator timeout"));
            return;
          }
          // String error codes (ENOENT/EACCES/ERR_CHILD_PROCESS_*) mean Docker
          // never returned a container verdict. Do not turn launch failures
          // into competitive failures or phantom Submit counts.
          if (error && typeof (error as { code?: unknown }).code === "string") {
            if (pythonSnippet && (error as NodeJS.ErrnoException).code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
              resolve({
                status: "output_limit_exceeded",
                output: stderr.slice(0, 4000),
                comparison: "",
                ms: 0,
              });
              return;
            }
            reject(new JudgeInfraError(`judge launch failed: ${(error as Error).message}`));
            return;
          }
          if (code !== 0) {
            if ([124, 137, 143].includes(code)) {
              resolve({ status: verdictFromContainerExit(code), output: "", comparison: "", ms: 0 });
            } else {
              reject(new JudgeInfraError(`judge runner exited without a verdict (code ${code})`));
            }
            return;
          }
          const record = parseRunnerRecord(stdout);
          if (!record) {
            resolve({ status: "internal_error", output: "", comparison: "", ms: 0 });
            return;
          }
          if (pythonSnippet) {
            const display = stderr
              ? `${stderr}${stderr.endsWith("\n") || !record.output ? "" : "\n"}${record.output}`
              : record.output;
            if (Buffer.byteLength(stderr, "utf8") + Buffer.byteLength(record.comparison, "utf8") > outputCap) {
              resolve({
                status: "output_limit_exceeded",
                output: Buffer.from(display, "utf8").subarray(0, outputCap).toString("utf8"),
                comparison: "",
                ms: record.ms,
              });
              return;
            }
            resolve({ ...record, output: display });
            return;
          }
          resolve(record);
        },
      );
      // A launch failure/host timeout can close stdin early. The exec callback
      // owns the authoritative launch verdict and bounded container cleanup.
      child.stdin?.on("error", () => {});
      child.stdin?.end(payload);
    });
  }

  private oneCaseScript(language: SupportedLanguage, driver: DriverKind, limits: JudgeLimits): string {
    const file = SOURCE_FILE[language];
    const runSeconds = Math.max(1, Math.ceil(limits.runWallMs / 1000));
    const compileSeconds = Math.max(1, Math.ceil(limits.compileWallMs / 1000));
    const cap = Math.max(1, Math.floor(limits.runOutputBytes));
    const compiler = language === "C++" ? "g++" : "gcc";
    const compile = language === "Python"
      ? `timeout ${compileSeconds} python3 -m py_compile ${file} 2> compile.err`
      : `timeout ${compileSeconds} ${compiler} -O2 -o prog ${file} 2> compile.err`;
    const prog = language === "Python" ? "python3 player.py" : "./prog";

    const prefix = [
      "IFS= read -r SOURCE_BYTES && IFS= read -r INPUT_BYTES && IFS= read -r DRIVER_BYTES || exit 70",
      `for LENGTH in "$SOURCE_BYTES" "$INPUT_BYTES" "$DRIVER_BYTES"; do [[ "$LENGTH" =~ ^[0-9]{1,8}$ ]] && [ "$LENGTH" -le ${MAX_CASE_PAYLOAD_BYTES} ] || exit 70; done`,
      `[ "$((SOURCE_BYTES + INPUT_BYTES + DRIVER_BYTES))" -le ${MAX_CASE_PAYLOAD_BYTES} ] || exit 70`,
      `head -c "$SOURCE_BYTES" > ${file}; [ "$(wc -c < ${file})" -eq "$SOURCE_BYTES" ] || exit 70`,
      `head -c "$INPUT_BYTES" > input.txt; [ "$(wc -c < input.txt)" -eq "$INPUT_BYTES" ] || exit 70`,
      `head -c "$DRIVER_BYTES" > driver.py; [ "$(wc -c < driver.py)" -eq "$DRIVER_BYTES" ] || exit 70`,
      "unset SOURCE_BYTES INPUT_BYTES DRIVER_BYTES LENGTH",
      `export ENTRYPOINT="$ENTRY"`,
      "unset SRC INP DRV ENTRY",
      "emit_result() { printf '{\"status\":\"%s\",\"output_b64\":\"%s\",\"comparison_b64\":\"%s\",\"ms\":%s}\\n' \"$1\" \"$2\" \"$3\" \"$4\"; }",
      `${compile}`,
      "COMPILE_STATUS=$?",
      `if [ "$COMPILE_STATUS" = 124 ]; then OUTPUT_B64=$(head -c ${cap} compile.err | base64 -w0); emit_result time_limit_exceeded "$OUTPUT_B64" '' 0; exit 0; fi`,
      `if [ "$COMPILE_STATUS" != 0 ]; then OUTPUT_B64=$(head -c ${cap} compile.err | base64 -w0); emit_result compile_error "$OUTPUT_B64" '' 0; exit 0; fi`,
    ];

    if (driver === "snippet") {
      prefix.push(
        "set +e",
        "START_NS=$(date +%s%N)",
        `COMPARISON_B64=$(timeout --kill-after=1s ${runSeconds} python3 driver.py ${runSeconds} | head -c ${cap + 1} | base64 -w0; PIPE_CODES=("\${PIPESTATUS[@]}"); exit "\${PIPE_CODES[0]:-1}")`,
        "RUN_STATUS=$?",
        "END_NS=$(date +%s%N)",
        "RUNTIME_MS=$(( (END_NS - START_NS) / 1000000 ))",
        "COMPARISON_BYTES=$(printf '%s' \"$COMPARISON_B64\" | base64 -d | wc -c | tr -d ' ')",
        "OUTPUT_B64=$COMPARISON_B64",
        `if [ "$COMPARISON_BYTES" -gt ${cap} ]; then STATUS=output_limit_exceeded; COMPARISON_B64='';`,
        "elif [ \"$RUN_STATUS\" = 124 ] || [ \"$RUN_STATUS\" = 143 ]; then STATUS=time_limit_exceeded",
        "elif [ \"$RUN_STATUS\" = 137 ]; then STATUS=memory_limit_exceeded",
        "elif [ \"$RUN_STATUS\" = 20 ]; then STATUS=compile_error",
        "elif [ \"$RUN_STATUS\" = 22 ]; then STATUS=internal_error",
        "elif [ \"$RUN_STATUS\" != 0 ]; then STATUS=runtime_error",
        "else STATUS=accepted; fi",
        "emit_result \"$STATUS\" \"$OUTPUT_B64\" \"$COMPARISON_B64\" \"$RUNTIME_MS\"",
      );
      return prefix.join("\n");
    }

    prefix.push(
      "START_NS=$(date +%s%N)",
      "set +e",
      `timeout ${runSeconds} ${prog} < input.txt 2>/dev/null | head -c ${cap + 1} > output.raw`,
      "PIPE_CODES=(\"${PIPESTATUS[@]}\")",
      "RUN_STATUS=${PIPE_CODES[0]:-1}",
      "END_NS=$(date +%s%N)",
      "RUNTIME_MS=$(( (END_NS - START_NS) / 1000000 ))",
      "OUTPUT_BYTES=$(wc -c < output.raw | tr -d ' ')",
      `if [ "$OUTPUT_BYTES" -gt ${cap} ]; then head -c ${cap} output.raw > output.capped; OUTPUT_B64=$(base64 -w0 output.capped); emit_result output_limit_exceeded "$OUTPUT_B64" "$OUTPUT_B64" "$RUNTIME_MS"; exit 0; fi`,
      "OUTPUT_B64=$(base64 -w0 output.raw)",
      "if [ \"$RUN_STATUS\" = 124 ] || [ \"$RUN_STATUS\" = 143 ]; then STATUS=time_limit_exceeded",
      "elif [ \"$RUN_STATUS\" = 137 ]; then STATUS=memory_limit_exceeded",
      "elif [ \"$RUN_STATUS\" != 0 ]; then STATUS=runtime_error",
      "else STATUS=accepted; fi",
      "emit_result \"$STATUS\" \"$OUTPUT_B64\" \"$OUTPUT_B64\" \"$RUNTIME_MS\"",
    );
    return prefix.join("\n");
  }
}
