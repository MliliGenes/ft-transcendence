export const GAME_SHUTDOWN_DEADLINE_MS = 5000;
export interface RuntimeCloseOptions {
  stop: () => Promise<void>;
  disconnectSockets: () => void;
  stopHttpAcceptance: () => void;
  closeApplication: () => Promise<void>;
  exit: (code: number) => void;
  report: (error: unknown) => void;
}
export function createRuntimeCloser(options: RuntimeCloseOptions): (error?: Error) => Promise<void> {
  let closing: Promise<void> | undefined;
  let exitCode = 0;
  let exited = false;
  const exitOnce = (code: number) => {
    if (!exited) { exited = true; options.exit(code); }
  };
  const report = (error: unknown) => {
    exitCode = 1;
    try { options.report(error); } catch { /* Reporting cannot block cleanup. */ }
  };
  return (error?: Error) => {
    if (error) exitCode = 1;
    if (closing) return closing;
    let finish!: () => void;
    // Publish the promise before invoking hooks; hooks can re-enter close.
    closing = new Promise<void>((resolve) => { finish = resolve; });
    const deadline = setTimeout(() => exitOnce(1), GAME_SHUTDOWN_DEADLINE_MS);
    let stopped: Promise<void>;
    try { stopped = options.stop(); }
    catch (stopError) { stopped = Promise.reject(stopError); }
    try { options.stopHttpAcceptance(); } catch (closeError) { report(closeError); }
    try { options.disconnectSockets(); } catch (closeError) { report(closeError); }
    void Promise.allSettled([stopped, Promise.resolve().then(options.closeApplication)])
      .then((results) => {
        for (const result of results) {
          if (result.status === "rejected") report(result.reason);
        }
        clearTimeout(deadline);
        try { exitOnce(exitCode); } finally { finish(); }
      });
    return closing;
  };
}
