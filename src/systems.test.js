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


function prologue(beats, chores = []) {
  const f = fixture();
  f.g.sim = new Sim({ phase: 'prologue' });
  f.g.selected = [f.m];
  const choices = [];
  f.b = new Prologue(f.g, { chores, ...(beats ? { beats } : {}), present: (c) => choices.push(c) });
  if (beats?.length) f.g.sim.min = beatMinute(beats[0]);
  f.choices = choices; f.b.start(); return f;
}
const flushLines = (b) => { for (let i = 0; i < 20; i++) b.update(0, 2); };

test('seed p1 completes through the real coffee use task; all targets are reachable', () => {
  const { g, b, m } = prologue();
  assert.equal(g.sim.day, -1); assert.equal(g.sim.clock(), '7:15 AM');
  assert.equal(g.sim.dateLabel(), 'Thursday, July 9');
  assert.equal(g.sim.speed, 1); assert.equal(g.sim.power, true);
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
  assert.ok(b.interact('car'));
  for (const member of g.family.slice(0, 2)) finish(member);
  b.update(0, 0);
  assert.equal(b.targets.car.mesh.visible, false);
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
  g.sim.step(5); b.update(5, 0);
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
  g.sim.step(60); b.update(0, 0); b.update(2, 2); assert.equal(g.sim.phase, 'outage'); assert.equal(g.sim.min, 340);
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
  assert.equal(m.doing(), 'Waiting (free in 45 min)');
});


test('optional choice expires and named child use is supported', () => {
  const { g, b } = prologue([
    { id: 'optional', day: -1, at: 435, optional: true, timeout: 5, do: { type: 'choice', flag: 'walt', options: [{ value: 'walked', label: 'Walk him home' }] } },
    { id: 'child-use', day: -1, at: 440, do: { type: 'use', who: 'theo', target: 'sprinkler' } },
  ]);
  assert.equal(b.paused, false); g.sim.step(5); b.update(5, 2); assert.ok(b.completed.has('optional'));
  assert.ok(b.interact('sprinkler')); finish(g.family.find((m) => m.id === 'theo')); flushLines(b);
  assert.ok(b.completed.has('child-use'));
});


