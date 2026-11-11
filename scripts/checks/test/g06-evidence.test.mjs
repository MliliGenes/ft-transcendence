import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateG06Evidence } from '../g06-evidence.mjs';

const evidenceDirectory = fileURLToPath(new URL('../../../docs/evidence/g06-live-demo/', import.meta.url));
const evidence = JSON.parse(readFileSync(`${evidenceDirectory}/evidence.json`, 'utf8'));
const readme = readFileSync(`${evidenceDirectory}/README.md`, 'utf8');
const screenshots = readdirSync(evidenceDirectory).filter((name) => name.endsWith('.png'));

test('G06 evidence times and screenshot bundle agree with the documented run', () => {
  const pdf = readFileSync(`${evidenceDirectory}/screenshots.pdf`);
  const result = validateG06Evidence(evidence, readme, screenshots, pdf);
  assert.equal(result.screenshotCount, 21);
  assert.equal(result.pdfPageCount, 21);
  assert.equal(result.expiryAfterReload, true);
});

test('G06 evidence rejects a PDF that does not contain all screenshots', () => {
  assert.throws(() => validateG06Evidence(evidence, readme, screenshots, Buffer.from('%PDF-1.7\n')), /PDF.*21 pages/i);
});

test('G06 evidence rejects a finish time before its last observation', () => {
  const invalid = structuredClone(evidence);
  invalid.finishedAt = invalid.steps[0].at;
  assert.throws(() => validateG06Evidence(invalid, readme, screenshots), /finishedAt/);
});

test('G06 evidence requires the reload claim to match expiry timing', () => {
  const invalidReadme = readme.replace(/The expiry notice arrived after the reload check\./, '');
  assert.throws(() => validateG06Evidence(evidence, invalidReadme, screenshots), /expiry.*reload/i);
});
