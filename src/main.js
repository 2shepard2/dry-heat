// Dry Heat, grey box. Boot, render, input, and the game-level rules that tie map, sim and family together.
import * as THREE from 'three';
import { makeFigure } from './figure.js';
import { buildMap, T } from './map.js';
import { buildWorld } from './build.js';
import { Sim } from './sim.js';
import { NightEvents } from './events.js';
import { SurvivalSystems } from './systems.js';
import { Member, FAMILY } from './family.js';
import { nearbyWalkable } from './path.js';
import { UI } from './ui.js';
import { makeRng } from './rng.js';
import {
  ITEMS, PER_L, capOf, entryKg, invKg, isLiquid, refillable, addEntry, isSpoiled, rollLoot, label, takeOne, openerIn, itemHint,
} from './inventory.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const map = buildMap();
const sim = new Sim();

// isometric orthographic camera that orbits in 90° steps
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const cam = { target: new THREE.Vector3(29, 0, 11), yaw: Math.PI / 4, yawGoal: Math.PI / 4, view: 30, zoom: 2.1 };
function placeCamera() {
  const d = 80;
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * d, d * 0.95, cam.target.z + Math.cos(cam.yaw) * d);
  camera.lookAt(cam.target);
  const aspect = innerWidth / innerHeight;
  const hh = cam.view / cam.zoom / 2;
  camera.left = -hh * aspect; camera.right = hh * aspect; camera.top = hh; camera.bottom = -hh;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); placeCamera(); });

// lights: sun arcs east → south → west; moon is a dim blue fill
const hemi = new THREE.HemisphereLight(0xd8e4f0, 0x8a6f50, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0x8fa6d8, 0.3);
moon.position.set(map.W / 2 - 30, 50, map.H / 2 - 20);
moon.target.position.set(map.W / 2, 0, map.H / 2);
scene.add(moon, moon.target);

const C = (h) => new THREE.Color(h);
const SKY = { night: C(0x0a0e18), dawn: C(0xd99a6a), day: C(0xc8d3d8), haze: C(0xe1d2b4) };
function updateLight() {
  const s = sim.sun();
  const a = sim.sunAngle();
  const center = new THREE.Vector3(map.W / 2, 0, map.H / 2);
  sun.position.set(center.x + Math.cos(a) * 60, 6 + Math.sin(Math.max(0, a)) * 70 * Math.max(s, 0.05), center.z + 25 * Math.max(0, Math.sin(a)));
  sun.target.position.copy(center);
  sun.intensity = 3.4 * Math.pow(s, 0.6);
  sun.visible = s > 0.001;
  const low = 1 - Math.min(1, s * 2.2);
  sun.color.setHex(0xfff4e2).lerp(C(0xff9a50), low);
  hemi.intensity = 0.035 + 1.05 * Math.min(1, s * 2.2);
  hemi.color.setHex(0x2a3858).lerp(C(0xdde6ee), Math.min(1, s * 1.5));
  moon.intensity = 0.065 * (1 - Math.min(1, s * 4));
  const bg = SKY.night.clone();
  if (s > 0) bg.copy(SKY.dawn).lerp(SKY.day, Math.min(1, s * 2.5)).lerp(SKY.haze, Math.max(0, s - 0.6));
  scene.background = bg;
}

// Allocate once, without shadows. Keeping four lights in the scene avoids
// rebuilding all world materials when equipment is switched on and off.
const lightPool = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xffffff, 0, 7, 2);
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdf9b }));
  emitter.visible = false;
  l.add(emitter);
  l.userData.emitter = emitter;
  scene.add(l);
  return l;
});