// Use the same entry points as object/kid menu callbacks, choice buttons and Z.
// Never teleport arrivals, assign a task directly, call notify, or use jumpBeat.
test('fresh no-jump playthrough: all 18 beats, real paths/trips, clock, decisions and no stalls', async () => {
  const { BEATS } = await import('./data/beats.js');
  for (const picks of [
    { walt: 'walked', jugs: 'shelf', cart: 'pharmacy', gas: 'full' },
    { walt: 'wavedOff', jugs: 'recycled', cart: 'birthday', gas: 'quarter' },
  ]) {
    const { g, b, messages, m, e } = prologue();
    g.jumpBeat = () => assert.fail('playthrough must never jumpBeat');
    b.targets.car.mesh = { visible: true };
    let seconds = 0;
    const issued = new Set(), seenAway = new Set(), independentStalls = new Map();
    const completedObjectives = new Set();
    let campSeen = false, pickupSeen = false, fridayCampSeen = false;
    while (g.sim.phase === 'prologue' && seconds < 4000) {
      const beat = b.current, d = beat?.do;
      if (beat && !b.waiting && !issued.has(beat.id)) {
        if (d.type === 'choice') {
          if (b.choiceReady) { assert.ok(g.pickChoice(picks[d.flag])); issued.add(beat.id); }
        } else if (d.type === 'sleep') { assert.ok(b.sleep()); issued.add(beat.id); }
        else if (['use', 'walk', 'order', 'together', 'trip'].includes(d.type)) {
          g.selected = d.type === 'together' ? [m, e] : [g.family.find((x) => x.id === d.who && !x.ai) || m];
          assert.ok(b.interact(d.target, g.selected), beat.id);
          issued.add(beat.id);
        } else issued.add(beat.id);
      }
      const dtReal = .1, dtMin = b.paused ? 0 : dtReal * g.sim.speed;
      g.sim.step(dtMin);
      for (const member of g.family) member.update(dtMin, dtReal);
      b.update(dtMin, dtReal);
      seconds += dtReal;
      if (b.trip) {
        seenAway.add(b.trip.background ? 'p2' : b.current.id);
        assert.equal(b.targets.car.mesh.visible, false);
        for (const member of b.trip.crew) { assert.equal(member.away, true); assert.equal(member.obj.visible, false); }
      }
      const theo = g.family.find((x) => x.id === 'theo');
      if (g.sim.day === -1 && g.sim.hour > 8.5 && g.sim.hour < 14.6) {
        assert.equal(theo.away, true); assert.equal(theo.obj.visible, false); campSeen = true;
      }
      if (g.sim.day === -1 && g.sim.hour > 14.7 && g.sim.hour < 15) {
        assert.equal(e.away, true); assert.equal(b.targets.car.mesh.visible, false); pickupSeen = true;
      }
      if (g.sim.day === 0 && g.sim.hour > 9.3 && g.sim.hour < 11.6) { assert.equal(theo.away, true); fridayCampSeen = true; }
      for (const objective of g.objectives) if (objective.done) completedObjectives.add(objective.text);
      for (const member of g.family) {
        assert.equal(member.dead, false); assert.equal(member.collapsed, false);
        const work = member.task || member.goal;
        const before = independentStalls.get(member.id);
        const progress = [member.pos.x, member.pos.z, member.task?.t || 0];
        const changed = !before || work !== before.work || progress.some((v, i) => Math.abs(v - before.progress[i]) > .001);
        const stalled = !work || member.away || member.asleep || changed ? 0 : before.stalled + dtMin;
        assert.ok(stalled <= 30, `${beat.id}: ${member.name} stuck for ${stalled}`);
        independentStalls.set(member.id, { work, progress, stalled });
      }
    }
    assert.equal(g.sim.phase, 'outage', `timed out at ${b.current?.id}: ${g.sim.clock()}`);
    assert.ok(BEATS.every((beat) => b.completed.has(beat.id)));
    assert.equal(BEATS.length, 18);
    assert.equal(g.sim.day, 1); assert.equal(g.sim.min, 340);
    assert.deepEqual(g.decisions, picks);
    assert.equal(g.systems.car.fuelL, picks.gas === 'full' ? 55 : 14);
    assert.equal(g.systems.walt.trust, picks.walt === 'walked' ? 2 : 0);
    const home = g.map.objects.filter((o) => o.home).flatMap((o) => o.items);
    assert.equal(home.some((i) => i.id === 'inhaler_spare'), picks.cart !== 'pharmacy');
    const shelfStock = [];
    g.systems.stock(g.map.objects.find((o) => o.home && o.ch === 'S' && o.x === 35), shelfStock);
    assert.equal(shelfStock.some((i) => i.id === 'water_gallon'), picks.jugs === 'shelf');
    assert.deepEqual([...seenAway], ['p2', 'p9', 'p10', 'p13a']);
    assert.ok(campSeen && pickupSeen && fridayCampSeen);
    assert.ok(b.completed.has('camp-pickup') && b.completed.has('friday-camp-pickup'));
    assert.ok(messages.some((line) => line.includes('brings Theo home from camp')));
    assert.ok(completedObjectives.has('Finish the Hendricks deck'));
    assert.ok(g.family.every((member) => !member.away && member.obj.visible));
    console.log(`No-jump playthrough at default 1x, ${picks.gas}: ${(seconds / 60).toFixed(2)} real minutes (immediate inputs; choice reading time extra)`);
  }
});

test('choices wait for speech in real seconds, stay unpicked, and reject early input', () => {
  const { g, b, choices } = prologue([{ id: 'speech', day: -1, at: 435,
    lines: [{ who: 'marcus', text: 'First.' }, { who: 'elena', text: 'Second.' }],
    do: { type: 'choice', flag: 'gas', options: [{ value: 'full', label: 'Fill up' }, { value: 'quarter', label: 'Later' }] } }]);
  assert.equal(choices.at(-1), null); assert.equal(g.pickChoice('full'), false);
  b.update(100, 0); assert.equal(b.lines.length, 1);
  b.update(100, 1.5); assert.equal(b.lines.length, 1); assert.equal(b.choiceReady, false);  // pace 1.9 s
  b.update(0, .5); assert.equal(b.lines.length, 0); assert.equal(b.choiceReady, false);
  b.update(0, 2); assert.equal(b.choiceReady, true); assert.equal(b.paused, true);
  assert.deepEqual(g.decisions, {}); assert.equal(choices.at(-1).flag, 'gas');
});

test('normal child orders and silent stalled-goal/task recovery work during the prologue', () => {
  const { g, b, m, messages } = prologue();
  const kid = g.family.find((x) => x.id === 'theo');
  kid.order('stay', m); assert.equal(kid.mode.type, 'stay');
  kid.order('follow', m);
  const start = kid.pos.clone();
  kid.update(.4, .1); assert.ok(kid.pos.distanceTo(start) > 0 || kid.path.length > 0);
  kid.order('stay', m); assert.equal(kid.task, null); assert.equal(kid.goal, null);
  const before = messages.length;
  for (const member of [kid, m]) {
    member.goal = { type: 'prologue', target: 'car' }; member.path = [];
    member.guardProgress(0);
    for (let i = 0; i < 31; i++) member.guardProgress(1);
    assert.equal(member.goal, null); assert.equal(member.task, null);
    member.task = { type: 'job', t: 0, waiting: true };
    member.guardProgress(0); member.guardProgress(30);
    assert.equal(member.task, null);
  }
  assert.equal(messages.length, before);
  assert.match(b.guidance().text, /Marcus.*coffee.*kitchen/);
  assert.equal(b.guidance().target, b.targets.coffee);
});


