import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEXT_FILE =
  /(?:^|\/)(?:[^/]+\.(?:cjs|css|env|example|gql|graphql|h|html|ini|js|json|jsonc|md|mjs|prisma|proto|scss|sh|sql|swift|toml|ts|tsx|txt|xml|yaml|yml)|Dockerfile|Makefile|\.dockerignore|\.gitattributes|\.gitignore|\.gitmodules|\.npmrc|\.prettierignore|\.prettierrc)$/i;

/** Reject binary NUL bytes in source and documentation files without printing their content. */
export async function assertNoNulTextFiles(
  paths,
  { baseDirectory, read = readFile } = {},
) {
  const invalid = [];
  for (const path of paths) {
    if (!TEXT_FILE.test(path)) continue;
    const contents = await read(join(baseDirectory, path));
    if (contents.includes(0)) invalid.push(path);
  }
  if (invalid.length) {
    throw new Error(
      `Text files contain NUL bytes: ${invalid.slice(0, 20).join(', ')}`,
    );
  }
}
