import { readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, run, npm, cli, isMain } from './process.mjs';
import { userTestFiles } from './user-tests.mjs';
import { runIntegration } from './integration.mjs';
import { scanCI } from './secrets.mjs';

const testFiles = (directory, filter) => readdirSync(join(root, directory)).filter(filter).sort().map((file) => `${directory}/${file}`);
export function verificationSteps() {
  const step = (id, cwd, args, command = npm) => ({ id, cwd, command, args });
  return [
    step('tool-tests', '.', ['--test', ...testFiles('scripts/checks/test', (f) => f.endsWith('.test.mjs')), 'infra/backup/backup.test.mjs'], process.execPath),
    step('user-generate', 'user-service', ['node_modules/prisma/build/index.js', 'generate'], process.execPath),
    step('chat-generate', 'chat-service', ['node_modules/prisma/build/index.js', 'generate'], process.execPath),
    ...[['client', 'client'], ['chat', 'chat-service'], ['user', 'user-service']].map(([name, cwd]) => step(`${name}-lint`, cwd, ['run', 'lint'])),
    step('arena-typecheck', '.', ['run', 'typecheck']),
    step('arena-build', '.', ['run', 'build']),
    step('chat-build', 'chat-service', ['run', 'build']),
    step('user-build', 'user-service', ['run', 'build']),
    step('arena-tests', '.', ['scripts/checks/arena-tests.mjs'], process.execPath),
    step('client-tests', 'client', ['test']),
    step('chat-tests', 'chat-service', ['test']),
    step('user-tests', 'user-service', ['--test', '--test-isolation=none', '--test-concurrency=1', ...userTestFiles()], process.execPath),
    step('client-build', 'client', ['run', 'build']),
  ];
}
export async function runSteps(steps, { execute, report = () => {} }) {
  for (const step of steps) {
    const start = Date.now();
    try { await execute(step); report({ id: step.id, ok: true, durationMs: Date.now() - start }); }
    catch (error) { report({ id: step.id, ok: false, durationMs: Date.now() - start, error: error.message }); throw error; }
  }
}
async function main(signal) {
  const results = [];
  let completed = false, failure;
  const report = (result) => { results.push(result); console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} (${(result.durationMs / 1000).toFixed(1)}s)`); };
  const env = { ...process.env, NODE_ENV: 'test', POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '1', POSTGRES_USER: 'verify', POSTGRES_PASSWORD: 'unused', POSTGRES_DB: 'verify_test', DOTENV_CONFIG_PATH: join(root, '.verification', 'no-env-file') };
  for (const key of ['DATABASE_URL', 'TEST_PG_URL', 'TEST_DATABASE_URL', 'AUTH_TEST_DATABASE_URL', 'RABBITMQ_HOST', 'RABBITMQ_DEFAULT_USER', 'RABBITMQ_DEFAULT_PASS']) delete env[key];
  try {
    let steps = verificationSteps();
    if (process.argv.includes('--lint')) steps = steps.filter((s) => s.id.endsWith('-lint'));
    else {
      await scanCI(); console.log('PASS secret-prevention');
      await run('docker', ['info'], { capture: true, signal });
    }
    await runSteps(steps, { report, execute: async (step) => {
      console.log(`\n> ${step.id}`);
      await run(step.command, step.args, { cwd: join(root, step.cwd), env: { ...env, NODE_ENV: step.id === 'client-build' ? 'production' : 'test' }, signal });
    } });
    if (!process.argv.includes('--lint')) await runIntegration({ prepared: true, signal, report });
    completed = true;
  } catch (error) { failure = error; throw error; } finally {
    await mkdir(join(root, '.verification'), { recursive: true });
    await writeFile(join(root, '.verification', 'latest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ok: completed, error: failure?.message, results }, null, 2) + '\n');
  }
}
if (isMain(import.meta.url)) await cli(main);