test('guidance follows kid orders; aurora bands project into the sky above the houses', async () => {
  const { prologueScene } = await import('./prologue-scene.js');
  const { g, b } = prologue();
  const cam = { target: new THREE.Vector3(29, 0, 11), yaw: Math.PI / 4, zoom: 2.1 };
  const visual = prologueScene(g, g.scene, cam);
  visual.set(true, { id: 'p14a' }); visual.update(1);
  const sky = g.scene.children.find((o) => o.material?.isShaderMaterial);
  const camera = new THREE.OrthographicCamera(-27, 27, 15, -15, .1, 400);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * 80, 76, cam.target.z + Math.cos(cam.yaw) * 80);
  camera.lookAt(cam.target); camera.updateMatrixWorld(); sky.updateMatrixWorld();
  for (const band of [.43, .63]) {
    const v = new THREE.Vector3(0, (band - .5) * 10, 0).applyMatrix4(sky.matrixWorld).project(camera);
    assert.ok(v.y > .6 && v.y < 1, `aurora band must be in upper sky, got ${v.y}`);
  }
  assert.equal(sky.rotation.x, 0);
  visual.set(false); assert.equal(cam.zoom, 2.1);
  b.current = { id: 'kid-marker', day: -1, at: 435, do: { type: 'order', kid: 'theo', target: 'car' } };
  visual.update(2);
  assert.equal(b.guidance().target.id, 'theo');
  const beacon = g.scene.children.find((o) => o.isGroup && o.children.some((c) => c.geometry?.type === 'RingGeometry'));
  assert.equal(beacon.visible, true);
  assert.equal(beacon.position.x, g.family[3].pos.x);
  assert.equal(beacon.position.z, g.family[3].pos.z);
  assert.ok(beacon.children.every((c) => c.material.depthTest === false));
});

test('new games start at 1x in either phase', () => {
  assert.equal(new Sim().speed, 1);
  assert.equal(new Sim({ phase: 'prologue' }).speed, 1);
});

test('personal routines rotate in 30–60 minutes and reserve objects and idle cells', () => {
  const { g, m, e } = prologue([{ id: 'quiet', day: -1, at: 435, do: { type: 'wait', minutes: 600 } }]);
  const visited = new Map(g.family.map((m) => [m.id, new Set()]));
  for (let i = 0; i < 600; i++) {
    g.sim.step(.5);
    for (const member of g.family) member.update(.5, .5);
    const idle = g.family.filter((m) => !m.path.length);
    assert.equal(new Set(idle.map((m) => m.cell().join())).size, idle.length);
    const objects = g.family.map((m) => (m.task || m.goal)?.obj).filter(Boolean);
    assert.equal(new Set(objects).size, objects.length);
    for (const member of g.family) {
      const work = member.task || member.goal;
      if (work?.type === 'routine' && !work.care) {
        assert.ok(work.duration >= 30 && work.duration <= 60);
        if (work.obj) visited.get(member.id).add(work.obj);
      }
    }
  }
  assert.ok(visited.get('elena').size >= 2);
  assert.ok(visited.get('jess').size >= 1);
  assert.notEqual((m.task || m.goal)?.obj, (e.task || e.goal)?.obj);
  assert.ok([...visited.get('jess')].every((o) => o.ch === 'L' || o.x === 23 && o.y === 13));
});

test('Theo plays beside Elena only in common rooms and never reserves her cell', () => {
  const { g, e } = prologue();
  const theo = g.family.find((m) => m.id === 'theo');
  e.stopTask(); e.pos.set(30.5, 0, 10.5);
  theo.liveOwnLife(1); arrive(theo);
  assert.match(theo.task.label, /near Elena/);
  assert.notDeepEqual(theo.cell(), e.cell());
  assert.equal(Math.abs(theo.cell()[0] - e.cell()[0]) + Math.abs(theo.cell()[1] - e.cell()[1]), 1);
  theo.stopTask(); e.pos.set(24.5, 0, 7.5);
  theo.liveOwnLife(60);
  assert.doesNotMatch((theo.task || theo.goal).label, /near Elena/);
  // Explicit following also steps away if the two people start on one cell.
  theo.stopTask(); theo.pos.copy(e.pos); theo.order('follow', e); theo.think(1);
  assert.notDeepEqual(theo.path.at(-1), e.cell());
});

