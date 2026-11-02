// Headless smoke test: serve the game, click Begin, drive a few commands, screenshot, fail on page errors.
// node tools/smoke.mjs [outDir]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/opt/claude/tools/browser/');
const { chromium } = require('playwright-core');

const root = resolve(new URL('..', import.meta.url).pathname);
const out = process.argv[2] || '/tmp';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(root)) throw new Error('path');
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => !document.querySelector('#begin').disabled, null, { timeout: 60000 });
await page.screenshot({ path: `${out}/ds-intro.png` });
await page.click('#begin');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/ds-start.png` });

// drive: Elena fills the tub, Marcus searches the fridge, fast-forward
const r = await page.evaluate(() => {
  const g = window.__game;
  const [marcus, elena] = g.family;
  const fridge = g.map.objects.find((o) => o.home && o.ch === 'F');
  const okTub = elena.useObject(g.map.tub, 'fillTub');
  const okFridge = marcus.useObject(fridge, 'search');
  g.setSpeed(10);
  return { okTub, okFridge, frames: g.frames };
});
await page.waitForTimeout(12000);
const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    clock: g.sim.clock(), tub: Math.round(g.sim.tubL), frames: g.frames,
    fridge: g.map.objects.find((o) => o.home && o.ch === 'F').items.length,
    open: !!g.open, fam: g.family.map((m) => `${m.name}:${m.status()[0]}:${Math.round(m.needs.hydration)}:${m.bodyT.toFixed(1)}`),
    log: [...document.querySelectorAll('#log div')].map((d) => d.textContent).slice(-5),
  };
});
await page.screenshot({ path: `${out}/ds-play.png` });
// a night shot
await page.evaluate(() => { const g = window.__game; g.sim.min = 22 * 60; g.setSpeed(0); });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/ds-night.png` });
await page.evaluate(() => { const g = window.__game; g.sim.min = 15 * 60; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/ds-afternoon.png` });

console.log(JSON.stringify({ r, state }, null, 1));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
