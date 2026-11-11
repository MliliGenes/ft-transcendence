import { root, run, npm, cli, isMain } from './process.mjs';

export function workspaceTestSteps(inherited = process.env) {
  const env = { ...inherited };
  for (const key of ['DATABASE_URL', 'TEST_PG_URL', 'TEST_DATABASE_URL', 'AUTH_TEST_DATABASE_URL']) delete env[key];
  return ['arena-game-engine', 'arena-harness', 'arena-model', 'arena-game', 'arena-judge-worker'].map((workspace) => ({
    workspace,
    // These engine suites otherwise probe a historical localhost:5433 default.
    // Database contracts run later against the owned disposable server.
    env: workspace === 'arena-game-engine'
      ? { ...env, TEST_PG_URL: 'postgres://disabled:unused@127.0.0.1:1/disabled_test' }
      : { ...env },
  }));
}
if (isMain(import.meta.url)) await cli(async (signal) => {
  for (const { workspace, env } of workspaceTestSteps()) {
    console.log(`\n> Arena workspace: ${workspace}`);
    await run(npm, ['run', 'test', '--workspace', workspace], { cwd: root, env, signal });
  }
});