test('Marcus visits the patio at dusk and can return indoors', () => {
  const { g, m } = prologue();
  g.sim.min = -2880 + 18 * 60;
  m.routineTurn = 1;
  m.liveOwnLife(1); arrive(m);
  assert.match(m.task.label, /patio/);
  finish(m); m.liveOwnLife(60); arrive(m);
  assert.match(m.task.label, /couch/);
  assert.equal(g.map.isIndoor(...m.cell()), true);
});

test('a completed player order stays in place for 45 minutes, then autonomy resumes', () => {
  const { g, m } = prologue();
  m.liveOwnLife(1);
  assert.equal((m.task || m.goal).autonomous, true);
  assert.ok(m.useObject(g.map.objects.find((o) => o.home && o.ch === 'Z'), 'drinkTap'));
  assert.equal((m.task || m.goal).autonomous, undefined);
  finish(m);
  const cell = m.cell(), doneAt = g.sim.min;
  for (let minute = 1; minute < 45; minute++) {
    g.sim.min = doneAt + minute; m.update(1, 1);
    assert.equal(m.task, null); assert.equal(m.goal, null);
    assert.deepEqual(m.cell(), cell);
    assert.equal(m.doing(), `Waiting (free in ${45 - minute} min)`);
  }
  g.sim.min = doneAt + 45; m.liveOwnLife(1);
  assert.equal((m.task || m.goal).autonomous, true);
});

test('each urgent need bypasses order grace', () => {
  for (const [need, value] of [['hydration', 59], ['food', 24], ['energy', 14]]) {
    const { g, m } = fixture();
    m.useObject(g.map.objects.find((o) => o.home && o.ch === 'Z'), 'drinkTap'); finish(m);
    m.needs[need] = value;
    if (need === 'hydration') m.deficit = 3;
    if (need === 'food') give(m, 'pull_tab_can');
    m.liveOwnLife(1);
    assert.equal(m.waitingForAutonomy, false);
    assert.equal((m.task || m.goal)?.autonomous, true, need);
    assert.equal((m.task || m.goal).care, { hydration: 'tap', food: 'eat', energy: 'rest' }[need]);
  }
});

test('an idle thirsty adult drinks without player input', () => {
  const { g, m } = fixture();
  m.deficit = 2; m.syncHydration();
  const before = m.needs.hydration;
  m.liveOwnLife(1);
  assert.ok(['tap', 'drink'].includes((m.task || m.goal).care));
  finish(m);
  assert.ok(m.needs.hydration > before);
  assert.equal(m.autoDrinkAt, g.sim.min);
});

test('autonomy neither chooses nor completes use/walk beats, even after a routine ends', () => {
  for (const type of ['use', 'walk', 'choice']) {
    const { g, b, m } = prologue([{ id: 'manual', day: -1, at: 435,
      do: type === 'choice' ? { type, flag: 'gas', options: [{ value: 'full', label: 'Fill up' }] } : { type, target: 'couch' } }]);
    m.liveOwnLife(1); arrive(m); finish(m);
    b.update(1, 3);
    assert.equal(b.completed.size, 0, type);
    assert.equal(b.pending, false, type);
    assert.deepEqual(g.decisions, {});
    assert.equal(g.flags.gas, undefined);
  }
});

test('Skip ahead restores the prior speed when the seated desk beat reaches noon', () => {
  for (const speed of [0, 1, 4]) {
    const { g, b, m } = prologue([
      { id: 'desk', day: -1, at: 435, do: { type: 'use', target: 'desk' } },
      { id: 'next', day: -1, at: 720, lines: [{ who: 'elena', text: 'Lunch?' }], do: { type: 'use', target: 'pantry' } },
    ]);
    assert.equal(b.skipAhead(), false);
    b.interact('desk', [m]); arrive(m); g.sim.speed = speed;
    assert.equal(b.guidance().canSkip, true);
    assert.equal(b.skipAhead(), true); assert.equal(g.sim.speed, 12);
    for (let i = 0; i < 3000 && !b.completed.has('desk'); i++) {
      const dt = g.sim.speed * .1;
      g.sim.step(dt); m.updateTask(dt); b.update(dt, .1);
    }
    assert.ok(b.completed.has('desk'));
    assert.equal(g.sim.speed, speed); assert.equal(b.hurry, null);
  }
});

