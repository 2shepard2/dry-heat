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
const { Prologue, mapBeatTargets, beatMinute } = await import('./beats.js');

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
  assert.ok(m.pos.x > s.car.x && m.pos.x < s.car.x + s.car.w);
  assert.ok(m.pos.z > s.car.y && m.pos.z < s.car.y + s.car.h);
  assert.ok(m.moveTo(30, 17)); assert.equal(s.carCooling(m), false);
  assert.ok(g.map.walkable(...m.cell()));
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
  assert.ok(g.playRadio(m)); finish(m);
  assert.equal(s.heard.size, 2);
  assert.equal(s.heard.has('eas-heat-advisory'), true);
  assert.ok(g.playRadio(m)); finish(m); assert.equal(s.heard.size, 2);
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


function prologue(beats) {
  const f = fixture();
  f.g.sim = new Sim({ phase: 'prologue' });
  f.g.selected = [f.m];
  const choices = [];
  f.b = new Prologue(f.g, { ...(beats ? { beats } : {}), present: (c) => choices.push(c) });
  f.choices = choices; f.b.start(); return f;
}
const flushLines = (b) => { for (let i = 0; i < 20; i++) b.update(0, 2); };

test('seed p1 completes through the real coffee use task; all targets are reachable', () => {
  const { g, b, m } = prologue();
  assert.equal(g.sim.day, -1); assert.equal(g.sim.clock(), '7:15 AM');
  assert.equal(g.sim.dateLabel(), 'Thursday, July 9');
  assert.equal(g.sim.speed, 4); assert.equal(g.sim.power, true);
  for (const [key, o] of Object.entries(b.targets)) {
    assert.ok(m.useObject(o, 'prologue', { target: key, beatType: 'use' }), key);
    m.stopTask(true);
  }
  assert.equal(b.notify('use', 'elena', 'coffee'), false);
  assert.ok(b.interact('coffee', [m])); finish(m); flushLines(b);
  assert.ok(b.completed.has('p1'));
});

test('choice sets a decision, costs time, preserves delayed follow-up lines and sets flags', () => {
  const beat = { id: 'choice', day: 0, at: 600, objectives: ['Buy groceries'], sets: ['shopped'],
    do: { type: 'choice', flag: 'cart', prompt: 'One thing goes back.', options: [
      { value: 'birthday', label: 'The birthday things', minutes: 8, lines: [{ who: 'elena', text: 'Okay.' }] },
      { value: 'water', label: 'The water' } ] } };
  const { g, b, choices, messages } = prologue([beat]);
  const start = g.sim.min;
  assert.equal(b.paused, true); assert.equal(choices.at(-1).flag, 'cart');
  assert.equal(g.pickChoice('invalid'), false);
  assert.ok(g.pickChoice('birthday')); assert.equal(g.sim.min, start + 8);
  assert.deepEqual(g.readDecisions(), { cart: 'birthday' });
  flushLines(b); assert.equal(g.flags.shopped, true);
  assert.ok(messages.includes('Elena: "Okay."'));
});

test('skip supplies defaults and lands at day 1, Saturday 5:40 AM with power out', () => {
  const { g, b } = prologue();
  g.decisions.gas = 'full';
  assert.ok(g.skipToOutage());
  assert.deepEqual(g.readDecisions(), { gas: 'quarter', jugs: 'shelf', cart: 'water', walt: 'walked' });
  assert.equal(g.sim.phase, 'outage'); assert.equal(g.sim.day, 1); assert.equal(g.sim.min, 340);
  assert.equal(g.sim.clock(), '5:40 AM'); assert.equal(g.sim.power, false);
  assert.match(g.sim.dateLabel(), /Saturday, July 11/);
  assert.equal(g.systems.car.fuelL, 14); assert.equal(g.systems.car.running, false);
  const stock = [makeEntry('water_case')];
  g.systems.stock(b.targets.pantry, stock); assert.equal(stock.some((e) => e.id === 'water_case'), false);
  assert.equal(g.skipToOutage(), false);
});

test('all three cart outcomes and jugs/gas/Walt are applied at the cut', () => {
  for (const cart of ['water', 'pharmacy', 'birthday']) {
    const { g, b } = prologue();
    Object.assign(g.decisions, { cart, gas: 'full', jugs: 'recycled', walt: 'wavedOff' });
    b.targets['garage-shelf'].items.push(makeEntry('water_gallon'));
    const oldMorale = g.family.find((m) => m.id === 'jess').needs.morale;
    b.outage();
    const all = g.map.objects.filter((o) => o.home).flatMap((o) => o.items);
    for (const [choice, id] of [['water', 'water_case'], ['pharmacy', 'inhaler_spare'], ['pharmacy', 'bp_refill'], ['birthday', 'birthday_jess']]) {
      assert.equal(all.some((e) => e.id === id), choice !== cart, `${cart}: ${id}`);
    }
    assert.equal(all.some((e) => e.id === 'water_gallon'), false);
    assert.equal(g.systems.car.fuelL, 55); assert.equal(g.systems.walt.trust, 0);
    assert.equal(g.family.find((m) => m.id === 'jess').needs.morale, oldMorale - (cart === 'birthday' ? 12 : 0));
  }
});

