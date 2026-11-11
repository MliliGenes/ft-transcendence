import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { root, run, cli, isMain } from './process.mjs';
import { requireScanner } from './install-scanner.mjs';

// Explicit rollout boundary, not a claim that earlier published history is clean.
export const baseline = 'ecbbfdda3fa52538bd00a192a311f3f8f36ff11e';
export function forbiddenPath(path) {
  const name = basename(path).toLowerCase();
  const example = /\.(example|template)$/.test(name);
  return (!example && (name === '.env' || name.startsWith('.env.') || /(^|\/)envs\/.*\.env$/i.test(path)))
    || /\.key$/i.test(name)
    || /^(envs?|credentials?|secrets?)([._-].*)?\.(zip|tar|gz|tgz|7z)$/i.test(name);
}
const git = async (args, cwd) => (await run('git', args, { cwd, capture: true })).stdout;
function checkPaths(paths) {
  const blocked = [...new Set(paths.filter(forbiddenPath))];
  if (blocked.length) throw new Error(`Credential files/archives cannot be committed: ${blocked.map((p) => JSON.stringify(p)).join(', ')}`);
}
async function runScanner(scanner, args, { snapshot } = {}) {
  const reportDirectory = await mkdtemp(join(tmpdir(), 'nook-scan-report-'));
  try {
    const report = join(reportDirectory, 'findings.json');
    const result = await run(scanner, [...args, '--report-format', 'json', '--report-path', report], { capture: true, allowFailure: true });
    if (result.code !== 0) {
      let locations = [];
      try {
        locations = JSON.parse(await readFile(report, 'utf8')).slice(0, 10).map((item) => ({
          file: snapshot ? item.File.replace(snapshot + sep, '') : item.File,
          line: item.StartLine, rule: item.RuleID,
        }));
      } catch { /* Scanner/config failures may have no findings report. */ }
      // Never print matched text, secret values or raw report content.
      throw new Error(`Scanner exited ${result.code}. ${locations.length ? JSON.stringify(locations) : 'Run checks:setup and check scanner/config availability.'}`);
    }
  } finally { await rm(reportDirectory, { recursive: true, force: true }); }
}
async function scanIndex(cwd) {
  const scanner = await requireScanner();
  const paths = (await git(['ls-files', '-z'], cwd)).split('\0').filter(Boolean);
  checkPaths(paths);
  const directory = await mkdtemp(join(tmpdir(), 'nook-index-scan-'));
  try {
    await run('git', ['checkout-index', '--all', `--prefix=${directory}${sep}`], { cwd, capture: true });
    await runScanner(scanner, ['dir', directory, '--config', join(root, '.gitleaks.toml'), '--redact', '--no-banner', '--no-color', '--log-level', 'warn', '--max-archive-depth', '3'], { snapshot: directory });
  } catch (error) { throw new Error(`Secret/credential scan failed: ${error.message}`); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
export async function scanStaged({ cwd = root } = {}) { await scanIndex(cwd); }
export async function scanTree({ cwd = root } = {}) { await scanIndex(cwd); }

export async function scanHistory(range, { cwd = root } = {}) {
  if (!/^[a-f0-9]{40,64}\.\.(HEAD|[a-f0-9]{40,64})$/.test(range)) throw new Error('Expected an explicit commit range for secret scanning.');
  const scanner = await requireScanner();
  const commits = (await git(['rev-list', range], cwd)).trim().split('\n').filter(Boolean);
  for (const commit of commits) {
    const paths = (await git(['diff-tree', '--root', '-m', '--no-commit-id', '--name-only', '-z', '-r', '--diff-filter=ACMR', commit], cwd)).split('\0').filter(Boolean);
    checkPaths(paths);
  }
  if (!commits.length) return;
  try {
    await runScanner(scanner, ['git', cwd, `--log-opts=--full-history -m ${range}`, '--config', join(root, '.gitleaks.toml'), '--redact', '--no-banner', '--no-color', '--log-level', 'warn', '--max-archive-depth', '3']);
  } catch (error) { throw new Error(`Secret/credential history scan failed: ${error.message}`); }
}
async function requireBaseline(commit = 'HEAD', cwd = root) {
  try { await run('git', ['merge-base', '--is-ancestor', baseline, commit], { cwd, capture: true }); }
  catch { throw new Error('Reviewed integration baseline is missing from this history; merge it before running the gate.'); }
}
export async function scanCI({ cwd = root } = {}) {
  await requireBaseline('HEAD', cwd);
  await scanTree({ cwd });
  await scanHistory(`${baseline}..HEAD`, { cwd });
}
async function main() {
  const mode = process.argv[2] ?? 'staged';
  if (mode === 'staged') await scanStaged();
  else if (mode === 'ci') {
    await scanCI();
  } else if (mode === 'push') {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    for (const line of input.trim().split('\n').filter(Boolean)) {
      const fields = line.split(/\s+/);
      if (fields.length !== 4 || !fields[1].match(/^[a-f0-9]{40,64}$/) || !fields[3].match(/^[a-f0-9]{40,64}$/)) throw new Error('Invalid pre-push ref input.');
      const [, local, , remote] = fields;
      if (/^0+$/.test(local)) continue; // branch deletion has no new content
      await requireBaseline(local);
      await scanHistory(`${/^0+$/.test(remote) ? baseline : remote}..${local}`);
    }
  } else throw new Error('Use staged, ci or push.');
  console.log('Secret prevention passed (historical incident remains separately tracked).');
}
if (isMain(import.meta.url)) await cli(main);