// ---------------------------------------------------------------- game object
const rng = makeRng(Date.now() >>> 0);
const game = {
  scene, map, sim, ITEMS, lightPool, family: [], selected: [], opens: new Map(), over: false, frames: 0,
  objectives: [
    { id: 'tub', text: 'Fill the bathtub while the taps still run' },
    { id: 'look', text: 'Search the house for supplies' },
    { id: 'shade', text: 'Shade a west or south window (foil or windshield shade)' },
    { id: 'solar', text: 'Visit Walt, find Pruitt’s RV battery, build a small circuit' },
    { id: 'night', text: 'Keep everyone alive until nightfall (8 PM)' },
  ],
  log: (t, k) => ui.log(t, k),
  objective(id, state = 'done') {
    const o = game.objectives.find((x) => x.id === id);
    if (o && !o.done && !o.failed) { o[state] = true; if (state === 'done') game.log(`Done: ${o.text}.`, 'good'); }
  },
  setSpeed(s) { sim.speed = s; },
  selectById(id, add) {
    const m = game.family.find((x) => x.id === id);
    if (m) select(m, add);
  },
  focusOn(m) { if (m) cam.target.set(m.pos.x, 0, m.pos.z); },

  // Light records own their item until it is switched off or picked up. Four
  // reusable, shadow-free GPU lights keep shader cost bounded on laptops.
  lights: [],
  lightPosition(l) { return l.owner ? l.owner.pos : l.pos; },
  lightReaches(l, x, y) {
    const p = game.lightPosition(l), d = Math.hypot(p.x - x, p.z - y);
    if (l.left <= 0 || d > ITEMS[l.entry.id].light.radius) return false;
    // Walls block gameplay illumination; furniture and open doorways do not.
    const steps = Math.max(1, Math.ceil(d * 4));
    for (let k = 1; k < steps; k++) {
      const t = map.get(Math.floor(p.x + (x - p.x) * k / steps), Math.floor(p.z + (y - p.z) * k / steps));
      if (t === T.WALL || t === T.BLOCK) return false;
    }
    return true;
  },
  isDark(m) {
    return sim.sun() < 0.08 && map.isIndoor(...m.cell())
      && !game.lights.some((l) => game.lightReaches(l, m.pos.x, m.pos.z));
  },
  candleHeat(m) {
    if (!map.isIndoor(...m.cell())) return 0;
    return game.lights.reduce((sum, l) => sum + (game.lightReaches(l, m.pos.x, m.pos.z) ? (ITEMS[l.entry.id].light.heat || 0) : 0), 0);
  },
  householdInventories() {
    return [...game.family.filter((m) => !m.dead).map((m) => m.inv),
      ...map.objects.filter((o) => o.home && o.searched).map((o) => o.items)];
  },
  // Batteries/ignition must be carried by this person; cans can use the shared
  // household tools, including discovered tools still in home containers.
  lightItem(m, i) {
    const e = m.inv[i], spec = ITEMS[e?.id]?.light;
    if (!spec || !m.canAct()) return false;
    game.systems.deadSolar();
    if (game.lights.length >= 4) { game.log('Four lights are already on. Put one out first.', 'warn'); return false; }
    if (!spec.placed && game.lights.some((l) => l.owner === m)) {
      game.log(`${m.name} already has a light on. Switch it off first.`, 'warn'); return false;
    }
    if (e.id === 'headlamp' && m.worn) {
      game.log(`${m.name} needs to take off the ${ITEMS[m.worn.id].name.toLowerCase()} first.`, 'warn'); return false;
    }
    let left = e.chargeMin || 0;
    if (e.id === 'candle') {
      if (!m.inv.some((x) => ['lighter', 'matches'].includes(x.id) && x.n > 0)) {
        game.log(`${m.name} needs a lighter or matches to light the candle.`, 'warn'); return false;
      }
      left = e.chargeMin ?? spec.minutes;
    } else if (left <= 0) {
      const battery = m.inv.find((x) => (x.id === 'aa_batteries' || x.id === 'aa_rechargeable' && x.chargeMin > 0) && x.n > 0);
      if (!battery) { game.log(`${m.name} needs a pack of AA batteries.`, 'warn'); return false; }
      if (battery.id === 'aa_rechargeable') { const pack = takeOne(m.inv, battery); pack.chargeMin = 0; addEntry(m.inv, pack); }
      else takeOne(m.inv, battery);
      left = spec.minutes;
    }
    const entry = takeOne(m.inv, e);
    const l = { entry, left, owner: spec.placed ? null : m, pos: m.pos.clone() };
    game.lights.push(l);
    if (e.id === 'headlamp') m.worn = entry;
    game.log(e.id === 'candle' ? `${m.name} lights a candle and sets it down. A little light, a little more heat.`
      : spec.placed ? `${m.name} switches on the lantern and sets it down.`
      : e.id === 'headlamp' ? `${m.name} puts on the headlamp. Both hands free.` : `${m.name} holds the flashlight on.`);
    game.updateLights(0);
    return true;
  },
  // Explicit hooks for smoke tests, with the same requirements as the menu.
  placeLight(m, i) { return game.lightItem(m, i); },
  stopLight(m, l) {
    if (!game.lights.includes(l) || !m.canAct()) return false;
    if (l.owner ? l.owner !== m : m.pos.distanceTo(l.pos) > 2.6) return false;
    const extra = l.owner ? 0 : ITEMS[l.entry.id].kg;
    if (m.kg() + extra > m.cap) { game.log(`${m.name} can't carry the light. Too heavy.`, 'warn'); return false; }
    l.entry.chargeMin = Math.max(0, l.left);
    if (m.worn === l.entry) m.worn = null;
    game.lights.splice(game.lights.indexOf(l), 1);
    addEntry(m.inv, l.entry);
    game.log(`${m.name} ${l.entry.id === 'candle' ? 'blows out' : 'switches off'} the ${ITEMS[l.entry.id].name.toLowerCase()} and packs it away.`);
    game.updateLights(0);
    return true;
  },
  updateLights(dtMin) {
    for (const l of [...game.lights]) {
      l.left = Math.max(0, l.left - dtMin);
      if (l.left > 0) continue;
      game.lights.splice(game.lights.indexOf(l), 1);
      if (l.owner?.worn === l.entry) l.owner.worn = null;
      if (l.entry.id === 'candle') game.log('A candle burns down. The room is darker.');
      else {
        l.entry.chargeMin = 0;
        // A flat placed lantern remains on the floor until someone retrieves it.
        if (l.owner) addEntry(l.owner.inv, l.entry);
        else game.spentLights.push(l);
        game.log(`The ${ITEMS[l.entry.id].name.toLowerCase()} goes dark. The batteries are spent.`);
      }
    }
    game.lightPool.forEach((point, i) => {
      const l = game.lights[i];
      point.userData.emitter.visible = !!l;
      if (!l) { point.intensity = 0; return; }
      const spec = ITEMS[l.entry.id].light, p = game.lightPosition(l);
      point.position.set(p.x, p.y + (l.owner ? l.owner.def.h * (l.entry.id === 'headlamp' ? 0.87 : 0.65) : 0.35), p.z);
      point.color.setHex(spec.color);
      point.distance = spec.radius;
      point.intensity = spec.intensity;
    });
  },
  spentLights: [],
  pickupLight(m, l) {
    if (!m.canAct() || !game.spentLights.includes(l) || m.pos.distanceTo(l.pos) > 2.6 || m.kg() + ITEMS[l.entry.id].kg > m.cap) return false;
    game.spentLights.splice(game.spentLights.indexOf(l), 1);
    addEntry(m.inv, l.entry);
    game.log(`${m.name} picks up the flat lantern.`);
    return true;
  },
  wearItem(owner, i, target = owner) {
    const e = owner.inv[i], it = ITEMS[e?.id];
    if (!it?.wear || !owner.canAct() || !target.canAct() || !game.near(owner, target)) return false;
    if (it.light) return owner === target && game.lightItem(owner, i);
    if (target !== owner && target.kg() + it.kg > target.cap) return false;
    if (target.worn && !game.unwearItem(target)) return false;
    target.worn = takeOne(owner.inv, e);
    game.log(`${target.name} puts on the ${it.name.toLowerCase()}.`);
    return true;
  },
  unwearItem(m) {
    if (!m.worn || !m.canAct()) return false;
    const l = game.lights.find((x) => x.entry === m.worn);
    if (l) return game.stopLight(m, l);
    const e = m.worn;
    m.worn = null;
    addEntry(m.inv, e);
    game.log(`${m.name} takes off the ${ITEMS[e.id].name.toLowerCase()}.`);
    return true;
  },
  equipmentMenu(m, x, y) {
    const items = [];
    if (m.worn) items.push({ label: `Take off ${ITEMS[m.worn.id].name.toLowerCase()}`, fn: () => game.unwearItem(m) });
    for (const l of game.lights.filter((l) => l.owner === m || !l.owner && m.pos.distanceTo(l.pos) <= 2.6)) {
      items.push({ label: `Put out / pack ${ITEMS[l.entry.id].name.toLowerCase()}`, hint: `${Math.ceil(l.left)} minutes left`, fn: () => game.stopLight(m, l) });
    }
    for (const l of game.spentLights.filter((l) => m.pos.distanceTo(l.pos) <= 2.6)) items.push({ label: 'Pick up flat lantern', fn: () => game.pickupLight(m, l) });
    if (!items.length) items.push({ label: 'No equipment or nearby lights', disabled: true });
    ui.menu(x, y, items, `${m.name}: equipment`);
  },

  searchDone(m, o) {
    if (!o.lootRolled) {
      o.lootRolled = true;
      o.unseen = rollLoot(o, rng, map.lots[o.lot]?.id);
    }
    const dark = game.isDark(m), found = [], missed = [];
    for (const e of o.unseen || []) (dark && rng.chance(0.30) ? missed : found).push(e);
    game.systems.stock(o, found);
    for (const e of found) addEntry(o.items, e);
    o.unseen = missed;
    o.searched = true;
    game.log(`${m.name} goes through the ${o.name.toLowerCase()}: ${found.length ? `${found.length} kinds of thing` : 'nothing else worth taking'}.`);
    if (dark) game.log('Hard to see. Something may have been missed. Search again with a light.');
    if (o.home) game.objective('look');
    game.openContainer(m, o);
  },
  openContainer(m, o) { game.opens.set(m, o); },

  fillContainers(m) {
    let filled = 0;
    for (const e of m.inv) {
      if (!refillable(e)) continue;
      const room = capOf(e.id) - e.left;
      const l = Math.min(room, sim.tubL, (m.cap - m.kg()));
      if (l <= 0) continue;
      e.left += l; sim.tubL -= l; filled += l;
    }
    game.log(filled > 0 ? `${m.name} fills containers from the tub: ${filled.toFixed(1)} L.` : `${m.name} has nothing to fill, or can't carry more.`);
  },

  // ---- inventory actions
  near(a, b, r = 2.6) { return a === b || a.pos.distanceTo(b.pos) <= r; },
  itemMenu(m, i, x, y) {
    const e = m.inv[i];
    if (!e) return;
    const it = ITEMS[e.id];
    const items = [];
    const systemAction = (label, fn, hint = '') => items.push({ label, fn, hint, disabled: !m.canAct() });
    if (e.id === 'radio_handcrank') systemAction('Crank and listen', () => game.playRadio(m), '2 min · next available broadcast');
    if (['aluminum_foil', 'windshield_shade'].includes(e.id)) {
      for (const site of map.sites.filter((s) => s.kind === 'window' && !game.systems.shades.has(s.key)))
        systemAction(`Shade ${site.name.toLowerCase()}`, () => game.shadeWindow(m, site.key), 'walk there · 8 min');
    }
    if (e.id === 'tarp') systemAction('Rig shade at yard posts', () => game.rigTarp(m, [m, ...game.selected]), 'two people · 20 min');
    if (['propane_tank', 'charcoal_bag'].includes(e.id)) systemAction('Cook on the yard grill', () => game.cookGrill(m, e.id === 'propane_tank' ? 'propane' : 'charcoal'), 'bring food · 20 min');
    if (['deep_cycle_battery', 'charge_controller'].includes(e.id)) systemAction('Build at the garage panel', () => game.buildCircuit(m));
    if (e.id === 'box_fan') systemAction('Place in the living room', () => game.placeFan(m));
    if (e.id === 'aa_rechargeable') systemAction('Charge at the living room circuit', () => game.chargeSolar(m));
    if (e.id === 'nebulizer') systemAction('Treat Theo at the living room circuit', () => game.useNebulizer(m));
    const others = game.family.filter((o) => o !== m && !o.dead);
    if (it.light) items.push({ label: it.light.placed ? 'Light and place here' : e.id === 'headlamp' ? 'Wear and switch on' : 'Hold and switch on',
      hint: e.id === 'candle' ? 'needs lighter or matches · adds heat' : 'needs AA batteries when flat', disabled: !m.canAct(), fn: () => game.lightItem(m, m.inv.indexOf(e)) });
    if (it.wear && !it.light) for (const target of [m, ...others]) items.push({ label: `Wear (${target.name})`,
      hint: it.wear.wetMinutes ? `soak at the tub: ${it.wear.wetMinutes} minutes cooling` : target.worn ? 'replaces worn item' : 'one worn slot', disabled: !m.canAct() || !target.canAct() || !game.near(m, target), fn: () => game.wearItem(m, m.inv.indexOf(e), target) });
    const consumable = it.use || PER_L[e.id];
    if (!consumable && !it.light && !it.wear) items.push({ label: itemHint(e.id), disabled: true });
    if (consumable) {
      const verb = isLiquid(e) ? 'Drink 1 L' : it.cat === 'water' ? 'Drink' : it.cat === 'food' ? 'Eat' : 'Use';
      const empty = isLiquid(e) && e.left < 0.05;
      const at = () => m.inv.indexOf(e);
      items.push({ label: `${verb} (${m.name})`, disabled: empty || !m.canAct(), fn: () => game.useItem(m, at(), m) });
      for (const o of others) {
        const ok = game.near(m, o);
        items.push({ label: `${verb.replace('Drink', 'Give a drink').replace('Eat', 'Feed').replace('Use', 'Use on')} → ${o.name}`,
          hint: ok ? '' : 'too far away', disabled: !ok || empty || o.collapsed, fn: () => game.useItem(m, at(), o) });
      }
    }
    const at = () => m.inv.indexOf(e);
    if (isLiquid(e)) {
      for (const o of game.family.filter((x) => !x.dead)) {
        const ok = game.near(m, o);
        items.push({ label: `Pour over ${o === m ? 'yourself' : o.name} to cool down`, hint: ok ? `uses up to 2 L` : 'too far away', disabled: !ok || e.left < 0.3,
          fn: () => game.pourOver(m, e, o) });
      }
    }
    for (const o of others) {
      const ok = game.near(m, o);
      items.push({ label: `Hand to ${o.name}`, hint: ok ? '' : 'too far away', disabled: !ok || o.collapsed, fn: () => game.give(m, at(), o) });
    }
    const opened = game.opens.get(m);
    if (opened) items.push({ label: `Put in ${opened.name.toLowerCase()}`, fn: () => game.put(m, opened, at()) });
    ui.menu(x, y, items, label(e, sim));
  },

  useItem(owner, i, target, opened = false) {
    const e = owner.inv[i];
    if (!e || target.dead || !owner.canAct()) return;
    if (!game.near(owner, target)) { game.log(`${target.name} is too far away now.`, 'warn'); return; }
    const it = ITEMS[e.id];
    if (e.id === 'radio_handcrank') return game.playRadio(owner);
    if (e.id === 'nebulizer') return game.useNebulizer(owner);
    if (it.light) return owner === target && game.lightItem(owner, i);
    if (it.wear) return game.wearItem(owner, i, target);
    if (!it.use && !PER_L[e.id]) { game.log(itemHint(e.id)); return; }
    const tags = it.tags || [];
    if (tags.includes('needsCooking')) { game.log(`${it.name} needs cooking. No power, no stove. You'd need propane or charcoal and a grill.`, 'warn'); return; }
    if (tags.includes('needsOpener') && !opened) {
      const opener = openerIn(game.householdInventories());
      if (!opener) { game.log(`${owner.name} can't get the can open. Need a can opener, multitool or knife in the household.`, 'warn'); return; }
      if (['pocket_knife', 'kitchen_knife'].includes(opener)) {
        owner.stopTask(true);
        owner.task = { type: 'openCan', t: 0, dur: 5, entry: e, target };
        game.log(`${owner.name} works the knife around the lid. This takes a while.`);
        return;
      }
    }
    const n = target.needs;
    // hydration values in the data are "points per 35"; the body works in liters
    const apply = (use, k = 1) => {
      for (const [key, v] of Object.entries(use)) {
        if (key === 'hydration') target.drink((v * k) / 35);
        else n[key] = clamp(n[key] + v * k);
      }
    };
    if (tags.includes('needsWater')) {
      const src = [owner, target].flatMap((p) => p.inv).find((x) => isLiquid(x) && PER_L[x.id]?.hydration >= 35 && x.left >= 0.5);
      if (!src) { game.log(`${it.name} has to be mixed with clean water. Nobody here is carrying any.`, 'warn'); return; }
      const l = Math.min(1, src.left);
      src.left -= l;
      target.drink(l * (e.id === 'electrolyte_packets' ? 1.3 : 1));
    }
    if (isLiquid(e)) {
      const l = Math.min(target.child ? 0.5 : 1, e.left);
      if (l < 0.05) return;
      const sp = isSpoiled(e, sim);
      apply(PER_L[e.id], l);
      if (sp) { n.health = clamp(n.health - 10); target.drink(-0.3); game.log(`It's turned. ${target.name} gags on it.`, 'bad'); }
      e.left = Math.max(0, e.left - l);
      if (!['water_gallon', 'water_gallon_half', 'water_cooler_jug', 'bucket_5gal', 'cooler'].includes(e.id) && e.left < 0.05) owner.inv.splice(i, 1);
      game.log(`${target.name} drinks ${l.toFixed(1)} L of ${it.name.toLowerCase()}.`);
      return;
    }
    const spoiled = isSpoiled(e, sim);
    apply(it.use || {});
    if (spoiled) { n.health = clamp(n.health - 12); n.morale = clamp(n.morale - 6); }
    e.n -= 1;
    if (e.n <= 0) owner.inv.splice(i, 1);
    const who = target === owner ? target.name : `${owner.name} gives ${target.name}`;
    game.log(spoiled ? `${who} ${target === owner ? 'eats' : ''} the ${it.name.toLowerCase()} anyway. It had turned. Stomach cramps follow.`
      : `${who}: ${it.name.toLowerCase()}.`, spoiled ? 'bad' : '');
  },

  moveEntry(fromInv, i, toInv, all, capKg, who) {
    const e = fromInv[i];
    if (!e) return false;
    const unit = isLiquid(e) ? entryKg(e) : ITEMS[e.id].kg;
    const wearer = game.family.find((m) => m.inv === toInv);
    const room = capKg === Infinity ? Infinity : capKg - invKg(toInv) - (wearer?.equipmentKg() || 0);
    if (isLiquid(e) || e.n === 1 || !all) {
      if (unit > room + 1e-6) { game.log(`${who} can't carry that. Too heavy.`, 'warn'); return false; }
      if (isLiquid(e) || e.n === 1) { fromInv.splice(i, 1); addEntry(toInv, e); }
      else { e.n -= 1; addEntry(toInv, { id: e.id, n: 1 }); }
      return true;
    }
    const k = Math.min(e.n, Math.floor((room + 1e-6) / unit));
    if (k <= 0) { game.log(`${who} can't carry that. Too heavy.`, 'warn'); return false; }
    e.n -= k;
    addEntry(toInv, { id: e.id, n: k });
    if (e.n <= 0) fromInv.splice(i, 1);
    return true;
  },
  take(m, o, i, one) { game.moveEntry(o.items, i, m.inv, !one, m.cap, m.name); },
  takeAll(m, o) {
    for (let i = o.items.length - 1; i >= 0; i--) game.moveEntry(o.items, i, m.inv, true, m.cap, m.name);
  },
  put(m, o, i) { game.moveEntry(m.inv, i, o.items, true, Infinity, m.name); },
  give(m, i, o) { if (!game.near(m, o) || o.dead) { game.log(`${o.name} is too far away now.`, 'warn'); return; } if (game.moveEntry(m.inv, i, o.inv, true, o.cap, o.name)) game.log(`${m.name} hands ${o.name} the ${ITEMS[(o.inv.at(-1) || {}).id]?.name.toLowerCase() || 'item'}.`); },

  rng: null,
  pourOver(m, e, o) {
    if (!game.near(m, o) || !m.canAct()) { game.log(`${o.name} is too far away now.`, 'warn'); return; }
    const l = Math.min(2, e.left);
    if (l < 0.3) return;
    e.left -= l;
    o.wetMin = 50;
    o.bodyT = Math.max(98.6, o.bodyT - 0.6 * l);
    game.log(`${m.name} pours ${l.toFixed(1)} L over ${o === m ? 'their own head and neck' : o.name}. Water that won't be drunk.`);
  },
  douse(m, v) {
    if (v.dead) return;
    const src = m.inv.find((x) => isLiquid(x) && x.left >= 0.5 && PER_L[x.id]?.hydration);
    const nearTub = map.tub && Math.hypot(map.tub.x + 0.5 - m.pos.x, map.tub.y + 0.5 - m.pos.z) < 3.5 && sim.tubL >= 1;
    if (src) game.pourOver(m, src, v);
    else if (nearTub) { const l = Math.min(3, sim.tubL); sim.tubL -= l; v.wetMin = 60; v.bodyT = Math.max(98.6, v.bodyT - 0.6 * l); game.log(`${m.name} scoops ${l.toFixed(0)} L from the tub over ${v.name}.`); }
    else game.log(`${m.name} has no water to pour. Carry a jug, or get ${v.name} to the tub.`, 'warn');
  },
  // nearest walkable indoor cell (or anywhere at night)
  nearestShade([sx, sy]) {
    if (sim.sun() < 0.05 || map.isIndoor(sx, sy) || game.systems.yardShade(sx, sy)) return [sx, sy];
    const seen = new Set([sy * map.W + sx]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (map.walkable(x, y) && (game.systems.yardShade(x, y) || map.isIndoor(x, y) && map.get(x, y) !== 4 && map.get(x, y) !== 12)) return [x, y];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * map.W + nx;
        if (!seen.has(k) && map.walkable(nx, ny)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return null;
  },
  inEarshot(a, b) {
    const ha = map.houseOf(...a.cell()), hb = map.houseOf(...b.cell());
    return a.pos.distanceTo(b.pos) <= 9 || (ha >= 0 && ha === hb);
  },
  memberMenu: (v, x, y) => memberMenu(v, x, y),
  freeBed(m) {
    const taken = new Set(game.family.filter((x) => x !== m && x.asleep && x.bed).map((x) => x.bed));
    const beds = map.objects.filter((o) => o.kind === 'bed' && o.home && !taken.has(o));
    return beds.sort((a, b) => Math.hypot(a.x - m.pos.x, a.y - m.pos.z) - Math.hypot(b.x - m.pos.x, b.y - m.pos.z))[0];
  },
  // A job is a list of steps; the lead walks to each step's cells, waits for the whole crew, works `dur` minutes.
  startJob(lead, job) {
    job.i = 0;
    if (!game.jobStep(lead, job)) return false;
    for (const m of job.crew) if (m !== lead) m.order('help', lead);
    if (job.say) game.log(`${lead.name}: "${job.say}"`);
    return true;
  },
  jobStep(lead, job) {
    const s = job.steps[job.i];
    job.label = s.label; job.dur = s.dur; job.walkLabel = s.walkLabel;
    if (!lead.approach(s.cells(), { type: 'job', job }, s.what || 'there')) { game.dropCarry(); return false; }
    return true;
  },
  jobDone(lead, job) {
    job.steps[job.i].done(lead);
    job.i++;
    if (job.i < job.steps.length) game.jobStep(lead, job);
    else job.finish?.(lead);
  },

  // ---- the mattress haul: bedroom by bedroom, everyone lifting, into the living room
  mattressJob(lead, crew) {
    const beds = map.objects.filter((o) => o.kind === 'bed' && o.home && !o.together).sort((a, b) => a.y - b.y || a.x - b.x);
    if (!beds.length) { game.mattressesMoved = true; return; }
    // floor spots in the middle of the living room, away from the west wall; whoever stands on them is moved off
    const spots = [[31, 12], [32, 12], [31, 13], [32, 13]].filter(([x, y]) => map.walkable(x, y));
    const share = beds.map((_, k) => (beds.length < spots.length && k === 0 ? 2 : 1)); // the big bed takes two spots
    let n = 0;
    const plan = beds.map((b, k) => { const s = spots.slice(n, n + share[k]); n += share[k]; return s; }).filter((s) => s.length);
    const steps = [];
    plan.forEach((cells, k) => {
      const b = beds[k];
      const big = cells.length > 1;
      const what = big ? 'the big mattress' : 'a mattress';
      steps.push({ label: `Lifting ${what}`, walkLabel: `Going for ${what}`, dur: 2, what: `the ${b.name.toLowerCase()}`, cells: () => game.standCells(b),
        done: (l) => game.liftMattress(l, b, big) });
      steps.push({ label: `Setting down ${what}`, walkLabel: `Carrying ${what}`, dur: 1, what: 'the living room', cells: () => game.dropStand(cells),
        done: () => game.placeMattress(cells) });
    });
    game.startJob(lead, { crew, steps, say: 'Everybody, come help me with the mattresses.', finish: () => {
      game.mattressesMoved = true;
      for (const o of map.objects) if (o.kind === 'bed' && o.home && !o.together) { if (o.mesh) o.mesh.scale.y = 0.35; o.name = 'Bare bed frame'; o.kind = 'frame'; }
      game.log('The mattresses are on the living room floor, away from the west wall. Everyone sleeps in one room now.', 'good');
    } });
  },
  // where to stand to get at a bed (a bed boxed in by furniture is reached from next to it)
  standCells(o) {
    const c = map.useCells(o);
    if (c.length) return c;
    const out = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = o.x + dx, y = o.y + dy;
      if (map.walkable(x, y) && map.houseOf(x, y) === map.houseOf(o.x, o.y)) out.push([x, y]);
    }
    return out;
  },
  dropStand(cells) {
    const out = [];
    for (const [x, y] of cells) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (map.walkable(nx, ny) && !cells.some(([a, b]) => a === nx && b === ny)) out.push([nx, ny]);
    }
    return out;
  },
  carry: null,
  liftMattress(lead, bed, big) {
    const geo = new THREE.BoxGeometry(big ? 1.5 : 0.95, 0.2, 1.9);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc9c1ad }));
    mesh.castShadow = true;
    scene.add(mesh);
    game.carry = { lead, mesh, bed };
    if (bed.mesh) bed.mesh.scale.y = 0.35;
    bed.name = 'Bare bed frame'; bed.kind = 'frame';
    const n = game.family.filter((m) => !m.dead).length;
    game.log(big ? `It takes all ${n} of them to get the big mattress off the frame and through the door.` : `They tip the mattress up off the frame and walk it out.`);
  },
  // the carry is abandoned (lead sent elsewhere, collapsed): the mattress goes back on its frame
  dropCarry() {
    const c = game.carry;
    if (!c) return;
    scene.remove(c.mesh); c.mesh.geometry.dispose();
    game.carry = null;
    if (c.bed) { if (c.bed.mesh) c.bed.mesh.scale.y = 1; c.bed.name = 'Bed'; c.bed.kind = 'bed'; }
    game.log(`${c.lead.name} lets go of the mattress. They shove it back onto the frame for now.`, 'warn');
  },
  placeMattress(cells) {
    const c = game.carry;
    if (c) { scene.remove(c.mesh); c.mesh.geometry.dispose(); game.carry = null; }
    const mat = new THREE.MeshLambertMaterial({ color: 0xc9c1ad });
    for (const [x, y] of cells) {
      const i = map.idx(x, y);
      const o = { id: map.objects.length, kind: 'bed', name: 'Mattress on the floor', x, y, w: 1, h: 1, lot: map.lots.indexOf(map.home), home: true, floor: map.type[i], together: true, items: [] };
      map.type[i] = 13; map.objAt[i] = o.id; map.objects.push(o);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.22, 0.98).translate(x + 0.5, 0.11, y + 0.5), mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.obj = o; o.mesh = mesh;
      scene.add(mesh); world.pickables.push(mesh);
      // nobody ends up standing inside it
      for (const m of game.family) {
        const [mx, my] = m.cell();
        if (mx !== x || my !== y) continue;
        const spot = nearbyWalkable(map, x, y, 1)[0];
        if (spot) m.pos.set(spot[0] + 0.5, m.pos.y, spot[1] + 0.5);
      }
    }
    game.log('They drop it on the living room floor with a thump.');
  },
  alarmT: 0,
  alarm() { game.alarmT = 3; },
  waterDays() {
    const alive = game.family.filter((m) => !m.dead);
    const perDay = alive.reduce((s, m) => s + m.lossRate(Math.max(sim.indoor, 90), 1) * 24, 0);
    const carried = [...alive.flatMap((m) => m.inv), ...map.objects.filter((o) => o.home && o.searched).flatMap((o) => o.items)].filter((e) => isLiquid(e) && PER_L[e.id]?.hydration >= 35).reduce((s, e) => s + e.left, 0);
    return { liters: sim.tubL + carried, perDay, days: perDay > 0 ? (sim.tubL + carried) / perDay : Infinity };
  },

  onDeath() {
    if (game.family.every((m) => m.dead)) {
      game.over = true;
      sim.speed = 0;
      $('#over').classList.remove('hidden');
      $('#over p').textContent = `Day ${sim.day}, ${sim.clock()}. Nobody is left in the house on this street.`;
    }
    game.objective('night', 'failed');
  },
};
const ui = new UI(game);
game.rng = rng;
game.systems = new SurvivalSystems(game);

