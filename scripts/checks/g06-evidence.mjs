import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, cli, isMain } from './process.mjs';

const REQUIRED_STEPS = [
  'owner-sent-invitation', 'rival-received-invitation', 'rival-joined-lobby',
  'after-start', 'after-result', 'owner-withdrew-challenge', 'after-withdrawal', 'after-reload',
];

export function validateG06Evidence(evidence, readme, screenshotNames, pdfBytes) {
  const stepNames = new Set(evidence.steps?.map(({ step }) => step));
  for (const name of REQUIRED_STEPS) {
    if (!stepNames.has(name)) throw new Error(`G06 evidence is missing step: ${name}`);
  }
  const timestamps = (evidence.steps ?? []).map(({ at }) => Date.parse(at));
  if (timestamps.some(Number.isNaN)) throw new Error('G06 evidence contains an invalid step timestamp.');
  const expiryAt = Date.parse(evidence.expiry?.at);
  const finishedAt = Date.parse(evidence.finishedAt);
  if (Number.isNaN(expiryAt) || Number.isNaN(finishedAt)) throw new Error('G06 evidence contains an invalid expiry or finishedAt timestamp.');
  if (timestamps.some((time, index) => index > 0 && time < timestamps[index - 1])) {
    throw new Error('G06 evidence step timestamps are out of order.');
  }
  if (finishedAt < Math.max(expiryAt, ...timestamps)) {
    throw new Error('G06 evidence finishedAt precedes its last observation.');
  }

  const reload = evidence.steps.find(({ step }) => step === 'after-reload');
  const expiryAfterReload = expiryAt > Date.parse(reload.at);
  if (expiryAfterReload && !readme.includes('The expiry notice arrived after the reload check.')) {
    throw new Error('G06 evidence must state that the expiry notice came after the reload check.');
  }
  for (const account of ['owner', 'rival']) {
    if (reload.before?.[account] !== reload.after?.[account] || !Number.isInteger(reload.after?.[account])) {
      throw new Error(`G06 evidence reload count differs for ${account}.`);
    }
    if (!evidence.expiry[account]?.some(({ label, text }) =>
      label === 'Code Arena challenge cancelled' && /expired before it started/i.test(text))) {
      throw new Error(`G06 evidence is missing the expiry notice for ${account}.`);
    }
  }

  const orderedScreenshots = [...screenshotNames].sort();
  if (orderedScreenshots.length !== 21 || orderedScreenshots.some((name, index) =>
    !new RegExp(`^${String(index + 1).padStart(2, '0')}-[a-z0-9-]+\\.png$`).test(name))) {
    throw new Error('G06 evidence must include its ordered set of 21 numbered screenshots.');
  }
  const validPdf = Buffer.isBuffer(pdfBytes) && pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'));
  const pdfPageCount = validPdf ? [...pdfBytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length : 0;
  if (pdfPageCount !== orderedScreenshots.length) {
    throw new Error(`G06 screenshot PDF must contain all 21 pages; found ${pdfPageCount}.`);
  }
  return { screenshotCount: orderedScreenshots.length, pdfPageCount, expiryAfterReload };
}

async function main() {
  const evidenceDirectory = join(root, 'docs/evidence/g06-live-demo');
  const [rawEvidence, readme, directoryEntries, pdfBytes] = await Promise.all([
    readFile(join(evidenceDirectory, 'evidence.json'), 'utf8'),
    readFile(join(evidenceDirectory, 'README.md'), 'utf8'),
    readdir(evidenceDirectory),
    readFile(join(evidenceDirectory, 'screenshots.pdf')),
  ]);
  const result = validateG06Evidence(JSON.parse(rawEvidence), readme, directoryEntries.filter((name) => name.endsWith('.png')), pdfBytes);
  console.log(`G06 evidence is consistent: ${result.screenshotCount} screenshots and ${result.pdfPageCount} PDF pages; expiry ${result.expiryAfterReload ? 'followed' : 'preceded'} reload.`);
}

if (isMain(import.meta.url)) await cli(main);
