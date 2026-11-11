import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from '../checks/process.mjs';

const execFileAsync = promisify(execFile);
const evidenceDirectory = join(root, 'docs/evidence/g06-live-demo');
const output = join(evidenceDirectory, 'screenshots.pdf');

async function findChrome() {
  if (process.env.G06_CHROME_BIN) return process.env.G06_CHROME_BIN;
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['google-chrome', 'chromium', 'chromium-browser'];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'], { timeout: 5000 });
      return candidate;
    } catch { /* Try the next installed browser. */ }
  }
  throw new Error('Install Google Chrome/Chromium or set G06_CHROME_BIN to its executable.');
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

async function main() {
  const screenshots = (await readdir(evidenceDirectory))
    .filter((name) => /^\d{2}-[a-z0-9-]+\.png$/i.test(name))
    .sort();
  if (screenshots.length !== 21) throw new Error(`Expected 21 numbered screenshots; found ${screenshots.length}.`);

  const chrome = await findChrome();
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nook-g06-pdf-'));
  try {
    const pages = screenshots.map((name, index) => {
      const title = name.replace(/^\d{2}-/, '').replace(/\.png$/i, '').replaceAll('-', ' ');
      const image = pathToFileURL(join(evidenceDirectory, name)).href;
      return `<section class="page"><header>${escapeHtml(title)}</header><main><img src="${escapeHtml(image)}"></main><footer>NOOK | G06 LIVE DEMO | PAGE ${index + 1} OF ${screenshots.length}</footer></section>`;
    }).join('\n');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c}
      .page{width:279.4mm;height:215.9mm;padding:8mm 8mm 6mm;display:flex;flex-direction:column;break-after:page;page-break-after:always;overflow:hidden}
      .page:last-child{break-after:auto;page-break-after:auto}header{height:11mm;flex:0 0 11mm;background:#1f2022;color:#fff;padding:2.5mm 4mm;font-size:13pt;font-weight:700;text-transform:capitalize}
      main{height:180mm;flex:0 0 180mm;display:flex;align-items:center;justify-content:center;padding:4mm 0}img{display:block;max-width:100%;max-height:100%;object-fit:contain}
      footer{height:6mm;flex:0 0 6mm;color:#666;font-size:8pt;letter-spacing:.7px;padding-top:1mm}
      </style></head><body>${pages}</body></html>`;
    const htmlPath = join(temporaryDirectory, 'index.html');
    await writeFile(htmlPath, html, 'utf8');
    await execFileAsync(chrome, [
      '--headless', '--disable-gpu', '--disable-background-networking', '--disable-extensions',
      '--no-first-run', '--no-default-browser-check', '--no-pdf-header-footer',
      `--user-data-dir=${join(temporaryDirectory, 'profile')}`,
      `--print-to-pdf=${output}`, pathToFileURL(htmlPath).href,
    ], { timeout: 90000, maxBuffer: 1024 * 1024 });

    const pdf = await readFile(output);
    const pagesInPdf = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || pagesInPdf !== screenshots.length) {
      throw new Error(`Generated PDF validation failed: expected ${screenshots.length} pages, found ${pagesInPdf}.`);
    }
    console.log(`Created ${pagesInPdf}-page screenshot PDF: ${output}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