// ---------------------------------------------------------------- selection + commands
const rings = new Map();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
marker.rotation.x = -Math.PI / 2;
marker.renderOrder = 5;
marker.visible = false;
marker.userData.t = 0;
scene.add(marker);
function select(m, add) {
  if (m.dead) return;
  if (m.ai) return; // kids aren't steered; click them for commands instead
  if (add) {
    game.selected = game.selected.includes(m) ? game.selected.filter((x) => x !== m) : [...game.selected, m];
  } else game.selected = [m];
}

function commandMove(x, y) {
  const group = game.selected.filter((m) => m.canAct() && m.willObey());
  if (!group.length) return;
  const spots = nearbyWalkable(map, x, y, group.length);
  marker.position.set(x + 0.5, 0.04, y + 0.5);
  marker.userData.t = 1;
  if (!spots.length) return;
  group.forEach((m, k) => {
    const [sx, sy] = spots[k % spots.length];
    if (!m.moveTo(sx, sy)) game.log(`${m.name} can't find a way there.`, 'warn');
  });
  for (const m of group) game.opens.delete(m);
}

function objectMenu(o, cx, cy) {
  const group = game.selected.filter((m) => m.canAct());
  const lead = group[0];
  if (!lead) { game.log('Pick someone first: click a family member or their card.', 'warn'); return; }
  const items = [];
  if (o.site) { ui.menu(cx, cy, game.systems.menu(o, lead, group), o.name); return; }
  if (o.car && o.home) items.push(...game.systems.carMenu(lead));
  const who = group.length > 1 ? `${lead.name}` : lead.name;
  if (o.kind === 'container') {
    if (o.unseen?.length) items.push({ label: `Search again (${who})`, hint: 'look for what was missed', fn: () => lead.useObject(o, 'search') });
    items.push(o.searched
      ? { label: `Open (${who})`, fn: () => lead.useObject(o, 'open') }
      : { label: `Search (${who})`, hint: o.home ? '' : 'someone else\'s things', fn: () => lead.useObject(o, 'search') });
  } else if (o.kind === 'sink') {
    const p = sim.pressure();
    for (const m of group) items.push({ label: `Drink from the tap (${m.name})`, disabled: p <= 0.05, hint: p <= 0.05 ? 'dry' : '', fn: () => m.useObject(o, 'drinkTap') });
  } else if (o.kind === 'tub') {
    if (o.home) {
      const p = sim.pressure();
      items.push({ label: `Fill the tub (${who})`, disabled: p <= 0.001 || sim.tubL >= sim.TUB_MAX, hint: p <= 0.001 ? 'no pressure' : `${Math.round(sim.tubL)}/${sim.TUB_MAX} L`, fn: () => lead.useObject(o, 'fillTub') });
      for (const m of group) items.push({ label: `Drink from the tub (${m.name})`, disabled: sim.tubL < 1, fn: () => m.useObject(o, 'drinkTub') });
      for (const m of group) items.push({ label: `Soak a towel and cool off (${m.name})`, hint: '2 L', disabled: sim.tubL < 2, fn: () => m.useObject(o, 'soak') });
      items.push({ label: `Fill containers from the tub (${who})`, disabled: sim.tubL < 0.5 || !lead.inv.some(refillable), hint: lead.inv.some(refillable) ? '' : 'carrying nothing to fill', fn: () => lead.useObject(o, 'fillCont') });
    } else items.push({ label: 'Bone dry. Whoever lived here didn\'t think to fill it.', disabled: true });
  } else if (o.kind === 'bed') {
    for (const m of group) items.push({ label: `Sleep (${m.name})`, hint: sim.indoor > 92 ? 'it\'s stifling in here' : '', fn: () => m.useObject(o, 'sleep') });
    if (o.home && !game.mattressesMoved) {
      const crew = game.family.filter((m) => !m.dead);
      const able = crew.every((m) => m.canAct());
      items.push({ label: `Everyone: drag the mattresses into the living room`, hint: able ? 'needs all of you · cooler, and together' : 'not while someone is down',
        disabled: !able, fn: () => game.mattressJob(lead, crew) });
    }
  }
  for (const it of items) { const f = it.fn; if (f) it.fn = () => { const who = game.selected.find((m) => m.canAct()); if (!who || who.willObey()) f(); }; }
  ui.menu(cx, cy, items, o.name + (o.car && o.home ? ` · ${o.fuelL.toFixed(1)} L` : '') + (o.home || o.lot < 0 ? '' : ` · ${map.lots[o.lot].name}`));
}

