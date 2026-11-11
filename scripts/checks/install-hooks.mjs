import { access, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { root, run, cli, isMain } from './process.mjs';

export async function installHooks() {
  const configured = await run('git', ['config', '--get', 'core.hooksPath'], { capture: true, allowFailure: true });
  if (configured.code !== 0 && configured.code !== 1) throw new Error('Cannot read Git hook configuration.');
  if (configured.stdout.trim() && configured.stdout.trim() !== '.githooks') throw new Error('Existing core.hooksPath is configured; integrate the Nook hooks there rather than overwrite it.');
  if (!configured.stdout.trim()) {
    const hooks = (await run('git', ['rev-parse', '--git-path', 'hooks'], { capture: true })).stdout.trim();
    for (const name of ['pre-commit', 'pre-push']) {
      try { await access(join(hooks, name), constants.X_OK); }
      catch { continue; }
      throw new Error(`Existing ${name} hook found; preserve it and integrate the scanner manually.`);
    }
  }
  for (const name of ['pre-commit', 'pre-push']) await chmod(join(root, '.githooks', name), 0o755);
  await run('git', ['config', '--local', 'core.hooksPath', '.githooks']);
  console.log('Installed repository-local staged and pre-push secret hooks.');
}
if (isMain(import.meta.url)) await cli(installHooks);
