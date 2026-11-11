import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm, chmod, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { root, run, cli, isMain } from './process.mjs';

export const version = '8.30.1';
export const scannerPath = join(root, '.tools', `gitleaks-${version}`, 'gitleaks');
const releases = {
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};
export async function installScanner() {
  const platform = `${process.platform}_${process.arch}`;
  const expected = releases[platform];
  if (!expected) throw new Error(`Unsupported scanner platform ${platform}; use Linux/macOS for these checks.`);
  const temporary = await mkdtemp(join(tmpdir(), 'nook-gitleaks-'));
  try {
    const asset = `gitleaks_${version}_${platform}.tar.gz`;
    const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${asset}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Gitleaks download failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(archive).digest('hex') !== expected) throw new Error('Gitleaks SHA-256 mismatch; refusing installation.');
    await writeFile(join(temporary, asset), archive);
    await mkdir(join(root, '.tools', `gitleaks-${version}`), { recursive: true });
    await run('tar', ['xzf', join(temporary, asset), '-C', join(root, '.tools', `gitleaks-${version}`), 'gitleaks']);
    await chmod(scannerPath, 0o755);
    console.log(`Installed verified Gitleaks ${version}.`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
export async function requireScanner() {
  try { await access(scannerPath); }
  catch { throw new Error('Pinned Gitleaks is missing. Run npm run checks:setup first.'); }
  const result = await run(scannerPath, ['version'], { capture: true });
  if (!result.stdout.includes(version)) throw new Error('Unexpected Gitleaks version; rerun npm run checks:setup.');
  return scannerPath;
}
if (isMain(import.meta.url)) await cli(installScanner);