function memberMenu(v, cx, cy) {
  const helpers = game.selected.filter((m) => m !== v && m.canAct());
  const items = v.ai ? [] : [{ label: `Select ${v.name}`, disabled: v.dead, fn: () => select(v, false) }];
  const boss = helpers[0];
  if (v.canAct()) items.push({ label: 'Worn items and lights', fn: () => game.equipmentMenu(v, cx, cy) });
  if (!v.ai) items.push({ label: 'Keep watch', hint: 'at home · costs rest · H',
    disabled: !v.canAct() || v.watching || v.goal?.type === 'watch', fn: () => v.keepWatch() });
  if (v.flags.wandered) for (const h of helpers.filter((m) => !m.ai)) {
    items.push({ label: `${h.name}: fetch ${v.name}`, disabled: !v.canAct(), fn: () => h.tend(v, 'fetch') });
  }
  if (v.ai && !v.dead && !v.collapsed && !v.flags.wandered) {
    if (!boss) items.push({ label: 'Select Marcus or Elena to tell the kids what to do.', disabled: true });
    else {
      const hear = game.inEarshot(boss, v);
      const say = (label, type, extra = {}) => items.push({ label: `${boss.name}: "${label}"`, disabled: !hear || extra.disabled, hint: !hear ? `${v.name} can't hear you from here` : extra.hint || '', fn: () => v.order(type, boss) });
      say(v.mode.type === 'follow' && v.mode.who === boss.id ? 'Stay with me." (already)' : 'Stay with me."', 'follow');
      say('Wait here."', 'stay');
      say('Help me."', 'help', { disabled: !boss.task && !boss.goal, hint: !boss.task && !boss.goal ? `${boss.name} isn't doing anything` : 'works faster together' });
      say('Go get a drink from the tub."', 'drink', { disabled: game.sim.tubL < 0.5 });
      say('Go lie down."', 'rest');
      for (const e of v.inv) {
        const near = game.near(boss, v);
        items.push({ label: `Take ${label(e, sim)} from ${v.name}`, disabled: !near, hint: near ? '' : 'too far away', fn: () => { const i = v.inv.indexOf(e); if (i >= 0 && game.near(boss, v)) game.moveEntry(v.inv, i, boss.inv, true, boss.cap, boss.name); } });
      }
    }
  }
  if (!v.ai && !v.dead && !v.collapsed && boss && boss !== v) {
    items.push({ label: `Ask ${v.name} to help ${boss.name}`, disabled: !boss.task && !boss.goal, hint: !boss.task && !boss.goal ? `${boss.name} isn't doing anything` : '', fn: () => v.order('help', boss) });
  }
  for (const h of helpers) {
    items.push({ label: `${h.name}: pour water over ${v.name}`, hint: 'carried water, or the tub if close', disabled: v.dead, fn: () => h.tend(v, 'douse') });
    if (v.collapsed) {
      items.push({ label: `${h.name}: drag ${v.name} into the shade`, disabled: v.dead, hint: h.mass < v.mass * 0.55 ? 'too heavy alone: tell someone to help first' : 'faster with a helper', fn: () => h.tend(v, 'drag') });
    }
  }
  if (!items.length) return;
  ui.menu(cx, cy, items, `${v.name}: ${v.status()[0]}${v.ai ? ` · ${v.doing() || 'idle'}` : ''}`);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let world;
function pick(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...game.family.map((m) => m.hit), ...world.pickables], false);
  if (hits.length) {
    const u = hits[0].object.userData;
    if (u.member) return { member: u.member };
    if (u.obj) return { obj: u.obj };
  }
  const g = ray.intersectObject(world.pickPlane, false)[0];
  if (g) {
    const cell = [Math.floor(g.point.x), Math.floor(g.point.z)];
    const window = map.sites.find((s) => s.kind === 'window' && s.x === cell[0] && s.y === cell[1]);
    return window ? { obj: window } : { cell };
  }
  return null;
}
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (game.over || !started) return;
  ui.hideMenu();
  const p = pick(ev);
  if (!p) return;
  if (ev.button === 2) {
    if (p.member) memberMenu(p.member, ev.clientX, ev.clientY);
    else if (p.obj) objectMenu(p.obj, ev.clientX, ev.clientY);
    else if (p.cell) commandMove(...p.cell);
    return;
  }
  if (ev.button !== 0) return;
  if (p.member) {
    const helpers = game.selected.filter((m) => m !== p.member && m.canAct());
    if (p.member.ai || ((p.member.collapsed || p.member.dead) && helpers.length)) memberMenu(p.member, ev.clientX, ev.clientY);
    else select(p.member, ev.shiftKey);
  } else if (p.obj) objectMenu(p.obj, ev.clientX, ev.clientY);
  else if (p.cell && game.selected.length && !game.hintedMove) { game.hintedMove = true; game.log('To walk: right-click (two-finger tap) where you want them to go.'); }
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.zoom = Math.min(4.5, Math.max(0.7, cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
  placeCamera();
}, { passive: false });

