import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { forbiddenPath, scanStaged, scanHistory, scanTree } from '../secrets.mjs';
import { assertNoNulTextFiles } from '../text-files.mjs';

function repository(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nook-secret-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(dir, 'readme.txt'), 'safe'); git('add', '.'); git('commit', '-qm', 'baseline');
  return { dir, git, base: git('rev-parse', 'HEAD').trim() };
}
const syntheticKey = () => ['-----BEGIN ', 'PRIVATE KEY-----\n', 'A'.repeat(80), '\n-----END PRIVATE KEY-----'].join('');

test('credential files and archives are blocked while examples are permitted', () => {
  for (const path of ['.env', '.env.production', 'envs/user-auth.env', 'envs.zip', 'backups/secrets.tar.gz', 'tls/server.key']) assert.equal(forbiddenPath(path), true, path);
  for (const path of ['envs/user-auth.env.example', 'user-service/.env.example', 'README.md']) assert.equal(forbiddenPath(path), false, path);
});

test('staged scanning inspects index contents even when the worktree is clean', async (t) => {
  const { dir, git } = repository(t);
  writeFileSync(join(dir, 'notes.txt'), syntheticKey()); git('add', 'notes.txt');
  writeFileSync(join(dir, 'notes.txt'), 'safe worktree replacement');
  await assert.rejects(scanStaged({ cwd: dir }), /secret|credential/i);
});

test('a secret added then deleted in outgoing history is still rejected', async (t) => {
  const { dir, git, base } = repository(t);
  writeFileSync(join(dir, 'notes.txt'), syntheticKey()); git('add', '.'); git('commit', '-qm', 'introduce fixture');
  git('rm', '-q', 'notes.txt'); git('commit', '-qm', 'remove fixture');
  await assert.rejects(scanHistory(`${base}..HEAD`, { cwd: dir }), /secret|credential/i);
});

test('tracked-tree scanning does not include ignored local credentials', async (t) => {
  const { dir, git } = repository(t);
  writeFileSync(join(dir, '.gitignore'), '.env\n'); git('add', '.'); git('commit', '-qm', 'ignore local env');
  writeFileSync(join(dir, '.env'), syntheticKey());
  await scanTree({ cwd: dir });
});

test('default scanner rules catch a synthetic provider token in a renamed archive and its history', async (t) => {
  const { dir, git, base } = repository(t);
  const token = ['ghp', randomBytes(18).toString('hex')].join('_');
  writeFileSync(join(dir, 'payload.txt'), token);
  execFileSync('tar', ['czf', join(dir, 'bundle.tar.gz'), '-C', dir, 'payload.txt']);
  rmSync(join(dir, 'payload.txt'));
  git('add', 'bundle.tar.gz');
  await assert.rejects(scanStaged({ cwd: dir }), (error) => {
    assert.match(error.message, /bundle\.tar\.gz/);
    assert.equal(error.message.includes(token), false);
    return true;
  });
  git('commit', '-qm', 'archive fixture');
  git('rm', '-q', 'bundle.tar.gz'); git('commit', '-qm', 'remove archive fixture');
  await assert.rejects(scanHistory(`${base}..HEAD`, { cwd: dir }), /secret|credential/i);
});

test('unstaged secrets do not replace the safe content actually being committed', async (t) => {
  const { dir, git } = repository(t);
  writeFileSync(join(dir, 'notes.txt'), 'safe staged content'); git('add', 'notes.txt');
  writeFileSync(join(dir, 'notes.txt'), syntheticKey());
  await scanStaged({ cwd: dir });
});

test('tracked source files containing NUL bytes are rejected without showing content', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'nook-text-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'chat.service.ts');
  const marker = 'synthetic-private-marker';
  writeFileSync(source, Buffer.concat([Buffer.from('const hidden = '), Buffer.from([0]), Buffer.from(`${marker};`)]));
  await assert.rejects(assertNoNulTextFiles(['chat.service.ts'], { baseDirectory: dir }), (error) => {
    assert.match(error.message, /chat\.service\.ts/);
    assert.equal(error.message.includes(marker), false);
    return true;
  });
});

test('binary assets are excluded from the tracked text-file NUL scan', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'nook-text-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'badge.png'), Buffer.from([137, 80, 78, 71, 0, 0, 1]));
  await assert.doesNotReject(assertNoNulTextFiles(['badge.png'], { baseDirectory: dir }));
});