test('Skip ahead ends at free-time boundary, new dialogue, choice, or player work', () => {
  const { g, b, m } = prologue([
    { id: 'coffee', day: -1, at: 435, do: { type: 'use', target: 'coffee' } },
    { id: 'later', day: -1, at: 500, lines: [{ who: 'elena', text: 'Ready?' }],
      do: { type: 'choice', flag: 'gas', options: [{ value: 'full', label: 'Fill up' }] } },
  ]);
  b.interact('coffee'); finish(m); flushLines(b);
  assert.match(b.guidance().text, /Free time until/);
  assert.equal(b.skipAhead(), true);
  m.useObject(b.targets.sink, 'drinkTap'); b.updateSkipping();
  assert.equal(g.sim.speed, 1); assert.equal(b.hurry, null);
  finish(m);
  assert.equal(b.skipAhead(), true);
  g.sim.min = beatMinute(b.current); b.update(1, .1);
  assert.equal(g.sim.speed, 1); assert.equal(b.skipAhead(), false);
  flushLines(b); assert.equal(b.choiceReady, true); assert.equal(b.skipAhead(), false);
  assert.deepEqual(g.decisions, {});
});


test('manual arrivals reserve separate standing cells and walking receives order grace', () => {
  const { g, m, e } = prologue();
  const table = g.beats.targets['dinner-table'];
  assert.ok(m.useObject(table, 'leisure'));
  assert.ok(e.useObject(table, 'leisure'));
  finish(m); finish(e);
  assert.notDeepEqual(m.cell(), e.cell());
  assert.equal(m.waitingForAutonomy, true);
  assert.equal(e.waitingForAutonomy, true);
  assert.ok(m.moveTo(29, 12));
  for (let i = 0; i < 200 && m.path.length; i++) { g.sim.step(.1); m.update(.1, .1); }
  assert.equal(m.path.length, 0);
  assert.equal(m.freeAt, g.sim.min + 45);
  assert.match(m.doing(), /Waiting/);
});


// Chore engine fixtures deliberately do not depend on MiniMax's content data.
const choreFixture = (extra = {}) => ({ id: 'c-test', day: -1, from: 435, to: 500,
  who: 'elena', label: 'Put the lunch away', do: { type: 'use', target: 'fridge' }, minutes: 8, ...extra });
const quietBeat = { id: 'quiet', day: -1, at: 435, do: { type: 'use', target: 'sink' } };

test('chores open and expire silently, sort by deadline, and appear as dim optional objectives', () => {
  const chores = [choreFixture({ id: 'late', to: 550 }), choreFixture({ id: 'first' }),
    choreFixture({ id: 'second', to: 510 }), choreFixture({ id: 'future', from: 560, to: 600 })];
  const { g, b, m, messages } = prologue([quietBeat], chores);
  assert.deepEqual(b.offeredChores().map((c) => c.id), ['first', 'second', 'late']);
  assert.deepEqual(b.guidance().chores.map((c) => c.id), ['first', 'second']);
  assert.ok(g.objectives.every((o) => o.optional && !o.current));
  assert.ok(b.interactChore('first', [m])); arrive(m);
  g.sim.min = -2880 + 550; b.update(0, 0);
  assert.equal(m.task, null); assert.deepEqual(b.offeredChores(), []);
  assert.deepEqual(g.objectives, []); assert.deepEqual(messages, []);
  assert.equal(b.notify('chore:first', m.id, 'chore:first'), false);
  g.sim.min = -2880 + 560; b.update(0, 0);
  assert.deepEqual(b.offeredChores().map((c) => c.id), ['future']);
});

test('chore completion waits for work, speaks, logs, reveals once and never completes a use beat', () => {
  const c = choreFixture({ lines: [{ who: 'elena', text: 'There it is.' }], log: 'The drawer closes.',
    reveal: { item: 'flashlight', into: 'inhaler' } });
  const { g, b, e, messages } = prologue([{ ...quietBeat, do: c.do }], [c]);
  const bubbled = []; g.bubbles = { say: (...args) => bubbled.push(args) };
  assert.ok(b.interactChore(c.id, [e])); arrive(e); e.updateTask(7);
  assert.equal(b.doneChores.has(c.id), false);
  e.updateTask(1); b.update(0, 0);
  assert.ok(b.doneChores.has(c.id)); assert.equal(b.current.id, 'quiet'); assert.equal(b.pending, false);
  assert.equal(b.completed.size, 0); assert.deepEqual(b.offeredChores(), []);
  assert.ok(g.objectives.some((o) => o.optional && o.done));
  assert.deepEqual(messages, ['The drawer closes.', 'Elena: "There it is."']);
  assert.deepEqual(bubbled, [['elena', 'There it is.']]);
  assert.equal(b.targets.inhaler.items.filter((e) => e.id === 'flashlight').length, 1);
  assert.equal(b.notify('chore:c-test', 'elena', 'chore:c-test'), false);
  assert.equal(b.interactChore(c.id, [e]), false);
});

