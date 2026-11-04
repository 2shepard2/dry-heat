// Node 22, no packages: node --test src/systems.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
// Use the exact vendored browser dependencies for the real Member model.
register('data:text/javascript,' + encodeURIComponent(`
  let root;
  export function initialize(data) { root = data.root; }
  export async function resolve(s, ctx, next) {
    if (s === 'three') return { url: new URL('vendor/three/three.module.js', root).href, shortCircuit: true };
    if (s.startsWith('three/addons/')) return { url: new URL('vendor/' + s, root).href, shortCircuit: true };
    return next(s, ctx);
  }
`), { parentURL: import.meta.url, data: { root: new URL('../', import.meta.url).href } });
const THREE = await import('three');
const { Member, FAMILY } = await import('./family.js');
const { makeFigure } = await import('./figure.js');
const { Sim } = await import('./sim.js');
const { buildMap } = await import('./map.js');
const { makeRng } = await import('./rng.js');
const { ITEMS, makeEntry, addEntry, isSpoiled } = await import('./inventory.js');
const { SurvivalSystems } = await import('./systems.js');
const { NightEvents } = await import('./events.js');
const { flagsMatch } = await import('./conditions.js');

function fixture(decisions) {
  const messages = [];
  const g = { sim: new Sim(), map: buildMap(), family: [], selected: [], ITEMS,
    decisions, rng: makeRng(23), scene: new THREE.Scene(), lights: [],
    log: (s) => messages.push(s), objective: () => {}, candleHeat: () => 0, isDark: () => false,
    onDeath: () => {}, alarm: () => {}, freeBed: () => null };
  g.systems = new SurvivalSystems(g);
  const fig = makeFigure(), box = new THREE.Box3().setFromObject(fig.scene);
  for (const d of FAMILY) g.family.push(new Member(d, fig, box.max.y - box.min.y, g));
  g.startJob = (lead, job) => {
    job.i = 0; job.dur = job.steps[0].dur;
    if (!lead.approach(job.steps[0].cells(), { type: 'job', job }, 'project')) return false;
    for (const m of job.crew) if (m !== lead) m.order('help', lead);
    return true;
  };
  g.jobDone = (lead, job) => job.steps[job.i].done(lead);
  return { g, s: g.systems, m: g.family[0], e: g.family[1], messages };
}
function arrive(m) {
  const last = m.path.at(-1);
  if (last) m.pos.set(last[0] + 0.5, 0, last[1] + 0.5);
  m.path = [];
  if (m.goal) m.startTask();
}
function finish(m, minutes = 100) { arrive(m); m.updateTask(minutes); }
function at(m, site) { m.pos.set(site.x + 1.5, 0, site.y + 0.5); }
function give(m, ...ids) { for (const id of ids) addEntry(m.inv, makeEntry(id)); }

test('decision defaults, 14 jugs, recycled stock, full/quarter car and flag aliases', () => {
  const { g, s } = fixture();
  assert.deepEqual(g.decisions, { gas: 'quarter', jugs: 'shelf', cart: 'water', walt: 'walked' });
  assert.equal(s.car.fuelL, 14);
  const shelf = g.map.objects.find((o) => o.home && o.ch === 'S' && o.x === 35), found = [];
  s.stock(shelf, found);
  const jugs = found.filter((e) => ['water_gallon', 'water_gallon_half'].includes(e.id));
  assert.equal(jugs.length, 14);
  assert.ok(Math.abs(jugs.reduce((sum, e) => sum + e.left, 0) - 45.6) < 1e-8);
  const second = []; s.stock(shelf, second); assert.equal(second.length, 0);
  assert.equal(flagsMatch(g, { gas: 'quarter', 'decisions.walt': 'walked' }), true);
  assert.equal(flagsMatch(g, { missing: false }), false);
  const other = fixture({ gas: 'full', jugs: 'recycled' });
  assert.equal(other.s.car.fuelL, 55);
  const stock = [makeEntry('water_gallon')];
  other.s.stock(other.g.map.objects.find((o) => o.home && o.ch === 'S' && o.x === 35), stock);
  assert.equal(stock.some((e) => ['water_gallon', 'water_gallon_half'].includes(e.id)), false);
});