const keys = new Set();
addEventListener('keydown', (e) => {
  if (!started) return;
  keys.add(e.key.toLowerCase());
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); sim.speed = sim.speed ? 0 : (game.lastSpeed || 1); }
  if (sim.speed) game.lastSpeed = sim.speed;
  if (k === '1') sim.speed = 1;
  if (k === '2') sim.speed = 4;
  if (k === '3') sim.speed = 12;
  if (k === 'q') cam.yawGoal += Math.PI / 2;
  if (k === 'e') cam.yawGoal -= Math.PI / 2;
  if (k === 'r') { roofsOff = !roofsOff; }
  if (k === 'tab') {
    e.preventDefault();
    const alive = game.family.filter((m) => !m.dead && !m.ai);
    const i = alive.indexOf(game.selected[0]);
    const m = alive[(i + 1) % alive.length];
    if (m) { select(m, false); game.focusOn(m); }
  }
  if (k === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); game.selected = game.family.filter((m) => !m.dead && !m.ai); }
  if (k === 'h' && !e.repeat) for (const m of game.selected) m.keepWatch();
  if (k === 'z') for (const m of game.selected) if (m.canAct()) { m.stopTask(true); m.goal = { type: 'sleep', obj: null }; m.startTask(); }
  if (k === 'f') game.focusOn(game.selected[0]);
  if (k === 'escape') { ui.hideMenu(); for (const m of game.selected) game.opens.delete(m); }
  if (k === '+' || k === '=') { cam.zoom = Math.min(4.5, cam.zoom * 1.15); placeCamera(); }
  if (k === '-') { cam.zoom = Math.max(0.7, cam.zoom / 1.15); placeCamera(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let roofsOff = false;

// ---------------------------------------------------------------- loop
let started = false, last = performance.now(), uiAcc = 0;
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.frames++;

  // camera pan (relative to view) and smooth 90° rotation
  const pan = 18 * dtReal / cam.zoom;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  if (!keys.has('control')) {
    if (keys.has('w') || keys.has('arrowup')) { cam.target.x += fx * pan; cam.target.z += fz * pan; }
    if (keys.has('s') || keys.has('arrowdown')) { cam.target.x -= fx * pan; cam.target.z -= fz * pan; }
    if (keys.has('d') || keys.has('arrowright')) { cam.target.x += rx * pan; cam.target.z += rz * pan; }
    if (keys.has('a') || keys.has('arrowleft')) { cam.target.x -= rx * pan; cam.target.z -= rz * pan; }
  }
  cam.target.x = Math.max(-5, Math.min(map.W + 5, cam.target.x));
  cam.target.z = Math.max(-5, Math.min(map.H + 5, cam.target.z));
  cam.yaw += (cam.yawGoal - cam.yaw) * Math.min(1, dtReal * 8);
  placeCamera();

  if (started && !game.over) {
    const dtMin = dtReal * sim.speed; // 1 real second = 1 game minute at 1x
    // sub-step the body sim at high speed so thresholds aren't skipped
    const steps = Math.max(1, Math.ceil(dtMin / 2));
    for (let s = 0; s < steps; s++) {
      sim.step(dtMin / steps);
      game.updateLights(dtMin / steps);
      game.systems.update(dtMin / steps);
      for (const m of game.family) m.update(dtMin / steps, dtReal / steps);
      if (dtMin > 0) game.nightEvents.update();
    }
    rules();
  }

  // cut away the upper walls + roof of any house with family inside
  map.lots.forEach((lot, i) => {
    const inside = game.family.some((m) => !m.dead && map.houseOf(...m.cell()) === i);
    world.lots[i].upper.visible = !(roofsOff || inside);
  });
  if (map.tub.water) {
    map.tub.water.visible = sim.tubL > 0.5;
    map.tub.water.material.opacity = 0.35 + 0.6 * (sim.tubL / sim.TUB_MAX);
  }
  for (const m of game.family) {
    let r = rings.get(m);
    if (!r) {
      r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 32), new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
      r.renderOrder = 5;
      r.rotation.x = -Math.PI / 2;
      scene.add(r);
      rings.set(m, r);
    }
    r.visible = game.selected.includes(m) && !m.dead;
    r.position.set(m.pos.x, 0.03 + (m.asleep && m.bed ? 0.55 : 0), m.pos.z);
    r.scale.setScalar(1 + 0.12 * Math.sin(now / 180));
  }
  if (marker.userData.t > 0) {
    marker.userData.t = Math.max(0, marker.userData.t - dtReal * 0.8);
    marker.visible = true;
    marker.material.opacity = marker.userData.t;
    marker.scale.setScalar(1.4 - 0.6 * marker.userData.t);
  } else marker.visible = false;
  {
    const worst = game.family.reduce((w, m) => Math.max(w, m.dead ? 0 : m.collapsed ? 1 : m.bodyT >= 101.5 || m.pct > 4.5 ? 0.6 : m.pct > 2.5 ? 0.3 : 0), 0);
    game.alarmT = Math.max(0, game.alarmT - dtReal);
    const pulse = 0.55 + 0.45 * Math.sin(now / (worst >= 1 ? 220 : 500));
    $('#danger').style.opacity = started ? String(Math.min(1, worst * pulse + game.alarmT * 0.3)) : '0';
  }
  if (game.carry) {
    const c = game.carry, l = c.lead;
    if (!(l.task?.job || l.goal?.job) || !l.canAct()) game.dropCarry();
    else { c.mesh.position.set(l.pos.x, l.def.h * 0.72, l.pos.z); c.mesh.rotation.y = l.obj.rotation.y; }
  }
  for (const [m, o] of game.opens) {
    const d = Math.min(...map.objCells(o).map(([x, y]) => Math.hypot(x + 0.5 - m.pos.x, y + 0.5 - m.pos.z)));
    if (d > 1.9 || !m.canAct()) game.opens.delete(m);
  }

  game.updateLights(0);
  updateLight();
  renderer.render(scene, camera);
  if (started) {
    ui.tagsUpdate(camera, renderer);
    uiAcc += dtReal;
    if (uiAcc > 0.2) { uiAcc = 0; ui.refresh(); }
  }
  requestAnimationFrame(frame);
}