test('a chore walk cannot complete the story walk at the same target; manual approach still can', () => {
  const c = choreFixture({ do: { type: 'walk', target: 'front-door' } });
  const { b, m } = prologue([{ ...quietBeat, do: { type: 'walk', who: 'marcus', target: 'front-door' } }], [c]);
  assert.ok(b.interactChore(c.id, [m])); finish(m); b.update(0, 0);
  assert.ok(b.doneChores.has(c.id)); assert.equal(b.completed.size, 0); assert.equal(b.pending, false);
  assert.ok(b.interact('front-door', [m])); finish(m); b.update(0, 0);
  assert.ok(b.completed.has('quiet'));
});

test('only parents initiate chores; kids work by order and a beat can interrupt them', () => {
  const c = choreFixture({ who: 'jess', do: { type: 'order', kid: 'jess', target: 'sink' } });
  const { g, b, m } = prologue([{ ...quietBeat, do: c.do }], [c]);
  const jess = g.family.find((m) => m.id === 'jess');
  assert.equal(b.interactChore(c.id, [jess]), false);
  assert.ok(b.interactChore(c.id, [m])); arrive(jess);
  assert.equal(jess.task.beatType, 'chore:c-test');
  assert.ok(b.interact('sink', [m]));
  assert.equal((jess.task || jess.goal).beatType, 'order');
  assert.equal(b.doneChores.size, 0); assert.equal(b.offeredChores().length, 1);
  finish(jess); b.update(0, 0); assert.ok(b.completed.has('quiet'));
});

test('chore speech does not delay choices or finishing story beats', () => {
  const c = choreFixture({ lines: Array.from({ length: 20 }, () => ({ who: 'elena', text: 'Okay.' })) });
  const { b, m } = prologue([quietBeat,
    { id: 'choose', day: -1, at: 435, do: { type: 'choice', flag: 'gas', options: [{ value: 'full' }] } }], [c]);
  b.interactChore(c.id, [m]); finish(m);
  b.interact('sink', [m]); finish(m); b.update(0, 0);
  assert.equal(b.current.id, 'choose'); assert.ok(b.choiceReady);
  assert.ok(b.choreLines.length > 0); assert.ok(b.pick('full')); b.update(0, 0);
  assert.ok(b.completed.has('choose'));
});

test('Marcus returns to the desk after a chore and P3 finishes at noon even while he is away from it', () => {
  const { g, b, m } = prologue([{ id: 'desk', day: -1, at: 510,
    do: { type: 'use', who: 'marcus', target: 'desk' } }],
    [choreFixture({ from: 510, to: 800, minutes: 5 })]);
  assert.ok(b.interact('desk', [m])); finish(m, 2); b.update(0, 0);
  assert.ok(b.deskStarted); assert.equal(b.completed.size, 0);
  assert.ok(b.interactChore('c-test', [m])); finish(m, 5);
  m.liveOwnLife(1);
  assert.ok((m.task || m.goal)?.deskRoutine); arrive(m);
  assert.equal(m.task.type, 'routine'); assert.equal(m.task.obj, b.targets.desk);
  assert.ok(m.task.autonomous); assert.equal(b.completed.size, 0);
  m.useObject(b.targets.coffee, 'leisure');
  g.sim.min = -2880 + 720; b.update(0, 0);
  assert.ok(b.completed.has('desk'));
  // The same one-time seating enables Friday's afternoon work routine.
  m.stopTask(true); g.sim.min = -1440 + 780; m.liveOwnLife(1);
  assert.ok((m.task || m.goal)?.deskRoutine);
  g.sim.min = -1440 + 1020; m.liveOwnLife(1);
  assert.ok(!(m.task || m.goal)?.deskRoutine);
});

test('P2 sends Elena and Theo away while Marcus can start P3 before nine', () => {
  const { g, b, m, e } = prologue();
  b.jump('p2'); b.interact('car', [m]); finish(g.family.find((m) => m.id === 'theo'));
  b.update(0, 0); finish(e); finish(g.family.find((m) => m.id === 'theo')); flushLines(b);
  assert.equal(b.current.id, 'p3'); assert.ok(b.trip.background);
  assert.ok(e.away); assert.ok(!m.away);
  assert.deepEqual(b.trip.crew.map((m) => m.id), ['elena', 'theo']);
  g.sim.min = -2880 + 510; b.update(0, 0);
  assert.ok(b.interact('desk', [m])); finish(m, 2); b.update(0, 0);
  assert.ok(b.deskStarted); assert.equal(b.pending, false);
  g.sim.min = -2880 + 630; b.update(0, 0);
  assert.equal(e.away, false); assert.ok(g.family.find((m) => m.id === 'theo').away);
  assert.equal(b.current.id, 'p3'); assert.equal(b.pending, false);
  g.sim.min = -2880 + 880; b.update(0, 0); assert.ok(e.away); assert.ok(!m.away);
  g.sim.min = -2880 + 900; b.update(0, 0); assert.equal(e.away, false);
  assert.ok(b.completed.has('camp-pickup'));
});