test('every site is reachable, real shade task consumes once and changes the house model', () => {
  const { g, s, m } = fixture();
  for (const site of g.map.sites) { assert.ok(m.useObject(site, 'system', { action: 'noop' }), site.key); m.stopTask(); }
  const site = s.site('west-bedroom');
  assert.equal(g.shadeWindow(m, site.key), false);
  give(m, 'aluminum_foil');
  assert.ok(g.shadeWindow(m, site.key)); finish(m);
  assert.equal(g.sim.shadedWindows, 1);
  assert.equal(m.inv.some((e) => e.id === 'aluminum_foil'), false);
  assert.equal(g.shadeWindow(m, site.key), false);
  const plain = new Sim(), shaded = new Sim(), capped = new Sim();
  shaded.shadedWindows = 3; capped.shadedWindows = 4;
  let p0 = 0, p3 = 0;
  for (let i = 0; i < 1440; i++) {
    plain.step(1); shaded.step(1); capped.step(1);
    p0 = Math.max(p0, plain.indoor); p3 = Math.max(p3, shaded.indoor);
  }
  assert.ok(p0 - p3 > 3 && p0 - p3 < 6);
  assert.equal(capped.indoor, shaded.indoor);
  console.log(`24h peak indoors: ${p0.toFixed(2)}°F plain / ${p3.toFixed(2)}°F shaded`);
});

test('tarp waits for a second helper, consumes material, and reduces real sun load', () => {
  const { g, s, m, e } = fixture();
  give(m, 'tarp');
  assert.equal(g.rigTarp(m, [m]), false);
  assert.ok(g.rigTarp(m, [m, e])); arrive(m);
  m.updateTask(20); assert.equal(s.tarp, false);
  at(e, s.site('tarp')); m.updateTask(20); assert.equal(s.tarp, true);
  g.sim.min = 13 * 60;
  m.stopTask(); m.pos.set(28.5, 0, 3.5); m.updateBody(0);
  const shaded = m.felt;
  m.pos.set(26.5, 0, 3.5); m.updateBody(0);
  assert.ok(m.felt - shaded > 9);
});

test('two car seats, 2.5 L/hour, 78°F cooling, no cooling after exit or empty tank, CO refusal', () => {
  const { g, s, m, e } = fixture();
  assert.ok(g.runCarAC(m)); finish(m);
  assert.ok(g.runCarAC(e)); finish(e);
  const jess = g.family[2]; assert.ok(g.runCarAC(jess)); finish(jess);
  assert.equal(s.occupants().length, 2);
  assert.equal(jess.task, null);
  const before = s.car.fuelL; s.update(60);
  assert.equal(before - s.car.fuelL, 2.5);
  m.updateBody(0); assert.equal(m.felt, 78);
  m.moveTo(30, 17); assert.equal(s.carCooling(m), false);
  s.car.fuelL = 0.01; s.update(1);
  assert.equal(s.car.fuelL, 0); assert.equal(s.car.running, false); assert.equal(s.occupants().length, 0);
  m.stopTask(); s.car.fuelL = 14;
  // Put the car in garage geometry for the same action's CO gate.
  s.car.x = 35; s.car.y = 13; at(m, s.car);
  assert.equal(s.complete('enterCar', m), false);
});

test('night grill consumes finite fuel, preserves fresh meal age, refuses spoiled food and indoor charcoal', () => {
  const { g, s, m } = fixture(); g.sim.min = 21 * 60;
  give(m, 'frozen_meat_pack', 'charcoal_bag');
  assert.ok(g.cookGrill(m, 'charcoal')); finish(m, 20);
  const meal = m.inv.find((e) => e.id === 'cooked_meal');
  assert.ok(meal); assert.equal(isSpoiled(meal, g.sim), false);
  assert.equal(s.grill.charcoalMin, 100);
  g.sim.min += 241; assert.equal(isSpoiled(meal, g.sim), true);
  give(m, 'chicken_raw'); assert.equal(g.cookGrill(m, 'charcoal'), false);
  assert.equal(s.grill.charcoalMin, 100);
  const site = s.site('grill'); site.x = 29; site.y = 12; at(m, site);
  assert.equal(s.complete('cook', m, { fuel: 'charcoal' }), false);
});

