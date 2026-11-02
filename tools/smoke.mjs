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
    opens: g.opens.size, theoToElena: g.family[3].pos.distanceTo(g.family[1].pos).toFixed(1), kids: g.family.filter((m) => m.ai).map((m) => m.doing()), fam: g.family.map((m) => `${m.name}:${m.status()[0]}:${Math.round(m.needs.hydration)}:${m.bodyT.toFixed(1)}`),
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

// physiology calibration: run the real body model in-page, no rendering
const calib = await page.evaluate(() => {
  const g = window.__game;
  const out = {};
  const snap = (m) => ({ deficit: m.deficit, bodyT: m.bodyT, needs: { ...m.needs }, collapsed: m.collapsed, dead: m.dead, flags: { ...m.flags } });
  const restore = (m, s) => Object.assign(m, { deficit: s.deficit, bodyT: s.bodyT, needs: s.needs, collapsed: s.collapsed, dead: s.dead, flags: s.flags });
  const simMin = g.sim.min, indoor = g.sim.indoor, logFn = g.log, onDeath = g.onDeath, alarm = g.alarm;
  g.log = () => {}; g.onDeath = () => {}; g.alarm = () => {};
  for (const [label, startMin, cell, walking] of [['outside 3PM walking', 15 * 60, [30, 17], true], ['indoors from 6AM idle', 6 * 60, [29, 11], false]]) {
    for (const m of [g.family[0], g.family[3]]) {
      const s = snap(m); const pos = m.pos.clone();
      Object.assign(m, { deficit: 0.3, bodyT: 98.6, collapsed: false, dead: false, flags: {} });
      m.needs.health = 100;
      g.sim.min = startMin; g.sim.indoor = startMin < 7 * 60 ? 79 : 92;
      m.pos.set(cell[0] + 0.5, 0, cell[1] + 0.5);
      m.path = walking ? [[9999, 9999]] : []; m.task = null;
      const marks = {};
      for (let t = 0; t < 48 * 60 && !m.dead; t += 0.5) {
        g.sim.step(0.5);
        m.updateBody(0.5);
        const h = (t / 60).toFixed(2);
        if (!marks.thirsty && m.pct > 1.2) marks.thirsty = h;
        if (!marks.dehydrated && m.pct > 2.5) marks.dehydrated = h;
        if (!marks.exhaustion && m.bodyT >= 101.5) marks.exhaustion = h;
        if (!marks.collapse && m.collapsed) marks.collapse = h;
        if (m.needs.health <= 0) { marks.death = h; break; }
      }
      out[`${label} / ${m.name}`] = marks;
      m.path = []; restore(m, s); m.pos.copy(pos);
    }
  }
  g.sim.min = simMin; g.sim.indoor = indoor; g.log = logFn; g.onDeath = onDeath; g.alarm = alarm;
  return out;
});
// scenarios driven directly through the game API (no waiting on slow software rendering)
const scen = await page.evaluate(() => {
  const g = window.__game;
  const [marcus, elena, jess, theo] = g.family;
  const run = (n, until) => { const sp = g.sim.speed; g.sim.speed = 10; for (let i = 0; i < n; i++) { g.sim.step(0.5); for (const m of g.family) m.update(0.5, 0.05); if (until && until()) break; } g.sim.speed = sp; };
  const res = {};
  // 1. two parents, two containers, both stay open
  const pantry = g.map.objects.find((o) => o.home && o.ch === 'K');
  const closet = g.map.objects.find((o) => o.home && o.ch === 'C');
  marcus.useObject(pantry, 'search'); elena.useObject(closet, 'search');
  run(200, () => g.opens.size === 2);
  res.bothOpen = g.opens.size;
  // 2. whole-family mattress job
  const crew = g.family.filter((m) => !m.dead);
  g.startJob(marcus, { label: 'Moving mattresses', dur: 15, crew, anchor: [31, 11], done: () => g.moveMattresses() });
  run(600, () => g.mattressesMoved);
  res.mattresses = !!g.mattressesMoved;
  res.jobKids = [jess.doing(), theo.doing()];
  // 3. Marcus collapses in the street; Elena drags, Jess helps
  marcus.stopTask(true); marcus.pos.set(30.5, 0, 21.5);
  g.sim.min = 15 * 60; marcus.bodyT = 105; marcus.updateBody(0.1);
  res.collapsed = marcus.collapsed;
  elena.tend(marcus, 'drag'); jess.order('help', elena);
  let carried = false;
  run(800, () => { if (elena.task?.type === 'drag' && elena.helpers(2.6).length) carried = true; return g.map.isIndoor(...marcus.cell()) && !marcus.draggedBy; });
  res.carriedWithHelp = carried;
  res.marcusIndoor = g.map.isIndoor(...marcus.cell());
  res.log = [...document.querySelectorAll('#log div')].map((d) => d.textContent).slice(-8);
  return res;
});
console.log('scenarios:', JSON.stringify(scen, null, 1));
console.log('calibration (game hours):', JSON.stringify(calib, null, 1));
console.log(JSON.stringify({ r, state }, null, 1));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