test('Skip ahead stays available with offered chores but stops exactly at the next opening', () => {
  for (const speed of [0, 1, 4]) {
    const { g, b } = prologue([{ ...quietBeat, do: { type: 'wait', minutes: 100 } }], [
      choreFixture({ id: 'open' }), choreFixture({ id: 'new', from: 440, to: 441 }),
    ]);
    g.sim.speed = speed; assert.ok(b.skipAhead());
    const dt = b.limitStep(120); assert.equal(dt, 5);
    g.sim.step(dt); b.update(dt, .1);
    assert.equal(g.sim.min, -2880 + 440); assert.equal(g.sim.speed, speed); assert.equal(b.hurry, null);
    assert.deepEqual(b.offeredChores().map((c) => c.id), ['new', 'open']);
    assert.ok(b.guidance().canSkip);
  }
});


test('chore work cannot stand in for the second parent on a together beat', () => {
  const { b, m, e } = prologue([{ ...quietBeat, do: { type: 'together', target: 'dinner-table' } }],
    [choreFixture({ do: { type: 'use', target: 'dinner-table' } })]);
  assert.ok(b.interact('dinner-table', [m, e])); arrive(m); arrive(e);
  assert.ok(b.interactChore('c-test', [e])); arrive(e);
  m.updateTask(20);
  assert.equal(m.task.t, 0); assert.equal(b.pending, false);
  finish(e); b.update(0, 0);
  assert.equal(b.completed.size, 0);
  assert.ok(b.interact('dinner-table', [m, e])); arrive(m); arrive(e); finish(m); finish(e); b.update(0, 0);
  assert.ok(b.completed.has('quiet'));
});

// ---- wave 4c: speech bubbles -------------------------------------------------
// A tiny DOM stand-in: bubbles.js only needs to create nodes, set text and style.
function fakeDom() {
  const node = () => ({
    className: '', textContent: '', style: {}, children: [], parent: null,
    offsetWidth: 120, offsetHeight: 40,
    appendChild(c) { this.children.push(c); c.parent = this; },
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); },
  });
  const host = node();
  globalThis.document = {
    getElementById: (id) => (id === 'bubbles' ? host : null),
    createElement: () => node(),
    body: node(),
  };
  globalThis.innerWidth = 800; globalThis.innerHeight = 600;
  return host;
}

test('bubble lifetime and pacing follow the wave 4c numbers', async () => {
  const { bubbleLifetime, paceDelay } = await import('./bubbles.js');
  assert.equal(bubbleLifetime(''), 2.5);              // clamped up to the floor
  assert.equal(bubbleLifetime('short line'), 2.5);    // 1.8 + 0.06*10 = 2.4 -> 2.5
  assert.equal(bubbleLifetime('x'.repeat(20)), 3.0);  // 1.8 + 1.2 = 3.0
  assert.equal(bubbleLifetime('x'.repeat(87)), 7);    // clamped down to the ceiling
  assert.equal(bubbleLifetime('x'.repeat(200)), 7);
  assert.equal(paceDelay('x'.repeat(20)), 2.4);       // lifetime - 0.6
  assert.equal(paceDelay('hi'), 1.9);                 // lifetime 2.5 - 0.6
  assert.ok(paceDelay('hi') >= 1.6);                  // never faster than 1.6 s
});

test('overlapping bubbles are pushed apart vertically, side by side ones are not', async () => {
  const { pushApart } = await import('./bubbles.js');
  const boxes = [{ x: 100, y: 200, w: 200, h: 40 }, { x: 100, y: 210, w: 200, h: 40 }];
  const out = pushApart(boxes);
  assert.ok(Math.abs(out[0].y - out[1].y) >= 40 + 6 - 1e-9, 'boxes must not overlap');
  assert.ok(out[0].y < out[1].y, 'the higher box stays higher');
  assert.deepEqual(boxes, [{ x: 100, y: 200, w: 200, h: 40 }, { x: 100, y: 210, w: 200, h: 40 }], 'input untouched');
  const apart = pushApart([{ x: 100, y: 100, w: 60, h: 40 }, { x: 400, y: 110, w: 60, h: 40 }]);
  assert.equal(apart[0].y, 100);
  assert.equal(apart[1].y, 110);
});