test('lucid Walt unlocks battery/controller build, day power and fan/nebulizer/charging, never night', () => {
  const { g, s, m } = fixture();
  assert.ok(g.visitWalt(m, true)); finish(m);
  assert.equal(s.walt.instruction.right, true);
  assert.ok(m.inv.some((e) => e.id === 'charge_controller'));
  // Guaranteed RV battery exists even with unlucky random loot.
  const rv = g.map.objects.find((o) => o.ch === 'S' && o.x === 55 && o.y === 10), stock = [];
  s.stock(rv, stock); assert.ok(stock.some((e) => e.id === 'deep_cycle_battery'));
  give(m, 'deep_cycle_battery'); assert.ok(g.buildCircuit(m)); finish(m);
  assert.equal(s.solar.built, true); assert.equal(m.inv.some((e) => e.id === 'deep_cycle_battery'), false);
  g.sim.min = 11 * 60; assert.ok(s.watts() > 140);
  give(m, 'box_fan'); assert.ok(g.placeFan(m)); finish(m);
  m.pos.set(31.5, 0, 12.5); assert.equal(s.fanCooling(m), 4);
  give(m, 'nebulizer'); const theo = g.family[3]; theo.pos.set(30.5, 0, 12.5); theo.needs.health = 60;
  assert.ok(g.useNebulizer(m)); finish(m, 10); assert.equal(theo.needs.health, 68);
  assert.ok(g.useNebulizer(m)); finish(m, 10); assert.equal(theo.needs.health, 68);
  give(m, 'aa_rechargeable'); assert.ok(g.chargeSolar(m)); finish(m, 30);
  assert.equal(m.inv.find((e) => e.id === 'aa_rechargeable').chargeMin, 480);
  g.sim.min = 22 * 60; assert.equal(s.watts(), 0); assert.equal(s.fanCooling(m), 0);
  assert.ok(g.chargeSolar(m)); arrive(m); m.updateTask(30);
  assert.equal(m.task.t, 0); assert.equal(m.task.waitingPower, true);
  // Heat derates the same sunlight, independently of clock changes.
  const outdoor = g.sim.outdoor, sun = g.sim.sun;
  g.sim.sun = () => 1; g.sim.outdoor = () => 100; const cool = s.watts();
  g.sim.outdoor = () => 115; assert.ok(s.watts() < cool);
  g.sim.outdoor = outdoor; g.sim.sun = sun;
});

test('confused instructions cause shock or controller fire; water repairs early Walt trust', () => {
  for (const roll of [0.1, 0.9]) {
    const { g, s, m } = fixture();
    g.visitWalt(m, false); finish(m); assert.equal(s.walt.instruction.right, false);
    give(m, 'deep_cycle_battery'); g.rng.next = () => roll;
    g.buildCircuit(m); finish(m);
    assert.equal(s.solar.built, false); assert.equal(s.walt.instruction, null);
    if (roll < 0.5) assert.equal(m.needs.health, 78);
    else assert.equal(m.inv.some((e) => e.id === 'charge_controller'), false);
  }
  const { g, s, m } = fixture({ walt: 'wavedOff' });
  g.visitWalt(m, true); finish(m); assert.equal(s.walt.instruction, null);
  give(m, 'water_gallon'); g.giveWaltWater(m); finish(m);
  assert.equal(s.walt.trust, 2); assert.equal(m.inv.find((e) => e.id === 'water_gallon').left, 2.8);
  g.sim.min += 61; g.visitWalt(m, true); finish(m); assert.equal(s.walt.instruction.right, true);
});

test('radio is reusable, plays oldest due once; events enforce maxDay and decision flags', () => {
  const { g, s, m, messages } = fixture();
  give(m, 'radio_handcrank'); assert.ok(g.playRadio(m)); finish(m);
  assert.equal(s.heard.has('roads-jammed'), true);
  assert.ok(g.playRadio(m)); finish(m); assert.equal(s.heard.size, 1);
  assert.ok(m.inv.some((e) => e.id === 'radio_handcrank'));
  assert.equal(g.line('missing.silent'), false);
  assert.equal(g.line('marcus.solar.dead'), true);
  assert.ok(messages.some((s) => s.startsWith('Marcus: "')));
  const event = { id: 'test-gate', weight: 1, minDay: 1, maxDay: 2, needs: { flag: { gas: 'quarter' } }, text: 'A knock.', watched: { text: 'Seen.', effects: {} }, unwatched: { text: 'Missed.', effects: {} } };
  const events = new NightEvents(g, [event]); assert.equal(events.events.length, 1);
  assert.equal(events.eligible(event), true);
  g.decisions.gas = 'full'; assert.equal(events.eligible(event), false);
  g.decisions.gas = 'quarter'; g.sim.min = 2 * 1440; assert.equal(events.eligible(event), false);
});