// Story beats and objective checks.
function rules() {
  if (sim.tubL >= 100) game.objective('tub');
  if (sim.pressure() <= 0 && sim.tubL < 100) game.objective('tub', 'failed');
  if (!game.beat1 && sim.min >= 7 * 60 + 2) { game.beat1 = true; game.log('The tap pressure is dropping. Without power the city pumps can\'t keep the lines full.', 'warn'); }
  if (!game.beat2 && sim.min >= 10 * 60) { game.beat2 = true; game.log('Ten o\'clock and already over a hundred. A dog has been barking two houses down since dawn.'); }
  if (!game.beat3 && sim.min >= 13 * 60) { game.beat3 = true; game.log('No cars on the street. No planes overhead. Just the heat ticking in the roof.'); }
  if (!game.beat4 && sim.min >= 16 * 60 + 30) { game.beat4 = true; game.log('Peak heat. Anyone out in the sun right now is in real danger.', 'bad'); }
  if (!game.beatN && sim.min >= 20 * 60) {
    game.beatN = true;
    if (game.family.every((m) => !m.dead)) { game.objective('night'); game.log('Night. The sun is down, but the walls and the pavement give the heat back for hours.'); }
  }
}

// Clickable project markers stay below the cutaway wall height. Finished
// geometry lives in the scene so it remains visible when roofs are hidden.
function installBuildSites() {
  const meshes = new Map();
  function box(site, w, h, d, color, elevation = h / 2) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(site.x + 0.5, elevation, site.y + 0.5);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.obj = site;
    scene.add(mesh); world.pickables.push(mesh);
    return mesh;
  }
  for (const site of map.sites) {
    let mesh;
    if (site.kind === 'window') mesh = box(site, site.axis === 'west' ? 1.04 : 0.8, 0.65, site.axis === 'west' ? 0.8 : 1.04, 0x648391, 0.65);
    else if (site.kind === 'tarp') mesh = box(site, 0.14, 1.8, 0.14, 0x795d40);
    else if (site.kind === 'grill') mesh = box(site, 0.9, 0.8, 0.8, 0x343638);
    else if (site.kind === 'panel') mesh = box(site, 0.25, 0.9, 0.7, 0x6f7c83);
    else if (site.kind === 'walt') mesh = box(site, 0.8, 0.8, 0.16, 0x728061);
    else mesh = box(site, 0.65, 0.06, 0.65, 0x7495a0);
    meshes.set(site.key, mesh);
  }
  game.systems.visual = (kind, site) => {
    const mesh = meshes.get(site.key);
    if (kind === 'shade') mesh.material.color.setHex(0xdce4e7);
    if (kind === 'tarp') {
      const roof = box(site, 4, 0.08, 3, 0x426f95, 2.1);
      roof.position.x += 0.5;
      for (const [dx, dz] of [[-1.4, -1.4], [2.4, -1.4], [-1.4, 1.4], [2.4, 1.4]]) {
        const post = box(site, 0.1, 2.1, 0.1, 0x795d40);
        post.position.x += dx; post.position.z += dz;
      }
    }
    if (kind === 'solar') { mesh.material.color.setHex(0x5a9f75); box({ ...site, x: site.x - 1 }, 0.7, 0.6, 0.7, 0x3b454d); }
    if (kind === 'fan') { mesh.scale.y = 12; mesh.position.y = 0.6; mesh.material.color.setHex(0xc1d2ce); }
    if (kind === 'grill') mesh.material.color.setHex(0x8b5c3c);
  };
}

// ---------------------------------------------------------------- boot
{
  const fig = makeFigure();
  world = buildWorld(scene, map);
  const box = new THREE.Box3().setFromObject(fig.scene);
  const baseH = box.max.y - box.min.y;
  for (const def of FAMILY) game.family.push(new Member(def, fig, baseH, game));
  installBuildSites();
  game.nightEvents = new NightEvents(game);
  game.nightEvent = (id, watched) => game.nightEvents.trigger(id, watched);
  game.selected = [game.family[0]];
  placeCamera();
  updateLight();
  $('#loading').classList.add('hidden');
  $('#begin').disabled = false;
  $('#begin').textContent = 'Begin';
  requestAnimationFrame(frame);
}

$('#begin').addEventListener('click', () => {
  $('#intro').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  started = true;
  last = performance.now();
  game.log('Day 1. The power went out at 5:40 AM across the whole valley. The AC is silent.', 'warn');
  game.log('Water still comes out of the taps, for now. Fill the bathtub.', 'warn');
  ui.refresh();
});
$('#restart').addEventListener('click', () => location.reload());

window.__game = game; // test hook
void label;
