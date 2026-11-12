// Builds docs/book/Nook-Book.pdf from:
//   - the project docs (docs/**, README.md, envs/README.md)
//   - the OpenAPI specs of the user and chat services
//   - the graphify code graph (graphify-out/)
//   - the Understand-Anything knowledge graph (.ua/knowledge-graph.json)
// Run:  cd docs/book && npm install && npm run build
// Needs Google Chrome (set CHROME_PATH if it is not in the default location).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DIST = join(HERE, 'dist');
const OUT_PDF = join(HERE, 'Nook-Book.pdf');
mkdirSync(DIST, { recursive: true });

const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const rdJson = (p) => JSON.parse(rd(p));
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const git = (a) => { try { return execSync(`git ${a}`, { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } };

// ---------------------------------------------------------------- markdown
let docDir = ROOT;
marked.use({
  gfm: true,
  renderer: {
    // Relative links point at files that do not exist in a PDF: keep the text only.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      return /^https?:/.test(href) ? `<a href="${esc(href)}">${text}</a>` : text;
    },
    image({ href, text }) {
      if (/^https?:/.test(href)) return `<img src="${esc(href)}" alt="${esc(text)}">`;
      const p = resolve(docDir, decodeURI(href));
      return existsSync(p) ? `<img src="${pathToFileURL(p).href}" alt="${esc(text)}">` : '';
    },
  },
});

function mdToHtml(text, fromFile) {
  docDir = fromFile ? dirname(join(ROOT, fromFile)) : ROOT;
  return marked.parse(text);
}

/** Demote headings by n levels, ignoring fenced code. */
function shiftHeadings(text, n) {
  let fence = false;
  return text
    .split('\n')
    .map((l) => {
      if (/^\s*```/.test(l)) fence = !fence;
      if (fence) return l;
      const m = l.match(/^(#{1,6})\s+(.*)$/);
      return m ? `${'#'.repeat(Math.min(6, m[1].length + n))} ${m[2]}` : l;
    })
    .join('\n');
}

/** Drop the document's own H1 (it becomes the chapter title) and nest the rest. */
function bodyOf(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const i = lines.findIndex((l) => /^# /.test(l));
  if (i >= 0) lines.splice(i, 1);
  return shiftHeadings(lines.join('\n'), 1); // h2 -> h3 : chapter is h2
}

function section(text, heading) {
  const lines = text.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return '';
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

function dropSection(text, heading) {
  const lines = text.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return text;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  lines.splice(start, end - start);
  return lines.join('\n');
}

// -------------------------------------------------------------- book model
const toc = []; // {level, id, title}
let seq = 0;
const parts = [];
let curPart = null;
let chapterNo = 0;

function part(title, intro = '') {
  const id = `p${++seq}`;
  toc.push({ level: 1, id, title });
  curPart = { id, title, chapters: [] };
  parts.push(`<section class="part"><h1 id="${id}">${esc(title)}</h1><p class="part-intro">${esc(intro)}</p></section>`);
}
function chapter(title, html) {
  const id = `c${++seq}`;
  chapterNo += 1;
  toc.push({ level: 2, id, title: `${chapterNo}. ${title}` });
  parts.push(`<section class="chapter"><h2 id="${id}"><span class="no">${chapterNo}</span>${esc(title)}</h2>${html}</section>`);
}
const docChapter = (title, file, transform = (t) => t) =>
  chapter(title, mdToHtml(bodyOf(transform(rd(file))), file));

const table = (head, rows, cls = '') =>
  `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

// ------------------------------------------------------------------ data
const ua = rdJson('.ua/knowledge-graph.json');
const uaMeta = rdJson('.ua/meta.json');
const gg = rdJson('graphify-out/graph.json');
const ggReport = rd('graphify-out/GRAPH_REPORT.md');
const userApi = rdJson('docs/api/user-service.openapi.json');
const chatApi = rdJson('docs/api/chat-service.openapi.json');
const HEAD = git('rev-parse --short HEAD');
const BRANCH = git('rev-parse --abbrev-ref HEAD');
const uaSourceCommit = uaMeta.gitCommitHash || '';
const uaMatchesHead = Boolean(uaSourceCommit)
  && (uaSourceCommit.startsWith(HEAD) || HEAD.startsWith(uaSourceCommit));
const uaFreshness = uaMatchesHead ? 'current at repository HEAD' : 'stale snapshot';
const origin = git('remote get-url origin')
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
  .replace(/\.git$/, '');
const screenshotUrl = /^https:\/\/github\.com\//.test(origin)
  ? `${origin}/blob/${HEAD}/docs/evidence/g06-live-demo/screenshots.pdf`
  : '';
const specUrl = /^https:\/\/github\.com\//.test(origin)
  ? `${origin}/blob/${HEAD}/docs/spec/code-arena-integration-spec.md`
  : '';

const excluded = (p = '') => /\.scratch|\.keys|next-env\.d\.ts|\.pem$/.test(p);
const uaNodes = ua.nodes.filter((n) => !excluded(n.filePath));
const uaById = new Map(uaNodes.map((n) => [n.id, n]));
// Some generated summaries are letter-spaced noise ("c ha t s er vi ce"); skip those.
const goodSummary = (s) => s && !/\b\w \w \w \w/.test(s) && !/\b[a-z] [a-z]{1,2} [a-z]/.test(s);

// ===================================================================== cover
const cover = `
<section class="cover">
  <div class="cover-mark">N</div>
  <h1 class="cover-title">Nook</h1>
  <p class="cover-sub">The Application Book</p>
  <p class="cover-tag">A social platform for the 1337/42 community: feed, chat, play and profile.<br>
  Architecture, services, API reference and code map for the ft_transcendence project.</p>
  <table class="cover-meta">
    <tr><td>Generated</td><td>${new Date().toISOString().slice(0, 10)}</td></tr>
    <tr><td>Repository</td><td>ft-transcendence @ <code>${esc(BRANCH)}</code> (<code>${esc(HEAD)}</code>)</td></tr>
    <tr><td>Code graph</td><td>graphify, ${gg.nodes.length} nodes / ${gg.links.length} edges, source commit <code>${esc((gg.built_at_commit || '').slice(0, 8) || 'unknown')}</code></td></tr>
    <tr><td>Knowledge graph</td><td>Understand-Anything, ${ua.nodes.length} nodes / ${ua.edges.length} edges, ${uaFreshness} at <code>${esc(uaSourceCommit.slice(0, 8) || 'unknown')}</code></td></tr>
    <tr><td>API contracts</td><td>OpenAPI 3.1: User (${Object.keys(userApi.paths).length} paths) and Chat (${Object.keys(chatApi.paths).length} paths); Game HTTP and Socket.IO contracts are summarized in Part III</td></tr>
  </table>
</section>`;

// ================================================================ PART I
part('Part I: Product and Project', 'What Nook is, who it is for, how the work is planned, and how to run it.');
docChapter('Repository overview', 'README.md');
docChapter('Product context', 'docs/project/PROJECT_CONTEXT.md');
docChapter('Roadmap and module plan', 'docs/project/POINTS_ROADMAP.md');
docChapter('Running the stack with Docker Compose', 'docs/services/infrastructure.md', (t) => section(t, 'Running the stack'));
docChapter('Environment configuration', 'envs/README.md');

// ============================================================== PART II
part('Part II: Architecture', 'How the system is put together, seen through the compose files, the knowledge graph and the code graph.');

// ---- system diagram
function box(x, y, w, h, title, sub, cls) {
  return `<g class="bx ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + h / 2 - (sub ? 2 : -5)}" class="t">${esc(title)}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" class="s">${esc(sub)}</text>` : ''}</g>`;
}
function arrow(x1, y1, x2, y2, label = '', dash = false, t = 0.62) {
  const lx = x1 + (x2 - x1) * t, ly = y1 + (y2 - y1) * t;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ar${dash ? ' dash' : ''}" marker-end="url(#ah)"/>${label ? `<text x="${lx}" y="${ly - 5}" class="lb" text-anchor="middle">${esc(label)}</text>` : ''}`;
}
const diagram = `
<svg viewBox="0 0 980 460" class="diagram" role="img" aria-label="System architecture">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#475569"/></marker></defs>
  ${box(8, 207, 110, 50, 'Browser', 'React, Socket.IO', 'ext')}
  ${box(150, 197, 120, 70, 'Nginx', 'TLS gateway', 'gw')}
  ${box(370, 18, 160, 46, 'Web client', 'Next.js :3000', 'app')}
  ${box(370, 82, 160, 46, 'User service', 'NestJS, auth, profiles', 'app')}
  ${box(370, 146, 160, 46, 'Chat service', 'NestJS, Socket.IO', 'app')}
  ${box(370, 210, 160, 46, 'Game service', 'NestJS, Socket.IO', 'app')}
  ${box(370, 292, 160, 46, 'MinIO', 'S3 storage :9000', 'store')}
  ${box(370, 375, 160, 46, 'Grafana', 'dashboards', 'mon')}
  ${box(600, 80, 140, 42, 'User DB', 'PostgreSQL', 'db')}
  ${box(600, 132, 140, 36, 'RabbitMQ', 'user + game events', 'mq')}
  ${box(600, 178, 140, 42, 'Chat DB', 'PostgreSQL', 'db')}
  ${box(600, 226, 140, 42, 'Game DB', 'PostgreSQL', 'db')}
  ${box(600, 275, 140, 42, 'Judge worker', 'private network', 'job')}
  ${box(600, 325, 140, 38, 'minio-init', 'one-shot job', 'job')}
  ${box(785, 275, 165, 42, 'Sandbox containers', 'no network access', 'job')}
  ${box(600, 382, 350, 40, 'Prometheus, Loki, Alloy, cAdvisor', '', 'mon')}
  ${arrow(118, 232, 150, 232)}
  ${arrow(270, 204, 370, 41, '/', false, 0.72)}
  ${arrow(270, 216, 370, 105, '/api/', false, 0.72)}
  ${arrow(270, 230, 370, 169, '/api/chat/', false, 0.7)}
  ${arrow(270, 244, 370, 233, '/api/game/', false, 0.55)}
  ${arrow(270, 254, 370, 315, ':9443', true, 0.62)}
  ${arrow(270, 260, 370, 398, '/grafana/', true, 0.72)}
  ${arrow(530, 105, 600, 101)}
  ${arrow(530, 169, 600, 199)}
  ${arrow(530, 233, 600, 247)}
  ${arrow(530, 105, 600, 147, 'user events', true, 0.7)}
  ${arrow(530, 233, 600, 158, 'game.events', true, 0.68)}
  ${arrow(600, 151, 530, 166, 'to Chat', true, 0.55)}
  ${arrow(530, 170, 450, 292, 'S3 API', false, 0.45)}
  ${arrow(530, 233, 600, 296, 'judge request', true, 0.62)}
  ${arrow(740, 296, 785, 296)}
  ${arrow(600, 344, 530, 315, 'provisions', true, 0.5)}
  ${arrow(600, 402, 530, 398, 'scrape', true, 0.5)}
</svg>`;

const arch = `
<p>Nook is a set of cooperating containers behind a single TLS gateway. The browser only talks to Nginx. Nginx fans requests out by path, so the Next.js client, the User, Chat and Game services, and Grafana appear under one origin.</p>
${diagram}
<p class="cap">Figure 1. Runtime topology. Solid arrows are request paths. Dashed arrows show provisioning, observability, asynchronous events, and private judge traffic. Game match events flow through RabbitMQ to Chat; submitted code runs in isolated sandbox containers.</p>
<h3>Request routing at the gateway</h3>
${table(['Public path', 'Upstream', 'Notes'], [
  ['<code>/api/</code>', 'user-service:3000', 'Auth, accounts, social, admin. Rate limited per route (login 10/min, register 3/min, password reset 3 and 5/min).'],
  ['<code>/api/chat/</code>', 'chat-service:3000', 'REST for DMs, groups and channels. Mapped onto <code>/chat/</code> internally.'],
  ['<code>/api/chat/socket.io/</code>, <code>/socket.io/</code>', 'chat-service:3000', 'WebSocket upgrade for realtime messages and presence.'],
  ['<code>/api/game/</code>', 'game-service:3000', 'Authenticated REST for matchmaking, rooms, matches, history, stats and leaderboard.'],
  ['<code>/api/game/socket.io/</code>', 'game-service:3000', 'Canonical Socket.IO transport for lobby, match, collaboration and team chat namespaces.'],
  ['<code>/grafana/</code>', 'grafana:3000', 'Only Grafana is exposed; Prometheus, Loki, Alloy and cAdvisor have no public route.'],
  ['<code>/</code>', 'client:3000', 'The Next.js web client.'],
  ['<code>:9443</code>', 'minio:9000', 'TLS front for presigned MinIO URLs, bound to loopback in the default compose file.'],
])}
<h3>Responsibilities</h3>
${table(['Component', 'Responsibility', 'Owns'], [
  ['User service', 'Registration, login, JWT (RS256) issue and refresh, OAuth providers, profiles, friendships and blocks, admin tools, account search', 'user-db, uploaded account images'],
  ['Chat service', 'Direct messages, groups and channels, read state, reactions, presence, attachments; verifies the User service JWT but never issues tokens', 'chat-db, MinIO bucket <code>chat-attachments</code>'],
  ['Game service', 'Matchmaking, private rooms, matches, rounds, submissions, collaboration, match results and lifecycle events', 'game-db'],
  ['Judge worker', 'Executes coding submissions in bounded, resource-limited, no-network containers', 'ephemeral judge jobs'],
  ['RabbitMQ', 'Carries User lifecycle events and Game match events to Chat; gameplay does not wait for Chat delivery', 'durable event queues'],
  ['MinIO', 'S3-compatible object storage for chat attachments, reached with direct browser uploads through presigned POST policies and GET URLs', 'volumes/minio'],
  ['minio-init', 'Idempotent bootstrap: creates the bucket and a bucket-scoped service account so a fresh volume works without console steps', 'nothing (exits)'],
  ['Monitoring stack', 'Prometheus, Loki, Alloy, cAdvisor and Grafana for metrics, logs and dashboards', 'metrics and log storage'],
], 'firstcol')}
<h3>Two storage addresses for MinIO</h3>
<p>Chat holds two MinIO clients. The internal one (<code>MINIO_ENDPOINT=minio:9000</code>, plain HTTP inside the compose network) performs server-side operations such as <code>statObject</code> and bucket checks. The public one (<code>MINIO_PUBLIC_ENDPOINT</code>, TLS) only signs URLs handed to the browser. Because a SigV4 signature covers the host, the host in a presigned URL must be one the browser can actually reach and that Nginx forwards with the original <code>Host</code> header. This is the first thing to check when a browser reports a 403 or never reaches Nginx from another device.</p>`;
chapter('System architecture', arch);

// ---- layers (Understand-Anything)
{
  const rows = ua.layers.map((l) => {
    const ns = l.nodeIds.map((id) => uaById.get(id)).filter(Boolean);
    const types = {};
    ns.forEach((n) => (types[n.type] = (types[n.type] || 0) + 1));
    return [`<b>${esc(l.name)}</b>`, esc(l.description), String(ns.length), Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ')];
  });
  const byType = {};
  uaNodes.forEach((n) => (byType[n.type] = (byType[n.type] || 0) + 1));
  const byEdge = {};
  ua.edges.forEach((e) => (byEdge[e.type] = (byEdge[e.type] || 0) + 1));
  const html = `
<p>The Understand-Anything analysis grouped the repository into <b>${ua.layers.length} architectural layers</b>. Every file-level node belongs to exactly one layer. The graph holds ${uaNodes.length} nodes and ${ua.edges.length} edges, analysed at commit <code>${esc(uaSourceCommit.slice(0, 8) || 'unknown')}</code>.</p>
${uaMatchesHead ? '' : `<p><b>Freshness:</b> This is a historical snapshot that predates repository HEAD <code>${esc(HEAD)}</code>. Refresh the Understand-Anything analysis before using it as a map of the current code.</p>`}
${table(['Layer', 'What belongs here', 'Files', 'Composition'], rows)}
<h3>Node and edge inventory</h3>
<div class="two">
${table(['Node type', 'Count'], Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), String(v)]), 'narrow')}
${table(['Edge type', 'Count'], Object.entries(byEdge).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), String(v)]), 'narrow')}
</div>`;
  chapter('Architectural layers', html);
}

// ---- tour
{
  const html = ua.tour
    .sort((a, b) => a.order - b.order)
    .map((t) => {
      const files = t.nodeIds.map((id) => uaById.get(id)).filter(Boolean);
      return `<div class="step"><h3>Step ${t.order}. ${esc(t.title)}</h3><p>${esc(t.description)}</p>${
        files.length ? `<p class="files">${files.map((f) => `<code>${esc(f.filePath)}</code>`).join(' ')}</p>` : ''
      }</div>`;
    })
    .join('');
  chapter('Guided tour of the codebase', `<p>The suggested reading order produced by the knowledge-graph analysis, from product context to the runtime stack, the User, Chat and Game services, the client and the tests.</p>${html}`);
}

// ---- graphify analysis
{
  const nodes = gg.nodes;
  const links = gg.links;
  const svcOf = (f = '') => (f.includes('/') ? f.split('/')[0] : '(root)');
  const bySvc = {};
  nodes.forEach((n) => {
    const s = svcOf(n.source_file);
    (bySvc[s] ||= { nodes: 0, calls: 0, imports: 0 }).nodes++;
  });
  links.forEach((l) => {
    const s = svcOf(l.source_file);
    if (!bySvc[s]) return;
    if (l.relation === 'calls') bySvc[s].calls++;
    if (l.relation === 'imports' || l.relation === 'imports_from') bySvc[s].imports++;
  });
  const rel = {};
  links.forEach((l) => (rel[l.relation] = (rel[l.relation] || 0) + 1));
  const conf = {};
  links.forEach((l) => (conf[l.confidence] = (conf[l.confidence] || 0) + 1));

  const commSizes = new Map();
  nodes.forEach((n) => {
    const k = n.community;
    if (k == null) return;
    const c = commSizes.get(k) || { id: k, name: n.community_name, size: 0, labels: [], files: {} };
    c.size++;
    if (c.labels.length < 7 && !/^(dependencies|scripts|compilerOptions|devDependencies)$/.test(n.label)) c.labels.push(n.label);
    const d = (n.source_file || '').split('/').slice(0, 3).join('/');
    c.files[d] = (c.files[d] || 0) + 1;
    commSizes.set(k, c);
  });
  const top = [...commSizes.values()].sort((a, b) => b.size - a.size).slice(0, 30);

  const summary = section(ggReport, 'Summary');
  const html = `
<p>graphify builds the code graph deterministically from local AST parsing (functions, classes, imports, calls) and links documentation to the code it describes. This run named 161 previously unlabeled communities with local Ollama <code>qwen3.5:4b</code>; the 47 saved labels were preserved, and two duplicate Docker labels were clarified during review. The extraction and naming pass used no hosted model. This build contains <b>${nodes.length} nodes</b> and <b>${links.length} edges</b> grouped into <b>${commSizes.size} communities</b>, built at commit <code>${esc((gg.built_at_commit || '').slice(0, 8))}</code>.</p>
<h3>Graph summary</h3>
${mdToHtml(summary)}
<h3>Footprint per top-level folder</h3>
${table(['Folder', 'Nodes', 'Call edges', 'Import edges'], Object.entries(bySvc).sort((a, b) => b[1].nodes - a[1].nodes).map(([k, v]) => [`<code>${esc(k)}</code>`, String(v.nodes), String(v.calls), String(v.imports)]), 'narrow')}
<h3>Relationship types</h3>
<div class="two">
${table(['Relation', 'Edges'], Object.entries(rel).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), String(v)]), 'narrow')}
${table(['Confidence', 'Edges'], Object.entries(conf).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), String(v)]), 'narrow')}
</div>
<h3>Core abstractions (god nodes)</h3>
<p>The most connected nodes are the abstractions the rest of the code leans on. In Nook they are the shared <code>Button</code> UI primitive, the chat workspace component, the <code>useAuth</code> hook, and <code>AuthService</code> on the backend.</p>
${mdToHtml(section(ggReport, 'God Nodes (most connected - your core abstractions)'))}
<h3>Surprising connections</h3>
<p>Cross-boundary links that the extractor inferred, mostly between documentation and the code it describes.</p>
${mdToHtml(section(ggReport, 'Surprising Connections (you probably didn\'t know these)'))}
<h3>Import cycles</h3>
${mdToHtml(section(ggReport, 'Import Cycles'))}
<h3>The 30 largest communities</h3>
<p>Communities are clusters of tightly related code. Their labels summarize the member nodes; cohesion is not shown here (see the full report in <code>graphify-out/GRAPH_REPORT.md</code>).</p>
${table(['#', 'Community (hub)', 'Members', 'Main folders', 'Sample members'], top.map((c, i) => [
  String(i + 1), `<b>${esc(c.name)}</b>`, String(c.size),
  Object.entries(c.files).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => `<code>${esc(d || '-')}</code>`).join('<br>'),
  esc(c.labels.join(', ')),
]))}
<h3>Knowledge gaps</h3>
${mdToHtml(section(ggReport, 'Knowledge Gaps'))}`;
  chapter('Code graph analysis (graphify)', html);
}

// ============================================================= PART III
part('Part III: Services and Integrations', 'One chapter per service, then one per place where services meet.');
docChapter('User service', 'docs/services/user-service.md');
docChapter('Chat service', 'docs/services/chat-service.md');

// ---- client chapter with UI mockups
{
  const mock = [
    ['Nook_ A place for your people-1.png', 'Landing'],
    ['Minimal dark Nook login interface-2.png', 'Login (dark)'],
    ['Nook dark social feed-3.png', 'Social feed'],
    ['Nook dark chat workspace-5.png', 'Chat workspace'],
    ['Nook chess lobby-6.png', 'Play lobby'],
    ['Nook profile settings in dark mode-7.png', 'Profile settings'],
  ];
  const gallery = mock
    .map(([f, t]) => {
      const p = join(ROOT, 'docs/client/ui-mockups', f);
      return existsSync(p) ? `<figure><img src="${pathToFileURL(p).href}" alt="${esc(t)}"><figcaption>${esc(t)}</figcaption></figure>` : '';
    })
    .join('');
  const html =
    mdToHtml(bodyOf(rd('docs/services/client.md')), 'docs/services/client.md') +
    `<h3>UI mockups</h3><div class="gallery">${gallery}</div>`;
  chapter('Web client (Next.js)', html);
}
docChapter('Infrastructure: gateway, broker, storage and monitoring', 'docs/services/infrastructure.md', (t) => dropSection(t, 'Running the stack'));
docChapter('User and chat integration (RabbitMQ, JWT, block checks)', 'docs/integrations/user-chat.md');
docChapter('Chat and storage integration (MinIO, presigned URLs)', 'docs/integrations/chat-storage.md');
docChapter('Client and backend integration', 'docs/integrations/client-backend.md');
docChapter('Feed integration', 'docs/integrations/feed.md');

// ---- Code Arena and the live acceptance evidence
{
  const specPath = 'docs/spec/code-arena-integration-spec.md';
  const spec = rd(specPath);
  const evidencePath = 'docs/evidence/g06-live-demo/README.md';
  const evidence = rd(evidencePath);
  const screenshotRows = [...evidence.matchAll(/^\|\s*`([^`]+\.png)`\s*\|\s*(.+?)\s*\|$/gm)]
    .map(([, filename, caption], index) => ({ filename, caption, index: index + 1 }));
  if (!screenshotRows.length) throw new Error(`No screenshot entries found in ${evidencePath}`);
  const evidenceDir = dirname(join(ROOT, evidencePath));
  const screenshotCount = screenshotRows.length;
  const screenshotByName = new Map(screenshotRows.map((row) => [row.filename, row]));
  const selectedBookEvidence = [
    '03-owner-invitation-sent.png',
    '04-rival-sees-invitation.png',
    '09-owner-chat-match-started.png',
    '13-owner-chat-match-result.png',
    '16-owner-chat-cancelled.png',
    '20-owner-chat-expired.png',
  ];
  const expectedBookEvidence = new Set(selectedBookEvidence);
  const includedEvidence = new Set();
  const evidenceFigure = (filename) => {
    const row = screenshotByName.get(filename);
    if (!row) throw new Error(`Missing screenshot entry in ${evidencePath}: ${filename}`);
    if (!expectedBookEvidence.has(filename)) throw new Error(`Setup-only screenshot does not belong in the Code Arena chapter: ${filename}`);
    if (includedEvidence.has(filename)) throw new Error(`Screenshot used more than once in the Code Arena chapter: ${filename}`);
    includedEvidence.add(filename);
    const imagePath = join(evidenceDir, filename);
    if (!existsSync(imagePath)) throw new Error(`Missing G06 screenshot: ${imagePath}`);
    assertUniqueFigureImage(imagePath);
    const caption = row.caption.replace(/\*\*(.*?)\*\*/g, '$1');
    const description = `Live demo screenshot ${row.index}: ${caption}`;
    return `<figure><img src="${pathToFileURL(imagePath).href}" alt="${esc(description)}"><figcaption><b>${String(row.index).padStart(2, '0')}</b> ${esc(caption)}</figcaption></figure>`;
  };
  const evidenceGallery = (filenames) => `<div class="gallery">${filenames.map(evidenceFigure).join('')}</div>`;
  const figureImages = new Map();
  function assertUniqueFigureImage(imagePath) {
    const digest = createHash('sha256').update(readFileSync(imagePath)).digest('hex');
    const previous = figureImages.get(digest);
    if (previous) throw new Error(`Duplicate image used in Code Arena chapter: ${previous} and ${imagePath}`);
    figureImages.set(digest, imagePath);
  }
  const localFigure = (imagePath, alt, caption, className = '') => existsSync(imagePath)
    ? (assertUniqueFigureImage(imagePath), `<figure${className ? ` class="${esc(className)}"` : ''}><img src="${pathToFileURL(imagePath).href}" alt="${esc(alt)}"><figcaption>${esc(caption)}</figcaption></figure>`)
    : '';
  const screenshotLink = screenshotUrl
    ? `<a href="${esc(screenshotUrl)}">Download the ${screenshotCount}-page screenshot proof</a>`
    : `<code>docs/evidence/g06-live-demo/screenshots.pdf</code> (${screenshotCount}-page screenshot proof)`;
  const ownerProfilePath = 'docs/book/assets/aimane-yousr-profile-dark.png';
  const ownerGamesPath = 'docs/book/assets/aimane-yousr-games-dark.png';
  const leaderboardPath = 'docs/book/assets/aimane-yousr-leaderboard-dark.png';
  const playPagePath = 'docs/book/assets/code-arena-play-dark.png';
  const lobbyPath = 'docs/book/assets/code-arena-lobby-two-player-dark.png';
  const readyPath = 'docs/book/assets/code-arena-lobby-ready-two-player-dark.png';
  const editorPath = 'docs/book/assets/code-arena-editor-dark.png';
  const scoreRevealPath = 'docs/book/assets/code-arena-round-score-reveal-dark.png';
  const collaborationPath = 'docs/book/assets/code-arena-2v2-collaboration-dark.png';
  const forfeitPath = 'docs/book/assets/code-arena-forfeit-result-dark.png';
  const ownerProfileImage = join(ROOT, ownerProfilePath);
  const ownerGamesImage = join(ROOT, ownerGamesPath);
  const leaderboardImage = join(ROOT, leaderboardPath);
  const playPageImage = join(ROOT, playPagePath);
  const lobbyImage = join(ROOT, lobbyPath);
  const readyImage = join(ROOT, readyPath);
  const editorImage = join(ROOT, editorPath);
  const scoreRevealImage = join(ROOT, scoreRevealPath);
  const collaborationImage = join(ROOT, collaborationPath);
  const forfeitImage = join(ROOT, forfeitPath);
  const liveTwoVTwoCaptures = [
    {
      path: 'docs/book/assets/code-arena-lobby-ready-2v2-live-dark.png',
      alt: 'Dark-mode Code Arena 2v2 match lobby with all four seats filled: Team Alpha 2 of 2 and Team Beta 2 of 2, with all four players marked Ready',
      caption: 'Ready lobby before the match starts: both 2v2 teams are full (2/2) and all four players have marked Ready',
    },
    {
      path: 'docs/book/assets/code-arena-live-2v2-alpha1-dark.png',
      alt: 'Live dark-mode 2v2 Code Arena view from Alpha1: the shared team solution in the editor, with the teammate and opposing-team panels beside it',
      caption: 'Alpha1 teammate view: the Alpha team’s shared document carries the synchronized solution',
    },
    {
      path: 'docs/book/assets/code-arena-live-2v2-alpha2-dark.png',
      alt: 'Live dark-mode 2v2 Code Arena view from Alpha2: the same shared team solution, with both visible test cases passing',
      caption: 'Alpha2 teammate view: the same synchronized solution, with both visible test cases passing',
    },
    {
      path: 'docs/book/assets/code-arena-live-2v2-beta1-dark.png',
      alt: 'Live dark-mode 2v2 Code Arena view from Beta1: the opposing team’s own independent solution in its editor',
      caption: 'Beta1 opposing-team view: the rival team works in its own document, isolated from the Alpha shared editor',
    },
    {
      path: 'docs/book/assets/code-arena-live-2v2-beta2-dark.png',
      alt: 'Live dark-mode 2v2 Code Arena view from Beta2: the opposing team’s own independent solution in its editor',
      caption: 'Beta2 opposing-team view: the second Beta client sees the same independent Beta document',
    },
  ];
  const liveTwoVTwoFigures = liveTwoVTwoCaptures.map((capture) =>
    localFigure(join(ROOT, capture.path), capture.alt, capture.caption, 'wide'));
  const profileGallery = `<div class="gallery">${[
    localFigure(ownerProfileImage, 'Aimane Yousr Nook profile in dark mode with Code Arena actions', 'Aimane Yousr — Nook profile'),
    localFigure(ownerGamesImage, 'Nook Games profile with Code Arena match record, badges, and recent results', 'Games tab with progression, achievements, and recent matches'),
  ].filter(Boolean).join('')}</div>`;
  const playGallery = `<div class="gallery">${localFigure(playPageImage, 'Nook Code Arena Play page with create and join controls', 'Play page: create a duel or team lobby, join by code, and review active sessions', 'wide')}</div>`;
  const leaderboardGallery = `<div class="gallery">${localFigure(leaderboardImage, 'Nook Code Arena leaderboard with the project profile row', 'Leaderboard: player rank, match count, wins, and win rate', 'wide')}</div>`;
  const lobbyGallery = `<div class="gallery">${localFigure(lobbyImage, 'Aimane and Arena Guest in the same dark-mode private Code Arena 1v1 lobby', 'Live 1v1 lobby: both players occupy a team seat before readiness', 'wide')}</div>`;
  const readyGallery = `<div class="gallery">${localFigure(readyImage, 'Aimane and Guest both ready in a dark-mode Code Arena lobby, viewed from Guest’s client', 'Ready gate: both players show Ready in the guest-side lobby view', 'wide')}</div>`;
  const editorGallery = `<div class="gallery">${localFigure(editorImage, 'Aimane writing a C++ solution in a live dark-mode Code Arena match', 'Live coding: problem statement, examples, language controls, shared timer, editor, and case panel', 'wide')}</div>`;
  const scoreRevealGallery = `<div class="gallery">${localFigure(scoreRevealImage, 'Dark-mode Code Arena Round 1 of 3 score reveal after both visible cases passed, showing 100 points earned and a cumulative score of 100–100', 'Round 1 judge result: both visible cases pass and hidden-test weights add 100 points, so the cumulative score stands at 100–100 at that point — this is not a final match score', 'wide')}</div>`;
  const collaborationGallery = `<div class="gallery">${[
    localFigure(collaborationImage, 'Aimane in a live dark-mode 2v2 Code Arena workspace with a shared editor, teammates, and team chat', '2v2 collaboration: the active team workspace combines a shared editor, teammate status, and match-scoped chat', 'wide'),
    ...liveTwoVTwoFigures,
  ].join('')}</div>`;
  const forfeitGallery = `<div class="gallery">${localFigure(forfeitImage, 'Aimane sees a dark-mode Code Arena match result after the opponent forfeits', 'Forfeit result: the live match ends and records the winner', 'wide')}</div>`;
  const behaviorParagraphs = section(spec, 'Product behavior').trim().split(/\n\s*\n/);
  if (behaviorParagraphs.length !== 6) throw new Error('Unexpected Code Arena product behavior structure; update the book figure placement.');
  const [overview, scoring, collaboration, profileDetails, invitations, lifecycle] = behaviorParagraphs;
  const matchSentenceStart = overview.indexOf(' A match has three coding rounds');
  if (matchSentenceStart < 0) throw new Error('Could not locate the Code Arena match-flow sentence for the editor screenshot.');
  const discoveryText = overview.slice(0, matchSentenceStart).trim();
  const matchAndProblems = overview.slice(matchSentenceStart + 1).trim();
  const defaultProblemStart = matchAndProblems.indexOf(' Default matchmaking currently selects');
  if (defaultProblemStart < 0) throw new Error('Could not locate the seeded-problem sentence in Code Arena product behavior.');
  const matchText = matchAndProblems.slice(0, defaultProblemStart).trim();
  const defaultProblemText = matchAndProblems.slice(defaultProblemStart + 1).trim();
  const invitationBindingStart = lifecycle.indexOf('The invitation message carries');
  if (invitationBindingStart < 0) throw new Error('Could not locate the invitation-binding text after Code Arena lifecycle notifications.');
  const lifecycleNotifications = lifecycle.slice(0, invitationBindingStart).trim();
  const lifecycleRoomBinding = lifecycle.slice(invitationBindingStart).trim();
  const productBehaviorHtml = [
    mdToHtml(discoveryText, specPath),
    playGallery,
    mdToHtml(matchText, specPath),
    editorGallery,
    scoreRevealGallery,
    mdToHtml(defaultProblemText, specPath),
    mdToHtml(scoring, specPath),
    mdToHtml(collaboration, specPath),
    '<p>The live four-client run captured the ready lobby and every in-game session at once. The two Alpha clients share one synchronized team document, and the two Beta clients keep an independent document on the opposing side.</p>',
    collaborationGallery,
    mdToHtml(profileDetails, specPath),
    profileGallery,
    leaderboardGallery,
    mdToHtml(invitations, specPath),
    evidenceGallery(['03-owner-invitation-sent.png', '04-rival-sees-invitation.png']),
    mdToHtml(lifecycleNotifications, specPath),
    evidenceFigure('09-owner-chat-match-started.png'),
    mdToHtml(lifecycleRoomBinding, specPath),
  ].join('');
  const html = `
<p>This chapter summarizes the integrated Code Arena contract. ${specUrl ? `<a href="${esc(specUrl)}">The integration specification</a>` : 'The integration specification'} remains the detailed source for route ownership, privacy behavior and automated verification.</p>
<h3>Product behavior</h3>${productBehaviorHtml}
<h3>Challenge and lobby flow</h3>
<p>Creating a private room gives the host a short invite code. The lobby shows team capacity, player identity and readiness before a match begins.</p>
${lobbyGallery}
<p>Both clients join the same private lobby and receive synchronized room state.</p>
<p>The readiness gate blocks launch until every required player is ready. Once all seats are ready, only the host can start the match; the capture below shows the synchronized state from the other player’s view.</p>
${readyGallery}
<h3>Service boundary</h3>
<p>The browser reaches Game through Nginx at <code>/api/game/</code> and <code>/api/game/socket.io/</code>. Game validates User-issued RS256 tokens and owns its PostgreSQL data. The Judge worker runs submissions on a private network in resource-limited containers without network access. Game publishes lifecycle events through RabbitMQ; Chat validates them and stores notices in the conversation linked to a challenge.</p>
<p>Participants can leave a running match, which ends the game with a forfeit result. The live Aimane capture shows this outcome; the two-client Chat screenshots show the persisted match-start and match-result messages.</p>
${forfeitGallery}
${evidenceGallery(['13-owner-chat-match-result.png'])}
<h3>HTTP and realtime contracts</h3>${mdToHtml(section(spec, 'HTTP and realtime contracts'), specPath)}
<h3>Persistence and privacy boundary</h3>${mdToHtml(section(spec, 'Persistence and privacy boundary'), specPath)}
<p>Reloading and reconnecting preserves the conversation cards captured at the verification checkpoint.</p>
<h3>Verification and evaluation limits</h3>${mdToHtml(section(spec, 'Verification'), specPath)}
<p>A room owner may withdraw a challenge before the match starts. Chat records the cancellation in the linked conversation.</p>
${evidenceFigure('16-owner-chat-cancelled.png')}
<p>The Game service's expiry sweep also publishes a cancellation event; Chat stores the notice for the participants.</p>
${evidenceFigure('20-owner-chat-expired.png')}
<h3>Live G06 demonstration</h3>
<p>The live two-client run used two independent authenticated browser sessions and a real stack. It covered a duel invitation, acceptance, match start, forfeit result, withdrawal, expiry, and the transcript reload checkpoint. Both clients received the notices live. The expiry notice arrived after the reload checkpoint and was persisted once; it was not part of the before/after reload count.</p>
${mdToHtml(section(evidence, 'What was demonstrated'), evidencePath)}
${mdToHtml(section(evidence, 'What this does and does not prove'), evidencePath)}
<p>${screenshotLink}. This chapter places ${figureImages.size} distinct images beside their matching topics: dark-mode product and coding views from Aimane’s account, the live four-client 2v2 viewport captures, plus selected two-client invitation and lifecycle evidence. It leaves out setup-only screens, repeated views of the same state, and screenshots that show an empty lobby. The complete 21-image run and its limits are documented in <code>docs/evidence/g06-live-demo/README.md</code>.</p>`;
  if (includedEvidence.size !== expectedBookEvidence.size) {
    const unplaced = [...expectedBookEvidence].filter((filename) => !includedEvidence.has(filename));
    throw new Error(`G06 screenshots not placed in their matching sections: ${unplaced.join(', ')}`);
  }
  chapter('Code Arena: Game service integration and evidence', html);
}

// ============================================================== PART IV
part('Part IV: API Reference', 'User and Chat HTTP routes from the OpenAPI contracts, plus the Game HTTP and Socket.IO contract summarized in Part III.');

// ---- OpenAPI renderer
function resolveRef(spec, node) {
  let n = node, guard = 0;
  while (n && n.$ref && guard++ < 10) {
    n = n.$ref.replace(/^#\//, '').split('/').reduce((a, k) => a?.[k], spec);
  }
  return n;
}
function typeOf(spec, s) {
  s = resolveRef(spec, s) || {};
  if (s.enum) return `enum(${s.enum.join(' | ')})`;
  if (s.type === 'array') return `${typeOf(spec, s.items)}[]`;
  if (s.oneOf) return s.oneOf.map((o) => typeOf(spec, o)).join(' | ');
  if (s.anyOf) return s.anyOf.map((o) => typeOf(spec, o)).join(' | ');
  const bits = [s.type || (s.properties ? 'object' : 'any')];
  if (s.format) bits.push(s.format);
  if (s.minLength != null || s.maxLength != null) bits.push(`${s.minLength ?? 0}..${s.maxLength ?? ''}`);
  if (s.minimum != null || s.maximum != null) bits.push(`${s.minimum ?? ''}..${s.maximum ?? ''}`);
  return bits.join(' ');
}
function flatten(spec, schema, prefix = '', depth = 0, seen = new Set()) {
  let s = resolveRef(spec, schema);
  if (!s) return [];
  if (s.allOf) s = s.allOf.reduce((acc, p) => {
    const r = resolveRef(spec, p) || {};
    return { ...acc, ...r, properties: { ...(acc.properties || {}), ...(r.properties || {}) }, required: [...(acc.required || []), ...(r.required || [])] };
  }, {});
  if (s.type === 'array') return flatten(spec, s.items, `${prefix}[]`, depth, seen);
  if (!s.properties) return [];
  const req = new Set(s.required || []);
  const rows = [];
  for (const [k, v] of Object.entries(s.properties)) {
    const rv = resolveRef(spec, v) || {};
    rows.push({ name: prefix ? `${prefix}.${k}` : k, type: typeOf(spec, v), req: req.has(k), desc: rv.description || '' });
    const refKey = v.$ref;
    if (depth < 2 && (rv.properties || rv.type === 'array') && !(refKey && seen.has(refKey))) {
      const s2 = new Set(seen); if (refKey) s2.add(refKey);
      rows.push(...flatten(spec, v, prefix ? `${prefix}.${k}` : k, depth + 1, s2));
    }
  }
  return rows;
}
const dedent = (t = '') => {
  const lines = t.replace(/\r/g, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length), 1e9);
  return lines.map((l) => l.slice(ind === 1e9 ? 0 : ind)).join('\n');
};
function describe(op, method, path) {
  let d = dedent(op.description || '');
  const L = d.split('\n');
  // Drop the leading "### Title" and "`METHOD /path`" lines already shown in the heading.
  while (L.length && (/^\s*$/.test(L[0]) || /^#{1,6}\s/.test(L[0]) || /^`[A-Z]+ \/[^`]*`\s*$/.test(L[0].trim()))) L.shift();
  return shiftHeadings(L.join('\n'), 3).replace(/^#{4,6} /gm, '##### ');
}
function renderApi(spec, title) {
  const globalSec = spec.security && spec.security.length ? 'Bearer JWT' : 'Public';
  const ops = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      ops.push({ path, method, op, tag: (op.tags && op.tags[0]) || 'Other' });
    }
  }
  const tagOrder = [...(spec.tags || []).map((t) => t.name)];
  ops.forEach((o) => { if (!tagOrder.includes(o.tag)) tagOrder.push(o.tag); });
  const auth = (op) => (op.security === undefined ? globalSec : op.security.length ? 'Bearer JWT' : 'Public');

  const index = table(['Method', 'Path', 'Summary', 'Auth'], ops.map((o) => [
    `<span class="m ${o.method}">${o.method.toUpperCase()}</span>`, `<code>${esc(o.path)}</code>`, esc(o.op.summary || ''), auth(o.op),
  ]));

  let html = `<p>${esc(spec.info.description || '')}</p><p>Version <b>${esc(spec.info.version)}</b>. ${ops.length} operations on ${Object.keys(spec.paths).length} paths.</p>
<h3>${esc(title)} endpoint index</h3>${index}`;
  for (const tag of tagOrder) {
    const list = ops.filter((o) => o.tag === tag);
    if (!list.length) continue;
    const tdesc = (spec.tags || []).find((t) => t.name === tag)?.description;
    html += `<h3 class="tag">${esc(tag)}</h3>${tdesc ? `<p>${esc(tdesc)}</p>` : ''}`;
    for (const { path, method, op } of list) {
      const params = (op.parameters || []).map((p) => resolveRef(spec, p)).filter(Boolean);
      const body = resolveRef(spec, op.requestBody)?.content?.['application/json']?.schema;
      const bodyRows = body ? flatten(spec, body) : [];
      const resp = Object.entries(op.responses || {}).map(([c, r]) => [`<b>${esc(c)}</b>`, esc(resolveRef(spec, r)?.description || '')]);
      html += `<div class="op">
<div class="op-head"><span class="m ${method}">${method.toUpperCase()}</span><code class="path">${esc(path)}</code><span class="auth ${auth(op) === 'Public' ? 'pub' : 'sec'}">${auth(op)}</span></div>
<h4>${esc(op.summary || path)}</h4>
${mdToHtml(describe(op, method, path))}
${params.length ? `<h5>Parameters</h5>${table(['Name', 'In', 'Required', 'Type', 'Description'], params.map((p) => [`<code>${esc(p.name)}</code>`, esc(p.in), p.required ? 'yes' : 'no', esc(typeOf(spec, p.schema)), esc(p.description || '')]), 'small')}` : ''}
${bodyRows.length ? `<h5>Request body fields</h5>${table(['Field', 'Type', 'Required', 'Description'], bodyRows.map((r) => [`<code>${esc(r.name)}</code>`, esc(r.type), r.req ? 'yes' : 'no', esc(r.desc)]), 'small')}` : ''}
${resp.length ? `<h5>Responses</h5>${table(['Status', 'Meaning'], resp, 'small')}` : ''}
</div>`;
    }
  }
  return html;
}

{
  const authBlock = `
<p>Both services speak JSON over HTTP and are reached through the gateway: User service under <code>/api/</code> and Chat service under <code>/api/chat/</code>.</p>
<h3>Authentication</h3>
${mdToHtml(shiftHeadings(section(rd('docs/services/chat-service.md'), 'Authentication'), 2), 'docs/services/chat-service.md')}
<h3>Error shape</h3>
${mdToHtml(shiftHeadings(section(rd('docs/services/chat-service.md'), 'Error shape'), 2), 'docs/services/chat-service.md')}`;
  chapter('Conventions, authentication and errors', authBlock);
}
chapter('User service HTTP API', renderApi(userApi, 'User service'));
chapter('Chat service HTTP API', renderApi(chatApi, 'Chat service'));
chapter('Realtime protocol (Socket.IO)', mdToHtml(shiftHeadings(section(rd('docs/services/chat-service.md'), 'Socket.IO'), 2), 'docs/services/chat-service.md') +
  `<h3>Current limitations</h3>` + mdToHtml(shiftHeadings(section(rd('docs/services/chat-service.md'), 'Current limitations'), 2), 'docs/services/chat-service.md'));

// ============================================================== PART V
part('Part V: Data Model and Code Map', 'The database schemas and an index of every analysed file, grouped by architectural layer.');
{
  const prisma = (p) => `<pre><code>${esc(rd(p))}</code></pre>`;
  const tables = uaNodes.filter((n) => n.type === 'table' || n.type === 'schema');
  chapter('Database schemas and ownership',
    `<p>User, Chat and Game each own a separate PostgreSQL database; they never share tables. The Prisma schemas below cover User and Chat. Game persists its own match state and migrations under the Game service. Chat keeps a local <code>ChatUser</code> projection filled from RabbitMQ events and an HTTP fallback, never by reading the User database.</p>
<h3>User service schema</h3>${prisma('user-service/prisma/schema.prisma')}
<h3>Chat service schema</h3>${prisma('chat-service/prisma/schema.prisma')}
<h3>Tables and schemas found by the knowledge graph</h3>
${table(['Name', 'Defined in', 'Summary'], tables.map((n) => [`<code>${esc(n.name)}</code>`, `<code>${esc(n.filePath)}</code>`, goodSummary(n.summary) ? esc(n.summary) : '']), 'small')}`);
}
{
  const layerHtml = ua.layers
    .map((l) => {
      const ns = l.nodeIds.map((id) => uaById.get(id)).filter(Boolean).sort((a, b) => (a.filePath || '').localeCompare(b.filePath || ''));
      if (!ns.length) return '';
      return `<h3>${esc(l.name)} <small>(${ns.length} files)</small></h3><p class="muted">${esc(l.description)}</p>${table(
        ['File', 'Type', 'Summary'],
        ns.map((n) => [`<code>${esc(n.filePath)}</code>`, esc(n.type), goodSummary(n.summary) ? esc(n.summary) : ''])
        , 'small files')}`;
    })
    .join('');
  chapter('File index by layer', `<p>Summaries come from the Understand-Anything analysis. Entries without a summary are omitted rather than shown with a low-quality description.</p>${layerHtml}`);
}
{
  const eps = uaNodes.filter((n) => n.type === 'endpoint');
  chapter('Endpoint nodes in the knowledge graph',
    `<p>Route definitions the analyzer found in the source. For the authoritative contract, see Part IV.</p>${table(
      ['Endpoint', 'Defined in', 'Summary'],
      eps.map((n) => [`<code>${esc(n.name)}</code>`, `<code>${esc(n.filePath)}</code>`, goodSummary(n.summary) ? esc(n.summary) : '']),
      'small',
    )}`);
}

// ================================================================ assemble
const tocHtml = `<section class="toc"><h1 class="plain">Contents</h1>${toc
  .map((t) => `<div class="toc-${t.level}"><a href="#${t.id}">${esc(t.title)}</a></div>`)
  .join('')}</section>`;

const css = `
@page { size: A4; margin: 0; }
:root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --brand:#4f46e5; --soft:#f8fafc; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.5; }
body { margin: 0; }
code, pre { font-family: Consolas, "Cascadia Mono", "Courier New", monospace; }
code { font-size: .88em; background: #f1f5f9; padding: .05em .3em; border-radius: 3px; word-break: break-word; }
pre { background: #0f172a; color: #e2e8f0; padding: 9px 11px; border-radius: 6px; font-size: 7.6pt; line-height: 1.4; white-space: pre-wrap; word-break: break-word; page-break-inside: auto; }
pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
a { color: var(--brand); text-decoration: none; }
h1, h2, h3, h4, h5 { line-height: 1.25; }
h3 { font-size: 13pt; margin: 1.5em 0 .4em; border-bottom: 1px solid var(--line); padding-bottom: 3px; page-break-after: avoid; }
h3 small { color: var(--muted); font-weight: 400; font-size: 9pt; }
h4 { font-size: 11pt; margin: 1.2em 0 .3em; page-break-after: avoid; }
h5 { font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 1em 0 .3em; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
ul, ol { padding-left: 1.3em; }
blockquote { margin: .8em 0; padding: .1em 1em; border-left: 3px solid var(--brand); background: var(--soft); color: #334155; }
table { width: 100%; border-collapse: collapse; margin: .6em 0 1em; font-size: 8.6pt; table-layout: auto; }
th { white-space: nowrap; text-align: left; background: #eef2ff; color: #312e81; font-weight: 600; }
th, td { border: 1px solid var(--line); padding: 4px 7px; vertical-align: top; word-break: break-word; }
tr { page-break-inside: avoid; }
table.firstcol td:first-child, table.firstcol th:first-child { white-space: nowrap; }
table.small { font-size: 8pt; }
table.narrow { width: auto; min-width: 45%; }
table.files td:first-child { width: 38%; }
.two { display: flex; gap: 14px; align-items: flex-start; } .two table { flex: 1; }
.cap, .muted { color: var(--muted); font-size: 8.6pt; }

/* pages */
.cover, .part, .toc { page-break-after: always; }
.cover { height: 297mm; padding: 38mm 24mm 20mm; background: linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%); color: #fff; page-break-after: always; }
.cover-mark { width: 72px; height: 72px; border-radius: 18px; background: #fff; color: #4338ca; font-size: 44pt; font-weight: 700; display: grid; place-items: center; margin-bottom: 26mm; }
.cover-title { font-size: 64pt; margin: 0; letter-spacing: -.03em; }
.cover-sub { font-size: 20pt; margin: 4px 0 18px; color: #c7d2fe; }
.cover-tag { font-size: 11.5pt; color: #e0e7ff; max-width: 130mm; }
.cover-meta { margin-top: 30mm; font-size: 9pt; width: auto; border: 0; }
.cover-meta td { border: 0; border-top: 1px solid rgba(255,255,255,.2); padding: 6px 14px 6px 0; color: #e0e7ff; }
.cover-meta td:first-child { color: #a5b4fc; width: 34mm; }
.cover-meta code { background: rgba(255,255,255,.14); color: #fff; }
.toc { padding: 22mm 24mm; } .toc h1.plain { font-size: 24pt; margin: 0 0 14px; }
.toc-1 { font-weight: 700; margin-top: 12px; font-size: 11pt; } .toc-1 a { color: var(--brand); }
.toc-2 { margin-left: 14px; font-size: 9.6pt; } .toc-2 a { color: var(--ink); }
.part { height: 297mm; padding: 90mm 24mm 0; background: var(--soft); }
.part h1 { font-size: 34pt; margin: 0 0 12px; color: #312e81; letter-spacing: -.02em; }
.part-intro { font-size: 13pt; color: #475569; max-width: 130mm; }
.chapter { padding: 20mm 18mm 18mm; page-break-before: always; }
.chapter > h2 { font-size: 22pt; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 3px solid var(--brand); color: #1e1b4b; }
.chapter > h2 .no { display: inline-block; min-width: 1.5em; color: var(--brand); margin-right: .3em; }
img { max-width: 100%; }

/* diagram */
.diagram { width: 100%; height: auto; margin: 6px 0; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.diagram .bx rect { stroke-width: 1.3; } .diagram .t { font: 600 13.5px Segoe UI, Arial; text-anchor: middle; fill: #0f172a; }
.diagram .s { font: 10.5px Segoe UI, Arial; text-anchor: middle; fill: #475569; } .diagram .lb { font: 600 10.5px Segoe UI, Arial; fill: #334155; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
.diagram .ar { stroke: #475569; stroke-width: 1.4; } .diagram .ar.dash { stroke-dasharray: 4 3; }
.bx.ext rect { fill: #f1f5f9; stroke: #94a3b8; } .bx.gw rect { fill: #e0e7ff; stroke: #4f46e5; } .bx.app rect { fill: #dbeafe; stroke: #2563eb; }
.bx.store rect { fill: #fef3c7; stroke: #d97706; } .bx.db rect { fill: #dcfce7; stroke: #16a34a; } .bx.mq rect { fill: #fce7f3; stroke: #db2777; }
.bx.mon rect { fill: #f3e8ff; stroke: #9333ea; } .bx.job rect { fill: #fff7ed; stroke: #ea580c; stroke-dasharray: 4 3; }

/* tour + api */
.step { border-left: 3px solid var(--brand); padding: 2px 0 2px 12px; margin: 10px 0; page-break-inside: avoid; } .step h3 { border: 0; margin: 0 0 3px; font-size: 11.5pt; } .files code { margin-right: 4px; display: inline-block; }
.op { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px 4px; margin: 14px 0; }
.op-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.op-head .path { font-size: 10pt; background: none; padding: 0; font-weight: 600; }
.op h4 { margin-top: 6px; }
.m { display: inline-block; min-width: 46px; text-align: center; padding: 1px 6px; border-radius: 4px; font: 700 7.5pt Consolas, monospace; color: #fff; }
.m.get { background: #16a34a; } .m.post { background: #2563eb; } .m.patch { background: #d97706; } .m.put { background: #d97706; } .m.delete { background: #dc2626; }
.auth { margin-left: auto; font-size: 7.5pt; padding: 1px 7px; border-radius: 9px; }
.auth.pub { background: #dcfce7; color: #166534; } .auth.sec { background: #fee2e2; color: #991b1b; }
h3.tag { background: #eef2ff; border: 0; padding: 5px 10px; border-radius: 6px; color: #312e81; }
.gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .gallery figure.wide { grid-column: 1 / -1; } figure { margin: 0; page-break-inside: avoid; } figure img { border: 1px solid var(--line); border-radius: 6px; } figcaption { font-size: 8pt; color: var(--muted); text-align: center; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Nook: The Application Book</title><style>${css}</style></head><body>${cover}${tocHtml}${parts.join('\n')}</body></html>`;
const htmlPath = join(DIST, 'book.html');
writeFileSync(htmlPath, html);
console.log(`HTML written: ${(html.length / 1024).toFixed(0)} KB, ${toc.length} toc entries`);

// ================================================================== PDF
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 120000 });
  await page.pdf({
    path: OUT_PDF,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font:8px Segoe UI,Arial;color:#94a3b8;display:flex;justify-content:space-between;padding:0 18mm"><span>Nook: The Application Book</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '0', bottom: '10mm', left: '0', right: '0' },
    outline: true,
    tagged: true,
    timeout: 300000,
  });
} finally {
  await browser.close();
}
console.log(`PDF written: ${OUT_PDF}`);
