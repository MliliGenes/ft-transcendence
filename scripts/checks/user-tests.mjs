import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, run, cli, isMain } from './process.mjs';

export const userTestFiles = () =>
  readdirSync(join(root, 'user-service/test'))
    .filter(
      (name) =>
        name.endsWith('.test.mjs') && !name.endsWith('.postgres.test.mjs'),
    )
    .sort()
    .map((name) => `test/${name}`);
// The files share one process (--test-isolation=none). Running them
// concurrently let one file's Nest application answer another file's request,
// which fails under load; serialize them instead.
if (isMain(import.meta.url))
  await cli((signal) =>
    run(
      process.execPath,
      [
        '--test',
        '--test-isolation=none',
        '--test-concurrency=1',
        ...userTestFiles(),
      ],
      { cwd: join(root, 'user-service'), signal },
    ),
  );
