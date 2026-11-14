// The household: four people, their bodies, their bags, and what they're doing.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { findPath, nearbyWalkable } from './path.js';
import { makeEntry, invKg, entryKg, ITEMS, PER_L, isSpoiled } from './inventory.js';

// walk: meters per real second at 1x. Space is compressed: crossing the block costs game minutes.
// deficit: liters of body water already lost at the start (a hot night with the AC off at the end).
export const FAMILY = [
  { id: 'marcus', name: 'Marcus', age: 41, role: 'Dad', pr: ['he', 'him', 'his'], h: 1.8, mass: 84, color: 0x56677a, cap: 28, speed: 2.6,
    at: [24, 7], start: ['car_keys', 'phone_dead'], deficit: 0.6, needs: { food: 70, energy: 55, morale: 60 } },
  { id: 'elena', name: 'Elena', age: 38, role: 'Mom', pr: ['she', 'her', 'her'], h: 1.66, mass: 64, color: 0x8a5a4a, cap: 24, speed: 2.5,
    at: [25, 8], start: ['water_bottle', 'bp_meds'], deficit: 0.5, needs: { food: 68, energy: 58, morale: 62 } },
  { id: 'jess', name: 'Jess', age: 15, role: 'Daughter', pr: ['she', 'her', 'her'], h: 1.62, mass: 52, color: 0x5f7046, cap: 18, speed: 2.7,
    at: [29, 11], start: ['phone_dead'], deficit: 0.45, needs: { food: 62, energy: 50, morale: 45 } },
  { id: 'theo', name: 'Theo', age: 7, role: 'Son', pr: ['he', 'him', 'his'], h: 1.2, mass: 24, color: 0xb08a3a, cap: 8, speed: 2.0,
    at: [25, 14], start: ['stuffed_animal'], deficit: 0.2, needs: { food: 60, energy: 62, morale: 58 } },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const EXHAUSTION_F = 101.5, STROKE_F = 104.5, RECOVER_F = 102.5;

export class Member {
  constructor(def, gltf, baseH, game) {
    Object.assign(this, { id: def.id, name: def.name, age: def.age, role: def.role, cap: def.cap, walk: def.speed, mass: def.mass });
    this.def = def;
    const cap1 = (w) => w[0].toUpperCase() + w.slice(1);
    [this.he, this.him, this.his] = def.pr;
    this.He = cap1(this.he);
    this.His = cap1(this.his);
    this.game = game;
    this.child = def.age < 12;
    this.teen = def.age >= 13 && def.age < 18;
    this.needs = { hydration: 100, food: 70, energy: 60, health: 100, morale: 60, ...def.needs };
    this.deficit = def.deficit; // liters of body water lost
    this.bodyT = 98.6;
    this.felt = 80;
    this.worn = null;
    this.wetMin = 0;            // minutes of extra evaporative cooling from a soaked shirt/towel
    this.collapsed = false;
    this.draggedBy = null;
    this.inv = def.start.filter((id) => game.ITEMS[id]).map((id) => makeEntry(id));
    this.path = [];
    this.goal = null;
    this.task = null;
    this.asleep = false;
    this.watching = false;
    this.dead = false;
    this.flags = {};
    this.refusedAt = -1e9;
    // the kids are not yours to steer: they follow, wait, and look after themselves (badly)
    this.ai = this.child || this.teen;
    this.mode = this.child ? { type: 'follow', who: 'elena', routine: true } : this.teen ? { type: 'stay' } : null;
    this.thinkT = 0;
    this.autonomy = true;
    this.autoDrinkAt = -Infinity;
    this.freeAt = -Infinity;
    this.syncHydration();

    // body
    this.obj = new THREE.Group();
    const body = cloneSkinned(gltf.scene);
    body.scale.setScalar(def.h / baseH);
    const tint = new THREE.Color(def.color);
    body.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      m.material = m.material.clone();
      if (/Skin/i.test(m.material.name)) { if (def.skin) m.material.color.set(def.skin); return; }
      const joints = /Joints/i.test(m.material.name);
      m.material.color = joints ? tint.clone().multiplyScalar(0.45) : tint.clone();
      if (m.material.metalness !== undefined) { m.material.metalness = 0.1; m.material.roughness = 0.85; }
    });
    this.obj.add(body);
    this.body = body;
    this.mixer = new THREE.AnimationMixer(body);
    this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.cur = null;
    this.play('idle');

    // invisible click target
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, def.h, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = def.h / 2;
    this.hit.userData.member = this;
    this.obj.add(this.hit);

    this.obj.position.set(def.at[0] + 0.5, 0, def.at[1] + 0.5);
    this.yaw = Math.PI;
    game.scene.add(this.obj);
  }

  get pos() { return this.obj.position; }
  cell() { return [Math.floor(this.pos.x), Math.floor(this.pos.z)]; }
  equipmentKg() {
    const held = (this.game.lights || []).filter((l) => l.owner === this && l.entry !== this.worn);
    return (this.worn ? entryKg(this.worn) : 0) + held.reduce((s, l) => s + entryKg(l.entry), 0);
  }
  kg() { return invKg(this.inv) + this.equipmentKg(); }
  get pct() { return (this.deficit / this.mass) * 100; } // % body mass lost as water
  canAct() { return !this.dead && !this.collapsed && !this.draggedBy; }
  syncHydration() { this.needs.hydration = clamp(100 - (this.pct / 8) * 100); }

  // Liters (positive) drunk or lost (negative). Returns liters actually useful.
  drink(l) {
    const before = this.deficit;
    this.deficit = Math.max(0, Math.min(this.mass * 0.12, this.deficit - l));
    this.syncHydration();
    return before - this.deficit;
  }

  // Fluid loss in L/h (Codex review 1 seed curve), scaled by body size.
  lossRate(felt, act = 1) {
    const size = Math.pow(this.mass / 80, 0.67);
    return (0.08 + 0.0022 * Math.pow(Math.max(0, felt - 85), 1.5)) * act * size * (this.child ? 0.9 : 1);
  }

  play(name, fade = 0.25) {
    const a = this.actions[name];
    if (!a || this.cur === a) return;
    a.reset().fadeIn(fade).play();
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a;
  }

  isWatching() {
    const map = this.game.map;
    return this.watching && !this.ai && this.canAct() && !this.asleep && !this.task && !this.goal
      && !this.path.length && map.houseOf(...this.cell()) === map.lots.indexOf(map.home);
  }

  keepWatch() {
    if (this.ai || !this.canAct() || this.watching || this.goal?.type === 'watch') return false;
    const map = this.game.map, home = map.lots.indexOf(map.home), cells = [];
    for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
      if (map.walkable(x, y) && map.isIndoor(x, y) && map.houseOf(x, y) === home) cells.push([x, y]);
    }
    return this.approach(cells, { type: 'watch' }, 'home to keep watch');
  }

  urgentNeed() { return this.needs.hydration < 60 || this.needs.food < 25 || this.needs.energy < 15; }
  orderFinished(work) {
    if (work && !work.autonomous) this.freeAt = this.game.sim.min + 45;
  }
  get waitingForAutonomy() { return this.game.sim.min < this.freeAt && !this.urgentNeed(); }

  // Reserve current cells and destinations, including people still walking there.
  occupiedCells() {
    const map = this.game.map, occupied = new Set();
    for (const m of this.game.family) if (m !== this && !m.away && !m.dead) {
      occupied.add(map.idx(...m.cell()));
      if (m.path.length) occupied.add(map.idx(...m.path.at(-1)));
    }
    return occupied;
  }

  stopTask(quiet = false) {
    this.orderFinished(this.task || this.goal);
    if (this.task?.type === 'carAC') {
      const car = this.game.systems.car;
      const cell = this.game.map.useCells(car)[0];
      if (cell) this.pos.set(cell[0] + 0.5, 0, cell[1] + 0.5);
    }
    if (this.watching) {
      this.watching = false;
      this.game.log(`${this.name} ends the watch.`);
    }
    if (this.asleep) this.wake(quiet);
    if (this.task?.type === 'drag' && this.task.victim) this.task.victim.draggedBy = null;
    this.task = null;
    this.goal = null;
    this.path = [];
    this.stall = null;
    this.walkOrder = false;
  }

  moveTo(x, y, goal = null) {
    if (this.task?.type === 'carAC') this.stopTask(true);
    if (!this.canAct() || this.away) return false;
    const [cx, cy] = this.cell();
    const occupied = this.occupiedCells();
    if (occupied.has(this.game.map.idx(x, y))) {
      const spot = nearbyWalkable(this.game.map, x, y, 1, occupied)[0];
      if (!spot) return false;
      [x, y] = spot;
    }
    const p = findPath(this.game.map, cx, cy, x, y);
    if (!p) return false;
    this.stopTask(true);
    this.path = p;
    this.autonomousLocation = false;
    this.goal = goal;
    if (!goal) this.walkOrder = true;
    if (!p.length && !goal) { this.freeAt = this.game.sim.min + 45; this.walkOrder = false; }
    if (!p.length && goal) this.startTask();
    return true;
  }

  walkTo(x, y) {
    const [cx, cy] = this.cell();
    const p = findPath(this.game.map, cx, cy, x, y);
    if (p) this.path = p;
    return !!p;
  }
  // People assisting this one who are close enough to actually help.
  helpers(r = 2.4) {
    return this.game.family.filter((m) => m !== this && m.canAct() && m.task?.type === 'assist' && m.task.lead === this && m.pos.distanceTo(this.pos) <= r);
  }
  helpRate() { return 1 + 0.7 * this.helpers().length; }

  // Commands a parent gives a kid (or the other parent).
  order(type, from) {
    const g = this.game;
    if (!this.canAct() || this.away) return;
    if (type === 'watch') { this.keepWatch(); return; }
    if (this.flags.wandered) {
      g.log(`A parent needs to come and fetch ${this.name}.`, 'warn');
      return;
    }
    if (type === 'stay' && this.child && this.needs.morale < 30) {
      g.log(`Theo: "No! Don't leave me!" He grabs ${from.name}'s shirt and won't let go.`, 'warn');
      this.mode = { type: 'follow', who: from.id };
      return;
    }
    if (!this.willObey()) return;
    this.stopTask(true);
    if (type === 'follow') { this.freeAt = -Infinity; this.mode = { type: 'follow', who: from.id }; g.log(`${this.name} sticks close to ${from.name}.`); }
    else if (type === 'stay') { this.freeAt = g.sim.min + 45; this.mode = { type: 'stay' }; g.log(`${this.name} stays put.`); }
    else if (type === 'help') { this.task = { type: 'assist', lead: from, t: 0, dur: Infinity }; g.log(`${this.name} goes to help ${from.name}.`); }
    else if (type === 'drink') this.useObject(g.map.tub, 'drinkTub');
    else if (type === 'rest') {
      const bed = g.freeBed(this);
      if (bed) this.useObject(bed, 'sleep'); else { this.goal = { type: 'sleep', obj: null }; this.startTask(); }
    }
  }

  // Kids' own little brain, a couple of times a game minute.
  think(dtMin) {
    if (!this.ai || !this.canAct() || !this.autonomy || this.waitingForAutonomy) return;
    if (this.mode?.routine) return;
    this.thinkT -= dtMin;
    if (this.thinkT > 0) return;
    this.thinkT = 0.5;
    const g = this.game, sim = g.sim, map = g.map;
    if (this.flags.wandered) return; // Wait in the yard until a parent fetches him.
    const busy = this.task && this.task.type !== 'assist';
    if (busy || this.goal) return;
    const atHome = map.houseOf(...this.cell()) === map.lots.indexOf(map.home);
    const idle = !this.task && !this.path.length;
    if (idle && this.needs.energy < 12) {
      g.log(this.child ? 'Theo curls up on the floor and falls asleep where he is.' : 'Jess drops onto the floor, done for. She\'s asleep in a minute.');
      this.goal = { type: 'sleep', obj: null }; this.startTask(); return;
    }
    if (idle && this.teen && this.pct > 2 && atHome && sim.tubL >= 1 && this.mode.type === 'stay') {
      g.log('Jess gets herself a drink from the tub without asking.');
      this.useObject(map.tub, 'drinkTub'); return;
    }
    if (this.child && this.flags.alone && this.needs.morale < 35 && this.mode.type === 'stay') {
      const p = g.family.filter((m) => !m.ai && !m.dead).sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos))[0];
      if (p) { this.mode = { type: 'follow', who: p.id }; g.log(`Theo can't stand being alone any more. He goes looking for ${p.name}.`, 'warn'); }
    }
    if (this.task?.type === 'assist') { this.stayNear(this.task.lead, 1.6); return; }
    if (this.mode.type === 'follow') {
      const p = g.family.find((m) => m.id === this.mode.who);
      if (!p || p.dead || p.away) { this.mode = { type: 'stay' }; return; }
      this.stayNear(p, 2.4);
    }
  }

  // Household care has its own task type: it cannot call beat/system completion.
  setAutonomy(enabled) {
    this.autonomy = enabled;
    if (!enabled && (this.task?.autonomous || this.goal?.autonomous)) this.stopTask(true);
  }

  liveOwnLife(dtMin) {
    const g = this.game, sim = g.sim, map = g.map;
    if (!this.autonomy || !this.canAct() || this.away || this.flags.wandered || this.watching) return;
    // Preserve children's explicit following/helping and their existing little brain.
    if (this.ai && (this.mode?.type === 'follow' && !this.mode.routine || this.task?.type === 'assist')) return;
    // Once seated for work, Marcus returns between household tasks without another order.
    const deskHours = sim.phase === 'prologue' && g.beats?.deskStarted && this.id === 'marcus'
      && (sim.hour >= 8.5 && sim.hour < 12 || sim.day === 0 && sim.hour >= 13 && sim.hour < 17);
    const deskWork = this.task || this.goal;
    if (deskWork?.deskRoutine && !deskHours) this.stopTask(true);
    if (deskHours && (!deskWork || deskWork.autonomous) && !this.path.length
      && this.needs.hydration >= 60 && this.needs.food >= 25 && this.needs.energy >= 15) {
      if (!deskWork?.deskRoutine) {
        this.stopTask(true);
        this.useObject(g.beats.targets.desk, 'routine', { autonomous: true, deskRoutine: true,
          label: 'working at the desk', duration: (sim.hour < 12 ? 720 : 1020) - sim.hour * 60 });
      }
      return;
    }
    if (this.waitingForAutonomy) return;
    const work = this.task || this.goal;
    if (work && !work.autonomous || !work && this.path.length) return;
    const home = map.lots.indexOf(map.home);
    if (map.lotAt[map.idx(...this.cell())] !== home) return;
    this.lifeT = (this.lifeT || 0) - dtMin;
    if (this.lifeT > 0) return;
    this.lifeT = 1;
    const thirsty = this.needs.hydration < 85 && sim.min - this.autoDrinkAt >= 20;
    if (work && !(work.type === 'routine' && (thirsty || this.needs.food < 35 || this.needs.energy < 20))) return;
    if (work) this.stopTask(true);
    const stock = [{ inv: this.inv, obj: null }, ...map.objects.filter((o) => o.home && o.searched && map.isIndoor(o.x, o.y)).map((o) => ({ inv: o.items, obj: o }))];
    const find = (predicate) => {
      for (const source of stock) {
        const entry = source.inv.find((e) => e.n > 0 && !isSpoiled(e, sim) && predicate(e, ITEMS[e.id]));
        if (entry) return { ...source, entry };
      }
    };
    const start = (obj, extra) => {
      const goal = { type: 'routine', autonomous: true, duration: 15, ...extra };
      if (obj) return this.useObject(obj, 'routine', goal);
      this.goal = goal; this.startTask(); return true;
    };
    if (thirsty) {
      const source = find((e, it) => it.cat === 'water' && (e.left !== undefined ? PER_L[e.id]?.hydration >= 35 && e.left >= .05 : it.use?.hydration >= 8));
      if (source) { start(source.obj, { care: 'drink', source, label: 'getting a drink', duration: 2 }); return; }
      if (sim.pressure() > .05) { start(map.objects.find((o) => o.home && o.ch === 'Z'), { care: 'tap', label: 'getting a drink', duration: 2 }); return; }
      if (sim.tubL > .05) { start(map.tub, { care: 'tub', label: 'getting a drink', duration: 2 }); return; }
    }
    const dinner = sim.hour >= 18 && sim.hour < 20;
    if (this.needs.food < (dinner ? 65 : 35)) {
      const source = find((e, it) => it.cat === 'food' && it.use?.food > 0 && !(it.tags || []).some((t) => ['needsCooking', 'needsOpener', 'needsWater'].includes(t)));
      if (source) { start(source.obj, { care: 'eat', source, label: dinner ? 'having dinner' : 'having a snack', duration: 5 }); return; }
    }
    if (this.needs.energy < 25 || (sim.hour >= (this.child ? 20 : 22) || sim.hour < 6) && this.needs.energy < 95) {
      const bed = g.freeBed(this);
      if (bed) { this.useObject(bed, 'sleep', { autonomous: true }); return; }
      start(null, { label: 'resting', care: 'rest', duration: 30 }); return;
    }
    if (this.bodyT >= 100.5) {
      start(map.objects.find((o) => o.home && o.ch === 'L'), { label: 'cooling off in the living room', care: 'rest', duration: 20 }); return;
    }
    const spots = map.routineSpots ||= (() => {
      const prop = (key, name, x, y) => ({ key, name, x, y, w: 1, h: 1, home: true });
      const bed = (x, y) => map.objects.find((o) => o.home && o.ch === 'R' && o.x === x && o.y === y);
      return { table: prop('routine-table', 'Kitchen table', 30, 11),
        laundry: prop('routine-laundry', 'Laundry', 36, 11),
        couch: map.objects.find((o) => o.home && o.ch === 'L'),
        patio: prop('routine-patio', 'Patio', 32, 4),
        living: prop('routine-living', 'Living room play spot', 31, 13),
        // Jess's bed is boxed by furniture; stand in her bedroom's free aisle.
        jess: Object.assign(bed(23, 13), { routineCells: [[25, 13], [25, 14]] }), theo: bed(24, 14) };
    })();
    const options = this.id === 'elena'
      ? [[spots.table, sim.power ? 'working on her laptop' : 'sitting at the table'], [spots.laundry, 'folding laundry'], [spots.couch, 'relaxing on the couch']]
      : this.teen ? [[spots.jess, sim.power ? 'on her phone' : 'spending time in her room'], [spots.couch, 'relaxing on the couch']]
      : this.child ? [[spots.living, 'playing in the living room'], [spots.theo, 'playing in his room']]
      : [[spots.couch, 'reading on the couch'], ...(sim.hour >= 18 && sim.hour < 21 ? [[spots.patio, 'sitting on the patio']] : [])];
    // Rotate through personal spots; shared furniture can have only one routine owner.
    const turn = this.routineTurn || 0;
    this.routineTurn = turn + 1;
    const duration = g.rng.int(30, 60);
    const occupied = this.occupiedCells();
    if (this.child && this.mode?.routine) {
      const parent = g.family.find((m) => m.id === 'elena');
      const [x, y] = parent?.cell() || [];
      if (parent && !parent.away && map.isIndoor(x, y) && x >= 27 && x <= 33 && y >= 6 && y <= 14) {
        const cells = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => map.walkable(a, b) && !occupied.has(map.idx(a, b)));
        if (this.approach(cells, { type: 'routine', autonomous: true, label: 'playing near Elena', duration }, 'Elena')) return;
      }
    }
    for (let i = 0; i < options.length; i++) {
      const [obj, label] = options[(turn + i) % options.length];
      if (!obj || g.family.some((m) => m !== this && (m.task || m.goal)?.obj === obj)) continue;
      if (start(obj, { label, duration, outdoors: obj === spots.patio })) return;
    }
  }

  finishRoutine(t) {
    const sim = this.game.sim;
    const sip = Math.min(.35, this.deficit);
    if (['tap', 'tub', 'drink'].includes(t.care)) {
      // Recheck at completion: overlapping routines never overdraw shared stock.
      if (this.needs.hydration >= 85 || sim.min - this.autoDrinkAt < 20) return;
      let liters = 0;
      if (t.care === 'tap' && sim.pressure() > .05) liters = sip;
      if (t.care === 'tub') { liters = Math.min(sip, sim.tubL); sim.tubL -= liters; }
      if (t.care === 'drink') {
        const { inv, entry } = t.source, it = ITEMS[entry.id];
        if (!inv.includes(entry) || isSpoiled(entry, sim)) return;
        if (entry.left !== undefined) { liters = Math.min(sip, entry.left); entry.left -= liters; }
        else if (entry.n > 0) { liters = Math.min(this.deficit, it.use.hydration / 35); entry.n--; }
        if (entry.n <= 0) inv.splice(inv.indexOf(entry), 1);
      }
      if (liters > 0) { this.drink(liters); this.autoDrinkAt = sim.min; this.game.log(`${this.name} gets a drink (${liters.toFixed(2)} L, on ${this.his} own).`); }
    } else if (t.care === 'eat') {
      const { inv, entry } = t.source;
      if (!inv.includes(entry) || entry.n <= 0 || isSpoiled(entry, sim)) return;
      this.needs.food = clamp(this.needs.food + ITEMS[entry.id].use.food);
      if (--entry.n <= 0) inv.splice(inv.indexOf(entry), 1);
    } else if (t.care === 'rest') this.needs.energy = clamp(this.needs.energy + 5);
  }

  stayNear(p, r) {
    if (p.dead) { this.task = null; return; }
    if (this.cell().join() !== p.cell().join() && this.pos.distanceTo(p.pos) <= r) { this.path = []; return; }
    const [px, py] = p.cell();
    const spot = nearbyWalkable(this.game.map, px, py, 1, this.occupiedCells())[0];
    if (spot) this.walkTo(spot[0], spot[1]);
  }

  // Walk to the closest standing spot among `cells`, then start goal.
  approach(cells, goal, what) {
    if (this.task?.type === 'carAC') this.stopTask(true);
    if (!this.canAct() || this.away) return false;
    const map = this.game.map;
    if (goal.autonomous && goal.obj && this.game.family.some((m) => m !== this && (m.task || m.goal)?.obj === goal.obj)) return false;
    const [cx, cy] = this.cell();
    let best = null;
    const occupied = this.occupiedCells();
    for (const [x, y] of cells) {
      if (occupied.has(map.idx(x, y))) continue;
      if (x === cx && y === cy) { best = { p: [] }; break; }
      const p = findPath(map, cx, cy, x, y);
      if (p && (!goal.autonomous || goal.returningHome || p.every(([a, b]) => (goal.outdoors || !map.isIndoor(cx, cy) || map.isIndoor(a, b)) && map.lotAt[map.idx(a, b)] === map.lots.indexOf(map.home))) && (!best || p.length < best.p.length)) best = { p };
    }
    if (!best) { if (!goal.autonomous) this.game.log(`${this.name} can't get to ${what}.`, 'warn'); return false; }
    this.stopTask(true);
    this.path = best.p;
    this.autonomousLocation = !!goal.autonomous;
    this.goal = goal;
    if (!best.p.length) this.startTask();
    return true;
  }

  useObject(obj, type, extra = {}) {
    return this.approach(type === 'routine' && obj.routineCells || this.game.map.useCells(obj), { type, obj, ...extra }, `the ${obj.name.toLowerCase()}`);
  }

  // Go to another person and do something to them (douse, drag).
  tend(victim, type, extra = {}) {
    const [vx, vy] = victim.cell();
    const map = this.game.map;
    const cells = [[vx, vy], [vx + 1, vy], [vx - 1, vy], [vx, vy + 1], [vx, vy - 1]].filter(([x, y]) => map.walkable(x, y));
    return this.approach(cells, { type, victim, ...extra }, victim.name);
  }

  startTask() {
    const g = this.goal;
    this.goal = null;
    if (!g || !this.canAct()) return;
    if (g.type === 'watch') {
      this.watching = true;
      this.game.log(`${this.name} keeps watch at home.`);
      return;
    }
    const o = g.obj;
    if (g.autonomous && this.occupiedCells().has(this.game.map.idx(...this.cell()))) { this.lifeT = 0; return; }
    if (o) this.faceTo(o.x + o.w / 2, o.y + o.h / 2);
    if (g.victim) this.faceTo(g.victim.pos.x, g.victim.pos.z);
    const slow = (this.child ? 1.5 : 1) * (this.bodyT >= EXHAUSTION_F ? 1.4 : 1);
    const dur = {
      search: (o?.home ? 4 : o?.car ? 6 : 8) * slow,
      open: 0.3, drinkTap: 3, drinkTub: 2, fillCont: 4, soak: 5, douse: 3, fillTub: Infinity, sleep: Infinity, drag: Infinity,
      routine: g.duration ?? 15, sit: Infinity, leisure: 2, job: g.job?.dur ?? 15, system: g.duration ?? 3, prologue: g.duration ?? 1,
    }[g.type] ?? 1;
    if (g.type === 'fillTub') {
      const other = this.game.family.find((m) => m !== this && m.task?.type === 'fillTub');
      if (other) { this.game.log(`${other.name} is already running the tap.`); return; }
      this.game.log(`${this.name} plugs the drain and opens the tap.`);
    }
    if (g.type === 'drag') {
      const v = g.victim;
      if (v.dead || !v.collapsed) return;
      const crewMass = this.mass + this.helpers(2.6).reduce((s, m) => s + m.mass, 0);
      const coming = this.game.family.some((m) => m.task?.type === 'assist' && m.task.lead === this && m.canAct());
      if (crewMass < v.mass * 0.55 && coming) {
        this.task = { type: 'waitHelp', victim: v, t: 0, dur: Infinity };
        this.game.log(`${this.name} can't lift ${v.name} alone and waits for help.`);
        return;
      }
      if (crewMass < v.mass * 0.55) { this.game.log(`${this.name} pulls at ${v.name}'s arm but can't move ${v.him}.`, 'warn'); return; }
      const dest = this.game.nearestShade(this.cell());
      if (!dest) { this.game.log(`Nowhere out of the sun to drag ${v.him}.`, 'warn'); return; }
      const [cx, cy] = this.cell();
      const p = findPath(this.game.map, cx, cy, dest[0], dest[1]);
      if (!p) return;
      v.draggedBy = this;
      this.path = p;
      this.task = { ...g, t: 0, dur, dest };
      if (!p.length) { this.finishDrag(); return; }
      const hs = this.helpers(2.6);
      this.game.log(hs.length ? `${this.name} and ${hs.map((m) => m.name).join(' and ')} lift ${v.name} and carry ${v.him} toward the shade.`
        : `${this.name} gets ${v.name} under the arms and drags ${v.him} toward the shade.`, 'warn');
      return;
    }
    this.task = { ...g, t: 0, dur };
    if (g.type === 'sleep') this.lieDown(o);
  }

  faceTo(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  layFlat(y) {
    this.body.rotation.x = -Math.PI / 2;
    this.body.position.y = 0.15;
    this.pos.y = y;
  }
  standUp() {
    this.body.rotation.x = 0;
    this.body.position.y = 0;
    this.pos.y = 0;
  }

  lieDown(bed) {
    if (this.watching) { this.watching = false; this.game.log(`${this.name} ends the watch.`); }
    this.asleep = true;
    this.restAt = this.pos.clone();
    this.bed = bed || null;
    if (bed) this.lastBed = bed;
    if (bed) this.pos.set(bed.x + 0.5, 0, bed.y + 0.5);
    this.layFlat(bed ? 0.55 : 0.05);
    this.play('idle');
  }

  wake(quiet) {
    if (!this.asleep) return;
    this.asleep = false;
    if (this.restAt) this.pos.copy(this.restAt);
    this.bed = null;
    this.standUp();
    if (!quiet) this.game.log(`${this.name} is awake.`);
    this.game.nightEvents?.flush();
  }

  collapse() {
    this.stopTask(true);
    this.collapsed = true;
    this.layFlat(0.05);
    this.mixer.stopAllAction();
    this.cur = null;
    this.game.log(`${this.name} collapses. Heat stroke: hot dry skin, eyes rolling. ${this.He} can't get up. Get ${this.him} out of the heat and cool ${this.him} down with water. Now.`, 'dead');
    this.game.alarm();
  }
  revive() {
    this.collapsed = false;
    if (this.draggedBy) { this.draggedBy.stopTask(true); this.draggedBy = null; }
    this.standUp();
    this.play('idle');
    this.game.log(`${this.name} comes around, shaking and nauseous. ${this.He} needs water and rest.`, 'warn');
  }

  die(cause) {
    if (this.dead) return;
    this.diedAt = { day: this.game.sim.day, min: this.game.sim.min };
    this.reservedBed = this.bed || this.lastBed;
    this.dead = true;
    this.stopTask(true);
    if (this.draggedBy) { this.draggedBy.stopTask(true); this.draggedBy = null; }
    this.layFlat(0.05);
    this.mixer.stopAllAction();
    this.body.traverse((m) => { if (m.isMesh) m.material.color.multiplyScalar(0.45); });
    this.game.log(`${this.name} is dead. ${cause}`, 'dead');
    this.obj.visible = false;
    this.game.selected = this.game.selected.filter((m) => m !== this);
    if (this.game.detailMember === this) this.game.detailMember = null;
    if (this.game.pickedMember === this) this.game.pickedMember = null;
    this.game.onDeath(this);
  }

  // ---- per frame ----
  update(dtMin, dtReal) {
    if (this.dead || this.away) return;
    const sim = this.game.sim;
    this.mixer.update(dtReal * Math.min(sim.speed, 2.5) * (this.walkAnimRate || 1));

    if (this.draggedBy) {
      const d = this.draggedBy;
      const back = new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)).multiplyScalar(0.7);
      this.pos.set(d.pos.x + back.x, 0.05, d.pos.z + back.z);
      this.obj.rotation.y = d.obj.rotation.y + Math.PI;
    } else if (this.path.length && sim.speed > 0 && this.canAct()) {
      const sick = this.bodyT >= EXHAUSTION_F ? 0.7 : 1;
      const dragging = this.task?.type === 'drag' ? (this.helpers(2.6).length ? 0.85 : 0.45) : 1;
      const hauling = this.game.carry?.lead === this ? 0.7 : 1;
      let dist = this.walk * sick * dragging * hauling * (this.game.isDark(this) ? 0.8 : 1) * dtReal * sim.speed;
      while (dist > 0 && this.path.length) {
        const [nx, ny] = this.path[0];
        const tx = nx + 0.5, tz = ny + 0.5;
        const dx = tx - this.pos.x, dz = tz - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-3) { this.path.shift(); continue; }
        this.yaw = Math.atan2(dx, dz);
        const step = Math.min(d, dist);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        dist -= step;
        if (step >= d - 1e-4) this.path.shift();
      }
      const fast = this.walk * sick * dragging * sim.speed;
      this.walkAnimRate = Math.min(1.8, (this.walk * sick * dragging) / 1.5);
      this.play(fast > 6 ? 'run' : 'walk');
      if (!this.path.length) {
        if (this.task?.type === 'drag') this.finishDrag();
        else if (this.goal) this.startTask();
        else if (this.walkOrder) { this.freeAt = sim.min + 45; this.walkOrder = false; }
      }
    } else if (!this.asleep && !this.collapsed) {
      this.walkAnimRate = 1;
      this.play('idle');
    }
    if (!this.asleep && !this.collapsed && !this.draggedBy) {
      let dy = this.yaw - this.obj.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.obj.rotation.y += dy * Math.min(1, dtReal * 10);
    }

    if (dtMin <= 0) return;
    if (this.ai) this.think(dtMin);
    else if (this.task?.type === 'assist' && this.canAct()) { this.assistT = (this.assistT || 0) - dtMin; if (this.assistT <= 0) { this.assistT = 0.5; this.stayNear(this.task.lead, 1.6); } }
    if (this.task?.type === 'assist' && (!this.task.lead.task && !this.task.lead.goal || this.task.lead.dead)) { this.orderFinished(this.task); this.task = null; }
    this.liveOwnLife(dtMin);
    this.updateTask(dtMin);
    this.updateBody(dtMin);
    this.guardProgress(dtMin);
  }

  // Progress means movement or useful work, not just a timer ticking while blocked.
  // Quietly release stale orders, including unreachable goals and interrupted helper jobs.
  guardProgress(dtMin) {
    const work = this.task || this.goal;
    if (!work || this.away || this.asleep || this.collapsed || ['carAC', 'sit'].includes(work.type)) { this.stall = null; return; }
    const progress = [this.pos.x, this.pos.z, this.task?.type === 'assist' ? this.task.lead.task?.t || 0 : this.task?.t || 0, this.task?.type === 'fillTub' ? this.game.sim.tubL : 0];
    const prev = this.stall;
    const changed = !prev || prev.work !== work || progress.some((v, i) => Math.abs(v - prev.progress[i]) > 0.001);
    this.stall = { work, progress, minutes: changed ? 0 : prev.minutes + dtMin };
    if (this.stall.minutes >= 30) {
      this.stopTask(true);
      if (this.ai) this.mode = { type: 'stay' };
    }
  }

  finishDrag() {
    this.orderFinished(this.task);
    const v = this.task.victim;
    const dest = this.task.dest;
    this.task = null;
    if (v) {
      v.draggedBy = null;
      const [x, y] = dest || this.cell();
      v.pos.set(x + 0.5, 0.05, y + 0.5);
      const spot = nearbyWalkable(this.game.map, x, y, 2).find(([a, b]) => a !== x || b !== y);
      if (spot) { this.pos.set(spot[0] + 0.5, 0, spot[1] + 0.5); }
    }
    this.game.log(`${this.name} gets ${v?.name} into the shade.`);
  }

  updateTask(dtMin) {
    const t = this.task;
    if (!t || t.type === 'drag' || t.type === 'carAC') return;
    const g = this.game, sim = g.sim;
    if (t.type === 'assist') return;
    if (t.type === 'system' && !g.systems.poweredTask(this, t.action)) { t.waitingPower = true; return; }
    t.waitingPower = false;
    if (t.type === 'waitHelp') {
      const v = t.victim;
      const crew = this.mass + this.helpers(2.6).reduce((s, m) => s + m.mass, 0);
      if (v.dead || !v.collapsed) { this.task = null; return; }
      if (crew >= v.mass * 0.55) { this.task = null; this.goal = { type: 'drag', victim: v }; this.startTask(); }
      return;
    }
    if (t.type === 'job') {
      const crew = t.job.crew.filter((m) => !m.dead && m !== this);
      const onIt = (m) => m.canAct() && m.task?.type === 'assist' && m.task.lead === this;
      t.missing = crew.filter((m) => !onIt(m) || m.pos.distanceTo(this.pos) >= 4.5);
      t.waiting = t.missing.length > 0;
      // someone walked off, refused, or was sent elsewhere: say so once instead of standing there silently
      const gone = crew.filter((m) => !onIt(m));
      if (gone.length) {
        t.goneT = (t.goneT || 0) + dtMin;
        if (t.goneT >= 1 && !t.warned) {
          t.warned = true;
          g.log(`${this.name} can't do this short-handed and waits for ${gone.map((m) => m.name).join(' and ')}. Click ${gone.length > 1 ? 'them' : gone[0].him} and ask for help.`, 'warn');
        }
      } else { t.goneT = 0; t.warned = false; }
      if (!t.waiting) t.t += dtMin;
      if (t.t >= t.dur) { this.task = null; g.jobDone(this, t.job); if (!this.task && !this.goal) this.orderFinished(t); }
      return;
    }
    if (t.type === 'prologue' && t.beatType === 'together' && !['marcus', 'elena'].every((id) => {
      const other = g.family.find((m) => m.id === id);
      return other?.canAct() && !other.away && other.pos.distanceTo(this.pos) < 3
        && (other.task?.target === t.target || g.beats.arrivals.has(id));
    })) return;
    t.t += dtMin * (['search', 'fillCont'].includes(t.type) ? this.helpRate() : 1) * (t.type === 'search' && g.isDark(this) ? 0.5 : 1);
    if (t.type === 'fillTub') {
      const p = sim.pressure();
      if (p <= 0.001) {
        g.log(`The tap coughs air and stops. The water's gone. The tub holds ${Math.round(sim.tubL)} liters.`, 'warn');
        this.task = null; this.orderFinished(t); return;
      }
      sim.tubL = Math.min(sim.TUB_MAX, sim.tubL + 2.5 * p * dtMin);
      if (sim.tubL >= sim.TUB_MAX) { g.log(`The tub is full: ${sim.TUB_MAX} liters.`, 'good'); this.task = null; this.orderFinished(t); }
      return;
    }
    if (t.type === 'sleep') {
      if (this.needs.energy >= 98) { this.task = null; this.wake(); this.orderFinished(t); }
      return;
    }
    if (t.t < t.dur) return;
    this.orderFinished(t);
    this.task = null;
    const o = t.obj;
    switch (t.type) {
      case 'routine': this.finishRoutine(t); break;
      case 'prologue': g.beats.notify(t.beatType, this.id, t.target); break;
      case 'system': g.systems.complete(t.action, this, t.data); break;
      case 'openCan': {
        const i = this.inv.indexOf(t.entry);
        if (i >= 0) g.useItem(this, i, t.target, true);
        break;
      }
      case 'search': g.searchDone(this, o); break;
      case 'open': g.openContainer(this, o); break;
      case 'drinkTap':
        if (sim.pressure() > 0.05) { const l = this.drink(this.deficit); g.log(`${this.name} drinks ${l.toFixed(1)} L from the tap until the water runs warm.`); }
        else g.log('The tap gurgles. Nothing comes out.', 'warn');
        break;
      case 'drinkTub': {
        const max = this.child ? 0.5 : 1.2;
        const l = Math.min(max, sim.tubL, Math.max(0.25, this.deficit));
        if (l < 0.05) { g.log('The tub is dry.', 'warn'); break; }
        sim.tubL -= l;
        this.drink(l);
        g.log(`${this.name} drinks ${l.toFixed(1)} L from the tub. ${Math.round(sim.tubL)} L left.`);
        break;
      }
      case 'soak': {
        const l = Math.min(2, sim.tubL);
        if (l < 0.5) { g.log('Not enough water left to waste on a towel.', 'warn'); break; }
        sim.tubL -= l;
        const cloth = ITEMS[this.worn?.id]?.wear;
        this.wetMin = cloth?.wetMinutes || 60;
        this.bodyT = Math.max(98.6, this.bodyT - 0.5);
        g.log(`${this.name} soaks ${cloth?.wetMinutes ? 'the ' + ITEMS[this.worn.id].name.toLowerCase() : 'a shirt'} in the tub (${l.toFixed(0)} L). Cooling for ${this.wetMin} minutes.`);
        break;
      }
      case 'fetch': {
        const v = t.victim;
        if (this.ai || !v?.canAct() || !g.near(this, v)) break;
        v.flags.wandered = false;
        v.order('follow', this);
        g.log(`${this.name} finds ${v.name} in the yard and brings him along.`);
        break;
      }
      case 'douse': g.douse(this, t.victim); break;
      case 'fillCont': g.fillContainers(this); break;
    }
  }

  // Finish an outdoor errand by walking home, without the normal order cooldown.
  returnToRoutine() {
    const cells = this.teen ? [[25, 13], [25, 14]] : this.child ? [[31, 13], [30, 13]] : [[30, 12], [29, 12]];
    return this.approach(cells, { type: 'routine', autonomous: true, returningHome: true,
      label: 'returning inside', duration: 0 }, 'home');
  }

  updateBody(dtMin) {
    const g = this.game, sim = g.sim, map = g.map, n = this.needs;
    if (sim.phase === 'prologue') {
      this.felt = map.isIndoor(...this.cell()) ? 78 : sim.outdoor();
      this.bodyT = 98.6; this.deficit = Math.min(0.6, this.deficit); this.syncHydration();
      n.health = 100;
      for (const key of ['food', 'energy', 'morale']) n[key] = Math.max(60, n[key] - dtMin / 1200);
      return;
    }
    const h = dtMin / 60;
    const [cx, cy] = this.cell();
    const indoor = map.isIndoor(cx, cy);
    this.indoor = indoor;
    const sunReduction = ITEMS[this.worn?.id]?.wear?.sunReduction || 0;
    const tarpReduction = g.systems?.yardShade(cx, cy) ? 0.75 : 0;
    this.felt = indoor ? sim.indoor + g.candleHeat(this) + (map.isGarage(cx, cy) ? 5 : 0) - (this.bed?.together ? 2 : 0) : sim.outdoor() + 14 * sim.sun() * (1 - Math.max(sunReduction, tarpReduction));
    if (indoor) this.felt -= g.systems?.fanCooling(this) || 0;
    if (g.systems?.carCooling(this)) this.felt = 78;
    const working = this.task && !this.asleep && this.task.type !== 'carAC';
    const act = this.collapsed || this.draggedBy ? 0.8 : this.asleep ? 0.6
      : this.path.length ? (this.task?.type === 'drag' ? 2.2 : 1.4) : working ? 1.2 : 1;

    // ---- water
    this.deficit = Math.min(this.mass * 0.12, this.deficit + this.lossRate(this.felt, act) * h);
    this.syncHydration();
    const pct = this.pct;

    // ---- heat balance in watts: metabolism + environment - evaporation
    const size = Math.pow(this.mass / 80, 0.67);
    const area = 1.9 * size;
    const M = 95 * Math.pow(this.mass / 80, 0.75) * act;
    const E = 8 * (this.felt - 95) * area;
    const sweatF = pct < 2 ? 1 : pct < 4 ? 0.8 : pct < 6 ? 0.5 : 0.25;
    const S = 300 * area * sweatF * (this.child ? 0.85 : 1) + (this.wetMin > 0 ? 180 * area : 0);
    const net = M + E - S;
    const fPerWh = (1.8 * 3600) / (this.mass * 3500);
    if (net > 0) this.bodyT += net * fPerWh * h;
    else this.bodyT = Math.max(98.6, this.bodyT - Math.min(-net * fPerWh, this.wetMin > 0 ? 4 : 1.5) * h);
    this.bodyT = Math.min(110, this.bodyT);
    this.wetMin = Math.max(0, this.wetMin - dtMin);

    // ---- other needs
    n.food -= 1.1 * act * h;
    if (this.asleep) {
      let q = this.felt > 95 ? 0.4 : this.felt > 88 ? 0.65 : 1; // nobody sleeps well at 95°F
      if (this.bed?.together) {
        q = Math.min(1, q * 1.3);
        const near = g.family.filter((m) => m !== this && m.asleep && m.bed?.together).length;
        n.morale += near * 0.8 * h; // everyone in one room, breathing
      }
      n.energy += 13 * q * h;
    } else if (!this.collapsed) n.energy -= (this.isWatching() ? 4.4 : 3.2 * act) * h;

    let dHealth = 0;
    if (pct > 5) dHealth -= (pct - 5) * 12;
    if (n.food < 10) dHealth -= 1;
    if (n.energy < 5) dHealth -= 1;
    if (this.bodyT > 103) dHealth -= (this.bodyT - 103) * 6 * (this.bodyT > 106 ? 2 : 1);
    if (!dHealth && pct < 2 && n.food > 25 && this.bodyT < 100.5) dHealth = 0.6;
    n.health += dHealth * h;

    // spirit: heat and thirst grind everyone down; a scared kid alone is worse
    let dMorale = -0.4;
    if (this.felt > 95) dMorale -= (this.felt - 95) * 0.05;
    if (pct > 2) dMorale -= 1.2;
    if (n.food < 30) dMorale -= 0.6;
    if (this.child && !this.collapsed) {
      const adultNear = g.family.some((m) => m !== this && !m.dead && !m.child && !m.teen && m.pos.distanceTo(this.pos) < 6);
      if (!adultNear) dMorale -= 5;
      this.flags.alone = !adultNear;
    }
    n.morale += dMorale * h;

    // heat exhaustion: nausea
    if (this.bodyT >= EXHAUSTION_F && !this.collapsed && g.rng.chance(0.3 * h)) {
      this.drink(-(this.child ? 0.15 : 0.3));
      n.food -= 5;
      g.log(`${this.name} throws up${this.indoor ? '' : ' in the dirt'}. Losing water ${this.he} can't spare.`, 'bad');
    }

    for (const k of Object.keys(n)) n[k] = clamp(n[k]);
    if (!this.collapsed && this.bodyT >= STROKE_F) this.collapse();
    else if (this.collapsed && this.bodyT < RECOVER_F) this.revive();
    this.alerts();
    if (n.health <= 0) {
      const cause = this.bodyT >= 104 ? 'Heat stroke.' : pct > 5 ? 'Dehydration.' : `${this.His} body gave out.`;
      this.die(cause);
    }
  }

  // One message each time a line is crossed; re-arms after recovery.
  alerts() {
    const n = this.needs, f = this.flags, g = this.game, pct = this.pct;
    // speech says what is actually spoken, so the line can float over the speaker's head.
    // The log keeps the whole sentence either way; narration passes no speech and stays log only.
    const say = (key, cond, reset, msg, kind = 'warn', speech = null) => {
      if (cond && !f['a_' + key]) {
        f['a_' + key] = true; g.log(msg, kind);
        if (speech) g.bubbles?.say(speech.who, speech.text);
      } else if (reset && f['a_' + key]) f['a_' + key] = false;
    };
    const kid = this.child;
    const thirst = kid ? "I'm thirsty. Can I have water?" : this.teen ? "Is there any water that isn't warm?" : null;
    say('thirsty', pct > 1.2, pct < 0.6, thirst ? `${this.name}: "${thirst}"` : `${this.name} is thirsty.`, 'warn',
      thirst ? { who: this.id, text: thirst } : null);
    say('dehyd', pct > 2.5, pct < 1.5, kid ? `Theo has stopped asking for water. He's quiet, lips cracked. That's worse.` : `${this.name} is dehydrated: headache, dark urine, slow.`, 'bad');
    say('severe', pct > 4.5, pct < 3.5, `${this.name} is severely dehydrated: dizzy, confused, barely sweating.`, 'bad');
    say('hot', this.bodyT >= EXHAUSTION_F, this.bodyT < 100.2, kid ? `Theo is flushed and limp. He's overheating, fast. Kids heat up quicker than adults.` : `${this.name} has heat exhaustion: pounding head, nausea, cramping.`, 'bad');
    const hungry = kid ? "My stomach hurts. When's breakfast?" : null;
    say('hungry', n.food < 25, n.food > 40, hungry ? `${this.name}: "${hungry}"` : `${this.name} is hungry.`, 'warn',
      hungry ? { who: this.id, text: hungry } : null);
    say('tired', n.energy < 20, n.energy > 40, `${this.name} can barely keep ${this.his} eyes open.`);
    if (kid) {
      say('alone', f.alone && n.morale < 50, !f.alone, `Theo: "Mom? Dad? Where are you?" He doesn't like being alone in this.`, 'warn',
        { who: this.id, text: 'Mom? Dad? Where are you?' });
      say('crying', n.morale < 25, n.morale > 35, `Theo is crying and won't stop. Everyone can hear it.`, 'bad');
    }
    if (this.teen) say('sullen', n.morale < 35, n.morale > 45, `Jess has gone quiet and sharp. She's scared and angry about it.`);
  }

  // Teenagers push back when they're miserable; asking twice gets it done.
  willObey() {
    if (!this.teen || this.needs.morale >= 35) return true;
    const now = this.game.sim.min;
    if (now - this.refusedAt < 20) { this.game.log(`Jess: "Fine. FINE."`); this.refusedAt = -1e9; return true; }
    if (this.game.rng.chance(0.5)) {
      this.refusedAt = now;
      this.game.log(this.game.rng.pick([`Jess: "Why is it always me?"`, `Jess: "Can someone else do it for once?"`, `Jess: "I'm not your servant." She doesn't move.`]), 'warn');
      return false;
    }
    return true;
  }

  status() {
    if (this.away) return ['Away', 'ok'];
    if (this.dead) return ['Dead', 'dead'];
    if (this.collapsed) return ['Collapsed: heat stroke', 'bad'];
    if (this.bodyT >= EXHAUSTION_F) return ['Heat exhaustion', 'bad'];
    if (this.pct > 4.5) return ['Severely dehydrated', 'bad'];
    if (this.pct > 2.5) return ['Dehydrated', 'bad'];
    if (this.asleep) return ['Asleep', 'ok'];
    if (this.pct > 1.2) return ['Thirsty', 'warn'];
    if (this.needs.food < 25) return ['Hungry', 'warn'];
    if (this.needs.energy < 20) return ['Exhausted', 'warn'];
    if (this.child && this.needs.morale < 25) return ['Crying', 'warn'];
    if (this.needs.health < 50) return ['Unwell', 'warn'];
    if (this.isWatching()) return ['Keeping watch', 'ok'];
    return ['OK', 'ok'];
  }

  doing() {
    const t = this.task;
    if (this.away) return 'Away from home';
    if (this.dead) return '';
    if (this.draggedBy) return `Being dragged by ${this.draggedBy.name}`;
    if (this.collapsed) return 'Unconscious';
    if (this.isWatching()) return 'Keeping watch';
    if (this.flags.wandered) return this.flags.outageStep ? 'On the front step: needs fetching' : 'In the back yard: needs fetching';
    if (t?.autonomous) return t.label || (this.asleep ? 'sleeping' : 'taking care of things');
    if (this.goal?.autonomous) return `Going to ${this.goal.label || 'rest'}`;
    if (t) {
      const o = t.obj ? t.obj.name.toLowerCase() : '';
      return {
        sit: 'Sitting', leisure: 'Taking a moment',
        prologue: t.obj?.name ? `Using the ${t.obj.name.toLowerCase()}` : 'Busy',
        carAC: 'Cooling in the car (burning fuel)',
        system: t.waitingPower ? 'Waiting for daylight power' : { visitWalt: 'Visiting Walt', waterWalt: 'Bringing Walt water', cook: 'Cooking on the yard grill', enterCar: 'Getting into the car', placeFan: 'Setting up the fan', nebulizer: 'Nebulizer treatment', recharge: 'Charging from daylight', radio: 'Cranking the radio' }[t.action] || 'Working',
        openCan: 'Opening a can with a knife',
        search: `Searching the ${o}`, open: `Opening the ${o}`, drinkTap: 'Drinking from the tap',
        drinkTub: 'Drinking from the tub', fillCont: 'Filling containers', fillTub: 'Filling the tub',
        soak: 'Soaking a towel', douse: `Pouring water over ${t.victim?.name}`, drag: `Dragging ${t.victim?.name}`,
        fetch: `Fetching ${t.victim?.name}`,
        sleep: t.obj ? 'Sleeping' : 'Sleeping on the floor',
        assist: `Helping ${t.lead?.name}`, waitHelp: `Waiting for help to lift ${t.victim?.name}`,
        job: t.waiting ? `${t.job?.label}: waiting for ${t.missing?.map((m) => m.name).join(', ') || 'everyone'}` : t.job?.label,
      }[t.type] || 'Idle';
    }
    if (!this.path.length && this.waitingForAutonomy) return `Waiting (free in ${Math.ceil(this.freeAt - this.game.sim.min)} min)`;
    if (this.ai && this.mode?.type === 'follow') return `Following ${this.game.family.find((m) => m.id === this.mode.who)?.name}`;
    if (this.path.length) return this.goal?.type === 'watch' ? 'Going home to keep watch' : this.goal?.type === 'job' && this.goal.job.walkLabel || 'Walking';
    if (this.ai && this.mode?.type === 'stay') return 'Staying put';
    if (this.wetMin > 0) return 'Wet towel on';
    return 'Idle';
  }
  progress() {
    const t = this.task;
    if (!t || !isFinite(t.dur)) return null;
    return Math.min(1, t.t / t.dur);
  }
}