test('bubbles: one per speaker, replaced by a new line, off map and off screen get none', async () => {
  const { createBubbles } = await import('./bubbles.js');
  const host = fakeDom();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const person = (id, x) => ({ id, name: id, pos: new THREE.Vector3(x, 0, 0), def: { h: 1.8 }, away: false, dead: false, asleep: false, obj: { visible: true } });
  const marcus = person('marcus', 0), elena = person('elena', 1);
  const g = { family: [marcus, elena], map: { sites: [] }, sim: { speed: 1 } };
  const bubbles = createBubbles(g, { camera });

  assert.ok(bubbles.say('marcus', 'First line'), 'an on-map family member bubbles');
  assert.equal(host.children.length, 1);
  bubbles.say('marcus', 'Second line');
  assert.equal(host.children.length, 1, 'a new line from the same speaker replaces the bubble');
  assert.equal(host.children[0].textContent, 'Second line');
  assert.ok(bubbles.say('elena', 'Mine too'));
  assert.equal(host.children.length, 2);
  assert.equal(bubbles.say('radio', 'Radio traffic'), null, 'radio is log only');
  assert.equal(bubbles.say('nobody', 'No such person'), null, 'no figure, no bubble');
  marcus.away = true;
  assert.equal(bubbles.say('marcus', 'On the road'), null, 'a speaker on a trip gets no bubble');

  // the bubble ages out, and the clock holds while the game is paused
  bubbles.update(1);
  const elenaBubble = host.children[1];
  assert.notEqual(elenaBubble.style.display, 'none');
  assert.equal(host.children[0].style.display, 'none', 'a speaker on a trip has no bubble');
  g.sim.speed = 0;
  bubbles.update(30);
  assert.notEqual(elenaBubble.style.display, 'none', 'a paused game holds the bubble');
  g.sim.speed = 1;
  bubbles.update(30);
  assert.equal(host.children.length, 0, 'the bubbles are gone after their lifetime');
});

test('beat lines pace by bubble lifetime and hurry at 1.4 s once the step is done', async () => {
  const { paceDelay } = await import('./bubbles.js');
  const { g, b, messages } = prologue([
    { id: 'talk', day: -1, at: 435, lines: [
      { who: 'elena', text: 'Short.' },
      { who: 'marcus', text: 'x'.repeat(100) },
      { who: 'elena', text: 'Again.' },
    ], do: { type: 'use', target: 'coffee' } },
  ]);
  const said = [];
  g.bubbles = { say: (who, text) => said.push([who, text]) };
  b.update(0, 0.01);
  assert.equal(messages.length, 1, 'the first line is spoken at once');
  assert.deepEqual(said[0], ['elena', 'Short.'], 'and it reaches the bubble');
  b.update(0, 1.0);
  assert.equal(messages.length, 1, 'the next line waits for the bubble');
  b.update(0, 1.0);
  assert.equal(messages.length, 2, 'short line: lifetime 2.5 - 0.6 = 1.9 s');
  assert.deepEqual(said[1], ['marcus', 'x'.repeat(100)]);
  assert.equal(paceDelay('x'.repeat(100)), 6.4, 'a long line holds the floor for a while');
  b.notify('use', 'marcus', 'coffee');   // the step is done: the rest hurries
  b.update(0, 1.0);
  assert.equal(messages.length, 2, 'the hurry is 1.4 s, not 1.0 s');
  b.update(0, 0.6);
  assert.equal(messages.length, 3, 'and then the line comes');
});

test('a spoken need line bubbles from the kid; narration stays in the log', () => {
  const { g, messages } = fixture();
  const said = [];
  g.bubbles = { say: (who, text) => said.push([who, text]) };
  const theo = g.family.find((x) => x.id === 'theo');
  theo.deficit = 0.4;                       // 1.7% of body mass: thirsty, nothing worse
  theo.alerts();
  assert.deepEqual(said, [['theo', "I'm thirsty. Can I have water?"]]);
  assert.ok(messages.includes('Theo: "I\'m thirsty. Can I have water?"'), 'the log keeps the line');
  theo.needs.food = 10;
  theo.alerts();
  assert.deepEqual(said[1], ['theo', "My stomach hurts. When's breakfast?"]);
  theo.needs.morale = 10;
  theo.alerts();
  assert.equal(said.length, 2, 'narration gets no bubble');
  assert.ok(messages.some((m) => m.includes('Theo is crying')));
});
