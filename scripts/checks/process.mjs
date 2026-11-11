import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const isMain = (url) => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
export const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function run(command, args, { cwd = root, env = process.env, capture = false, allowFailure = false, signal, input } = {}) {
  return new Promise((resolveResult, reject) => {
    signal?.throwIfAborted();
    // Each managed command owns a process group, including npm/Vitest children.
    const grouped = process.platform !== 'win32';
    const child = spawn(command, args, { cwd, env, detached: grouped, stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'] });
    let stdout = '', stderr = '', killTimer;
    const kill = (kind) => {
      try { if (child.pid) process.kill(grouped ? -child.pid : child.pid, kind); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    const groupExists = () => {
      try { process.kill(grouped ? -child.pid : child.pid, 0); return true; }
      catch (error) { if (error.code === 'ESRCH') return false; throw error; }
    };
    const abort = () => {
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 2000);
    };
    const detach = () => { signal?.removeEventListener('abort', abort); clearTimeout(killTimer); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout?.on('data', (data) => { stdout += data; });
    child.stderr?.on('data', (data) => { stderr += data; });
    if (input !== undefined) { child.stdin.on('error', () => {}); child.stdin.end(input); }
    child.on('error', (error) => { detach(); reject(error); });
    child.on('close', async (code, exitSignal) => {
      try {
        if (signal?.aborted) {
          const deadline = Date.now() + 2100;
          while (groupExists() && Date.now() < deadline) await delay(20);
          if (groupExists()) { kill('SIGKILL'); await delay(100); }
          throw signal.reason ?? new Error('Command aborted');
        }
        if (code !== 0 && !allowFailure) throw new Error(`${command} failed (exit ${code ?? exitSignal}).${capture ? ' ' + stderr.slice(-2000) : ''}`);
        resolveResult({ code, stdout, stderr });
      } catch (error) { reject(error); }
      finally { detach(); }
    });
  });
}

export async function cli(work) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try { await work(controller.signal); }
  catch (error) { console.error(error.message); process.exitCode = controller.signal.aborted ? 130 : 1; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
