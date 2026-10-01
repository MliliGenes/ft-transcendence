import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const failures = [];

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name, directory.href.endsWith("/") ? directory : new URL(`${directory.href}/`));
    if (entry.isDirectory()) return markdownFiles(url);
    return entry.isFile() && entry.name.endsWith(".md") ? [url] : [];
  });
}

const requiredPaths = [
  "frontend/package.json",
  "packages/arena-game/package.json",
  "packages/arena-harness/package.json",
  "packages/arena-model/package.json",
  "packages/problem-bank/schema.json",
  "services/game/package.json",
  "services/judge-worker/package.json",
  "docs/game-local-run.md",
  "docs/auth-game-contract.md",
  "docs/code-arena-architecture.html",
  "docs/reference/code-arena-ui.html",
  "docs/decisions/judge-isolation.md",
  "docs/adr/0014-code-arena-extraction.md",
  "requirements/ft_transcendence-v21.2.pdf",
];

for (const path of requiredPaths) {
  if (!existsSync(new URL(path, root))) failures.push(`missing required path: ${path}`);
}

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  {
  cwd: root,
  encoding: "utf8",
  }
).trim().split("\n").filter(Boolean);

const forbidden = [
  /^\.agents\//,
  /^\.claude\//,
  /^\.codex\//,
  /^\.scratch\//,
  /^\.superpowers\//,
  /^\.tours\//,
  /^\.trigger-tree\//,
  /^graphify-out\//,
  /^prototype\//,
  /^spikes\//,
  /^services\/(core|chat)\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)test-results\//,
  /(^|\/)\.DS_Store$/,
];

for (const path of repositoryFiles) {
  if (forbidden.some((pattern) => pattern.test(path))) {
    failures.push(`forbidden repository path: ${path}`);
  }
}

const staleReferenceChecks = [
  ["CONTEXT.md", [".scratch/", "prototype/game-ui/", "spikes/judge-isolation/"]],
  ["docs/game-local-run.md", [".scratch/", "prototype/game-ui/", "spikes/judge-isolation/"]],
  ["package-lock.json", ['"services/core"', '"services/chat"']],
  ["docker-compose.yml", ["services/core", "services/chat", "CORE_DB_", "CHAT_DB_"]],
  ["infra/nginx/nginx.conf", ["core_svc", "/api/core/"]],
  ["infra/postgres/init-db.sh", ["CORE_DB_", "CHAT_DB_"]],
  [".env.example", ["CORE_DB_", "CHAT_DB_"]],
];

for (const [path, needles] of staleReferenceChecks) {
  const url = new URL(path, root);
  if (!existsSync(url)) continue;
  const content = readFileSync(url, "utf8");
  for (const needle of needles) {
    if (content.includes(needle)) failures.push(`${path} still contains ${needle}`);
  }
}

if (existsSync(new URL("README.md", root))) {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  if (!readme.includes("243e3e7c468ee946f9d7f52a598f15aa4c3ca70e")) {
    failures.push("README.md does not record the source commit");
  }
}

if (existsSync(new URL("PROJECT_CONTEXT.md", root))) {
  const context = readFileSync(new URL("PROJECT_CONTEXT.md", root), "utf8");
  if (!context.includes("Code Arena") || !context.includes("first-game implementation baseline")) {
    failures.push("PROJECT_CONTEXT.md does not identify Code Arena as the first-game implementation baseline");
  }
}

const docs = [
  ...["README.md", "CONTEXT.md", "PROJECT_CONTEXT.md"]
    .map((path) => new URL(path, root))
    .filter(existsSync),
  ...(existsSync(new URL("docs/", root)) ? markdownFiles(new URL("docs/", root)) : []),
];

for (const document of docs) {
  const content = readFileSync(document, "utf8");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = new URL(target, document);
    if (!existsSync(resolved)) {
      failures.push(`${document.pathname.split("/").at(-1)} has missing local link: ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`repository boundary OK (${repositoryFiles.length} repository files checked)`);