test('trip hides the car and its crew for the specified minutes, then restores both', () => {
  const { g, b } = prologue([{ id: 'trip', day: -1, at: 500, do: { type: 'trip', who: ['marcus', 'elena'], target: 'store', minutes: 30, label: 'Grocery run' } }]);
  b.targets.car.mesh = { visible: true };
  assert.ok(b.interact('car')); assert.equal(b.targets.car.mesh.visible, false);
  assert.equal(g.map.walkable(b.targets.car.x, b.targets.car.y), true);
  assert.ok(g.family.slice(0, 2).every((m) => m.away && !m.obj.visible));
  g.sim.step(29); b.update(29, 0); assert.ok(b.trip);
  g.sim.step(1); b.update(1, 2);
  assert.equal(b.trip, null); assert.equal(b.targets.car.mesh.visible, true);
  assert.equal(g.map.walkable(b.targets.car.x, b.targets.car.y), false);
  assert.ok(g.family.every((m) => !m.away && m.obj.visible)); assert.ok(b.completed.has('trip'));
});

test('together requires both parents; child order completes only with the named child', () => {
  const { g, b, m, e } = prologue([
    { id: 'team', day: -1, at: 435, do: { type: 'together', target: 'store' } },
    { id: 'kid', day: -1, at: 440, do: { type: 'order', kid: 'jess', target: 'sink' } },
  ]);
  assert.equal(b.interact('store', [m]), false);
  assert.ok(b.interact('store', [m, e])); arrive(m); arrive(e); finish(m); assert.equal(b.pending, false); finish(e); flushLines(b);
  assert.ok(b.completed.has('team'));
  assert.equal(b.notify('order', 'theo', 'sink'), false);
  assert.ok(b.interact('sink', [m])); finish(g.family.find((m) => m.id === 'jess')); flushLines(b);
  assert.ok(b.completed.has('kid'));
});

test('sleep rolls to Friday, optional beat times out, wait P15 cuts to outage', () => {
  const { g, b } = prologue([
    { id: 'bed', day: -1, at: 1380, do: { type: 'sleep' } },
    { id: 'sky', day: 0, at: 1320, optional: true, timeout: 3, sets: ['sawSky'], do: { type: 'walk', target: 'street' } },
    { id: 'end', day: 0, at: 1380, outage: true, do: { type: 'wait', minutes: 2 } },
  ]);
  assert.ok(b.sleep()); b.update(0, 2);
  assert.equal(g.sim.day, 0); assert.equal(g.sim.dateLabel(), 'Friday, July 10');
  b.update(3, 2); assert.equal(g.flags.sawSky, true);
  b.update(2, 2); assert.equal(g.sim.phase, 'outage'); assert.equal(g.sim.min, 340);
});

test('prologue stays safe through a long wait; windows finish indoors, status never empty', () => {
  const { g, b, m } = prologue();
  g.sim.step(1440); m.updateBody(1440);
  assert.equal(g.sim.day, -1); assert.equal(g.sim.indoor, 78); assert.equal(g.sim.pressure(), 1);
  assert.equal(m.needs.health, 100); assert.equal(m.bodyT, 98.6); assert.ok(m.needs.energy >= 60);
  assert.equal(m.dead, false); assert.equal(m.collapsed, false);
  b.outage(); give(m, 'aluminum_foil');
  assert.ok(g.shadeWindow(m, 'west-bedroom')); finish(m);
  assert.equal(g.map.isIndoor(...m.cell()), true); assert.equal(g.sim.shadedWindows, 1);
  assert.equal(m.doing(), 'Idle');
});


test('optional choice expires and named child use is supported', () => {
  const { g, b } = prologue([
    { id: 'optional', day: -1, at: 435, optional: true, timeout: 5, do: { type: 'choice', flag: 'walt', options: [{ value: 'walked', label: 'Walk him home' }] } },
    { id: 'child-use', day: -1, at: 440, do: { type: 'use', who: 'theo', target: 'sprinkler' } },
  ]);
  assert.equal(b.paused, false); b.update(5, 2); assert.ok(b.completed.has('optional'));
  assert.ok(b.interact('sprinkler')); finish(g.family.find((m) => m.id === 'theo')); flushLines(b);
  assert.ok(b.completed.has('child-use'));
});
