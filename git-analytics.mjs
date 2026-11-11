#!/usr/bin/env node
// Run with Node.js 20+ and Git. No npm install required.
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const cwd = dirname(fileURLToPath(import.meta.url));
const day = 86_400_000;
const date = (time) => new Date(time).toISOString().slice(0, 10);
const clean = (text) => text.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');

function git(args, input) {
  return execFileSync('git', args, {
    cwd, input, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function main() {
  const { values } = parseArgs({ options: {
    'no-fetch': { type: 'boolean' },
    branch: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Usage: node git-analytics.mjs [options]

Fetch origin and report unique commits across its branches.
  --no-fetch       Use cached origin refs (offline)
  --branch NAME    Limit history to one origin branch, e.g. main
  --json           Print JSON instead of the terminal report
  -h, --help       Show this help

Fetch updates remote-tracking refs only; it never merges or checks out files.
Shallow clones are unshallowed when fetching. Identity aliases use .mailmap.
Merge commits are counted separately. Contributor totals and pulse exclude merges.
Activity uses author timestamps in UTC; co-author credit counts once per person
per commit. These counts describe recorded history, not effort or code quality.`);
    return;
  }

  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  if (!values['no-fetch']) {
    console.error('Fetching origin history...');
    git(['fetch', '--prune', '--no-tags', ...(shallow ? ['--unshallow'] : []),
      'origin', '+refs/heads/*:refs/remotes/origin/*']);
  }
  const refs = git(['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes/origin/'])
    .trim().split('\n').filter(Boolean)
    .map((line) => line.trimEnd().split('\t'))
    .filter(([, symref]) => !symref)
    .map(([ref]) => ref)
    .filter((ref) => !values.branch || ref === `refs/remotes/origin/${values.branch}`);
  if (!refs.length) throw new Error('No matching origin branches. Fetch origin or check --branch.');

  // NUL-delimited fields keep subjects and trailer newlines out of the framing.
  const fields = git(['log', '-z', '--format=%H%x00%P%x00%aN%x00%aE%x00%at%x00%s%x00%(trailers:key=Co-authored-by,valueonly,separator=%x1f)',
    ...refs, '--']).split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 7) throw new Error('Unexpected Git log format.');
  const history = [];
  for (let i = 0; i < fields.length; i += 7) {
    const [hash, parents, name, email, timestamp, subject, trailers] = fields.slice(i, i + 7);
    history.push({ hash, merge: parents.split(' ').length > 1,
      author: `${name} <${email}>`, time: Number(timestamp) * 1000, subject,
      coauthors: trailers.split('\x1f').map((s) => s.trim())
        .filter((s) => /^[^<>\r\n]+ <[^<>\s]+>$/.test(s)),
    });
  }

  // Apply the same mailmap to authors and trailer identities, including aliases.
  const identities = [...new Set(history.flatMap((c) => [c.author, ...c.coauthors]))];
  const mapped = identities.length
    ? git(['check-mailmap', '--stdin'], identities.join('\n') + '\n').trimEnd().split('\n') : [];
  const people = new Map();
  const canonical = new Map();
  for (let i = 0; i < identities.length; i++) {
    const match = mapped[i].match(/^(.*) <([^<>]+)>$/);
    if (!match) throw new Error('Unexpected contributor identity from Git.');
    const [, name, email] = match;
    const key = email.toLowerCase();
    canonical.set(identities[i], key);
    if (!people.has(key)) people.set(key, {
      name, email, authored: 0, coauthored: 0, credited: 0, last30Days: 0,
      activeDays: new Set(), first: null, last: null,
    });
  }

  const now = Date.now();
  const commits = history.filter((c) => !c.merge);
  for (const commit of commits) {
    const author = canonical.get(commit.author);
    const credited = new Set([author, ...commit.coauthors.map((p) => canonical.get(p))]);
    for (const key of credited) {
      const person = people.get(key);
      person[key === author ? 'authored' : 'coauthored']++;
      person.credited++;
      if (commit.time >= now - 30 * day && commit.time <= now) person.last30Days++;
      const stamp = date(commit.time);
      person.activeDays.add(stamp);
      if (!person.first || stamp < person.first) person.first = stamp;
      if (!person.last || stamp > person.last) person.last = stamp;
    }
  }
  const contributors = [...people.values()].filter((p) => p.credited)
    .map((p) => ({ ...p, activeDays: p.activeDays.size }))
    .sort((a, b) => b.credited - a.credited || a.name.localeCompare(b.name));
  const inWindow = (start, end) => commits.filter((c) => c.time >= start && c.time < end);
  const pulse = [7, 30].map((days) => {
    const current = inWindow(now - days * day, now + 1);
    const previous = inWindow(now - 2 * days * day, now - days * day);
    return { days, commits: current.length, previousCommits: previous.length,
      changePercent: previous.length ? Math.round((current.length / previous.length - 1) * 100) : null,
      contributors: new Set(current.flatMap((c) => [c.author, ...c.coauthors].map((p) => canonical.get(p)))).size };
  });
  const monday = new Date(date(now));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const start = monday.getTime() - (11 - i) * 7 * day;
    return { week: date(start), commits: inWindow(start, Math.min(start + 7 * day, now + 1)).length };
  });
  const branches = refs.map((ref) => ({
    branch: ref.slice('refs/remotes/'.length),
    commits: Number(git(['rev-list', '--count', '--no-merges', ref, '--']).trim()),
  }));
  const ordered = [...history].sort((a, b) => b.time - a.time || a.hash.localeCompare(b.hash));
  const report = {
    generatedAt: new Date(now).toISOString(),
    scope: values.branch ? `origin/${values.branch}` : 'all origin branches (unique commit IDs)',
    fetched: !values['no-fetch'],
    shallow: git(['rev-parse', '--is-shallow-repository']).trim() === 'true',
    timestampBasis: 'author date, UTC',
    totalCommits: history.length, nonMergeCommits: commits.length,
    mergeCommits: history.length - commits.length,
    firstCommit: ordered.length ? date(ordered.at(-1).time) : null,
    latestCommit: ordered.length ? date(ordered[0].time) : null,
    contributors, pulse, weekly, branches,
    recent: ordered.slice(0, 10).map((c) => ({ hash: c.hash, date: date(c.time),
      author: people.get(canonical.get(c.author)).name, subject: c.subject, merge: c.merge })),
  };
  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nGit analytics | ${report.scope}`);
  console.log(`History: ${report.firstCommit ?? '-'} to ${report.latestCommit ?? '-'} | author dates, UTC`);
  console.log(`${report.totalCommits} unique commits | ${report.nonMergeCommits} non-merge | ${report.mergeCommits} merges | ${contributors.length} contributors`);
  if (!report.fetched) console.log('Using cached remote-tracking refs (--no-fetch).');
  if (report.shallow) console.log('WARNING: shallow history; counts are incomplete. Run without --no-fetch.');
  console.log('\nContributors (non-merge commits; .mailmap applied)');
  console.table(contributors.map((p) => ({ User: clean(p.name), Email: clean(p.email),
    Authored: p.authored, 'Co-authored': p.coauthored, Credited: p.credited,
    'Last 30d': p.last30Days, 'Active days': p.activeDays, First: p.first, Latest: p.last })));
  console.log('Credited = authored + co-authored; each person counts once per commit.');
  console.log('Shared commits credit multiple people, so person totals can exceed unique commits.');
  console.log('\nPulse (non-merge commits; rolling windows)');
  for (const p of pulse) {
    const change = p.changePercent === null ? 'n/a (no previous commits)' : `${p.changePercent >= 0 ? '+' : ''}${p.changePercent}%`;
    console.log(`Last ${p.days} days: ${p.commits} commits, ${p.contributors} contributors | previous ${p.days} days: ${p.previousCommits} | ${change}`);
  }
  console.log('\nWeekly activity (UTC Monday starts; current week is partial)');
  const peak = Math.max(1, ...weekly.map((w) => w.commits));
  for (const w of weekly) console.log(`${w.week}  ${String(w.commits).padStart(4)}  ${'#'.repeat(w.commits ? Math.max(1, Math.round(w.commits / peak * 32)) : 0)}`);
  console.log('\nBranches (non-merge history; overlaps between branches are expected)');
  console.table(branches.map((b) => ({ Branch: clean(b.branch), Commits: b.commits })));
  console.log('\nLatest commits by author date (includes merges)');
  for (const c of report.recent) console.log(`${c.hash.slice(0, 9)} ${c.date} ${clean(c.author)} | ${clean(c.subject)}${c.merge ? ' [merge]' : ''}`);
  console.log('\nCounts describe recorded history, not effort or code quality. Local backup/review branches are excluded.');
}

try {
  main();
} catch (error) {
  console.error(`Git analytics failed: ${clean(error.stderr?.toString().trim() || error.message)}`);
  process.exitCode = 1;
}
