// Dry Heat no-jump playthrough (added in wave 4b review): real clicks only (Begin, speed buttons, Now line,
// world clicks at screen centre, menu actions, choice buttons, Skip ahead).
// window.__game is used ONLY to read state for the checks, never to act.
// node tools/playthrough.mjs [outDir]   (gameRoot defaults to this checkout)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/opt/claude/tools/browser/');
const { chromium } = require('playwright-core');

const root = resolve(new URL('..', import.meta.url).pathname);
const out = process.argv[2] || '/tmp/dh-playthrough';
await mkdir(out, { recursive: true });
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
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = 1366, H = 768;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const st = () => page.evaluate(() => {
  const g = window.__game; const q = (s) => document.querySelector(s);
  return {
    speed: g.sim.speed, clock: q('#clock')?.textContent?.trim(),
    now: q('#objectives .now')?.textContent?.trim() || '',
    skip: !!q('#objectives .skip-ahead'),
    choice: !!q('#beat-choice:not(.hidden) button'),
    menu: !q('#menu').classList.contains('hidden'),
    fam: g.family.filter((m) => !m.away).map((m) => ({ id: m.def?.id || m.name, cell: m.cell().join(','), doing: (m.doing?.() || '').slice(0, 40) })),
  };
});
const log = [];
let shot = 0;
const snap = async (tag) => { if (shot < 40) await page.screenshot({ path: `${out}/${String(++shot).padStart(2, '0')}-${tag}.png` }); };
const note = (s) => { log.push(s); console.log(s); };

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => !document.querySelector('#begin').disabled, null, { timeout: 90000 });
await page.click('#begin');
await page.waitForTimeout(2000);
let s = await st();
note(`START speed=${s.speed} clock=${s.clock} now="${s.now}"`);
const startSpeedOk = s.speed === 1;
await snap('start');

// a player who wants it quicker clicks the fast button
await page.click('#speed button[data-s="4"]');
let skipResult = null; const overlaps = new Set(); let sameCellSamples = 0;
const t0 = Date.now();
for (let i = 0; i < 60 && Date.now() - t0 < 9 * 60 * 1000; i++) {
  s = await st();
  // idle overlap check: two present people on one cell
  const byCell = {};
  for (const m of s.fam) (byCell[m.cell] ||= []).push(m.id);
  for (const [c, ids] of Object.entries(byCell)) if (ids.length > 1) { overlaps.add(`${s.clock} ${c}: ${ids.join('+')}`); sameCellSamples++; }
  note(`#${i} ${s.clock} x${s.speed} now="${s.now.slice(0, 70)}" skip=${s.skip} choice=${s.choice} | ` + s.fam.map((m) => `${m.id}@${m.cell}:${m.doing}`).join(' ; '));

  if (s.choice) {
    await snap(`choice-${i}`);
    await page.click('#beat-choice button'); // first option, like a player
    note('  -> picked first choice option');
    await page.waitForTimeout(2500); continue;
  }
  if (s.skip && !skipResult) {
    const before = s.speed;
    await snap(`skip-visible-${i}`);
    await page.click('#objectives .skip-ahead');
    await page.waitForTimeout(800);
    const during = (await st()).speed;
    note(`  -> clicked Skip ahead: speed ${before} -> ${during}`);
    let after = during; let waited = 0;
    while (waited < 120000) { await page.waitForTimeout(2000); waited += 2000; const x = await st(); if (!x.skip && x.speed !== 12) { after = x.speed; break; } after = x.speed; }
    const x = await st();
    skipResult = { before, during, after, at: x.clock, now: x.now };
    note(`  -> skip ended: speed ${after} at ${x.clock} now="${x.now}" (${waited / 1000}s real)`);
    await snap(`after-skip-${i}`);
    continue;
  }
  if (s.now) {
    await page.click('#objectives .now');
    await page.waitForTimeout(1500);
    // click the target at screen centre; nudge if a person is in the way
    let acted = false;
    for (const [dx, dy] of [[0, 0], [0, -25], [25, 0], [-25, 0], [0, 25]]) {
      await page.mouse.click(W / 2 + dx, H / 2 + dy);
      await page.waitForTimeout(400);
      const menu = await page.evaluate(() => {
        const m = document.querySelector('#menu');
        if (m.classList.contains('hidden')) return null;
        return { title: m.querySelector('.mt')?.textContent || '', primary: !!m.querySelector('button.beat-action:not([disabled])'), items: [...m.querySelectorAll('button')].map((b) => b.textContent.trim()) };
      });
      if (!menu) continue;
      if (menu.primary) {
        if (i < 12) await snap(`menu-${i}`);
        await page.click('#menu button.beat-action:not([disabled])');
        note(`  -> menu "${menu.title}": clicked primary action`);
        acted = true; break;
      }
      note(`  -> menu "${menu.title}" had no primary action: ${menu.items.join(' | ')}`);
      await page.mouse.click(10, H - 10); // dismiss
    }
    if (!acted) { note('  -> could not act on the Now target from the screen'); await snap(`stuck-${i}`); }
  }
  await page.waitForTimeout(acted_wait());
  if (skipResult && i > 40) break;
}
function acted_wait() { return 4000; }

s = await st();
await snap('end');
note(`END ${s.clock} x${s.speed} now="${s.now}"`);
note(`CHECK start speed 1x: ${startSpeedOk ? 'PASS' : 'FAIL'}`);
note(`CHECK skip ahead: ${skipResult ? JSON.stringify(skipResult) : 'never appeared'}`);
note(`CHECK same-cell samples: ${sameCellSamples} ${[...overlaps].slice(0, 12).join(' | ')}`);
note(`ERRORS: ${errors.length} ${errors.slice(0, 5).join(' | ')}`);
await browser.close(); server.close();
