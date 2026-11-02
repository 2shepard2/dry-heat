// The household: four people, their bodies, their bags, and what they're doing.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { findPath, nearbyWalkable } from './path.js';
import { makeEntry, invKg } from './inventory.js';

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
    this.wetMin = 0;            // minutes of extra evaporative cooling from a soaked shirt/towel
    this.collapsed = false;
    this.draggedBy = null;
    this.inv = def.start.filter((id) => game.ITEMS[id]).map((id) => makeEntry(id));
    this.path = [];
    this.goal = null;
    this.task = null;
    this.asleep = false;
    this.dead = false;
    this.flags = {};
    this.refusedAt = -1e9;
    // the kids are not yours to steer: they follow, wait, and look after themselves (badly)
    this.ai = this.child || this.teen;
    this.mode = this.child ? { type: 'follow', who: 'elena' } : this.teen ? { type: 'stay' } : null;
    this.thinkT = 0;
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
  kg() { return invKg(this.inv); }
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

  stopTask(quiet = false) {
    if (this.asleep) this.wake(quiet);
    if (this.task?.type === 'drag' && this.task.victim) this.task.victim.draggedBy = null;
    this.task = null;
    this.goal = null;
    this.path = [];
  }

  moveTo(x, y, goal = null) {
    if (!this.canAct()) return false;
    const [cx, cy] = this.cell();
    const p = findPath(this.game.map, cx, cy, x, y);
    if (!p) return false;
    this.stopTask(true);
    this.path = p;
    this.goal = goal;
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
    if (!this.canAct()) return;
    if (type === 'stay' && this.child && this.needs.morale < 30) {
      g.log(`Theo: "No! Don't leave me!" He grabs ${from.name}'s shirt and won't let go.`, 'warn');
      this.mode = { type: 'follow', who: from.id };
      return;
    }
    if (!this.willObey()) return;
    this.stopTask(true);
    if (type === 'follow') { this.mode = { type: 'follow', who: from.id }; g.log(`${this.name} sticks close to ${from.name}.`); }
    else if (type === 'stay') { this.mode = { type: 'stay' }; g.log(`${this.name} stays put.`); }
    else if (type === 'help') { this.task = { type: 'assist', lead: from, t: 0, dur: Infinity }; g.log(`${this.name} goes to help ${from.name}.`); }
    else if (type === 'drink') this.useObject(g.map.tub, 'drinkTub');
    else if (type === 'rest') {
      const bed = g.freeBed(this);
      if (bed) this.useObject(bed, 'sleep'); else { this.goal = { type: 'sleep', obj: null }; this.startTask(); }
    }
  }

  // Kids' own little brain, a couple of times a game minute.
  think(dtMin) {
    if (!this.ai || !this.canAct()) return;
    this.thinkT -= dtMin;
    if (this.thinkT > 0) return;
    this.thinkT = 0.5;
    const g = this.game, sim = g.sim, map = g.map;
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
      if (!p || p.dead) { this.mode = { type: 'stay' }; return; }
      this.stayNear(p, 2.4);
    }
  }

  stayNear(p, r) {
    if (p.dead) { this.task = null; return; }
    if (this.pos.distanceTo(p.pos) <= r) { this.path = []; return; }
    const [px, py] = p.cell();
    const avoid = new Set(this.game.family.filter((m) => m !== this).map((m) => m.cell()[1] * this.game.map.W + m.cell()[0]));
    const spot = nearbyWalkable(this.game.map, px, py, 1, avoid)[0] || [px, py];
    this.walkTo(spot[0], spot[1]);
  }

  // Walk to the closest standing spot among `cells`, then start goal.
  approach(cells, goal, what) {
    if (!this.canAct()) return false;
    const map = this.game.map;
    const [cx, cy] = this.cell();
    let best = null;
    for (const [x, y] of cells) {
      if (x === cx && y === cy) { best = { p: [] }; break; }
      const p = findPath(map, cx, cy, x, y);
      if (p && (!best || p.length < best.p.length)) best = { p };
    }
    if (!best) { this.game.log(`${this.name} can't get to ${what}.`, 'warn'); return false; }
    this.stopTask(true);
    this.path = best.p;
    this.goal = goal;
    if (!best.p.length) this.startTask();
    return true;
  }

  useObject(obj, type, extra = {}) {
    return this.approach(this.game.map.useCells(obj), { type, obj, ...extra }, `the ${obj.name.toLowerCase()}`);
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
    const o = g.obj;
    if (o) this.faceTo(o.x + o.w / 2, o.y + o.h / 2);
    if (g.victim) this.faceTo(g.victim.pos.x, g.victim.pos.z);
    const slow = (this.child ? 1.5 : 1) * (this.bodyT >= EXHAUSTION_F ? 1.4 : 1);
    const dur = {
      search: (o?.home ? 4 : o?.car ? 6 : 8) * slow,
      open: 0.3, drinkTap: 3, drinkTub: 2, fillCont: 4, soak: 5, douse: 3, fillTub: Infinity, sleep: Infinity, drag: Infinity,
      job: g.job?.dur ?? 15,
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
    this.asleep = true;
    this.restAt = this.pos.clone();
    this.bed = bed || null;
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
    this.dead = true;
    this.stopTask(true);
    if (this.draggedBy) { this.draggedBy.stopTask(true); this.draggedBy = null; }
    this.layFlat(0.05);
    this.mixer.stopAllAction();
    this.body.traverse((m) => { if (m.isMesh) m.material.color.multiplyScalar(0.45); });
    this.game.log(`${this.name} is dead. ${cause}`, 'dead');
    this.game.onDeath(this);
  }

  // ---- per frame ----
  update(dtMin, dtReal) {
    if (this.dead) return;
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
      let dist = this.walk * sick * dragging * dtReal * sim.speed;
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
    if (this.task?.type === 'assist' && (!this.task.lead.task && !this.task.lead.goal || this.task.lead.dead)) this.task = null;
    this.updateTask(dtMin);
    this.updateBody(dtMin);
  }

  finishDrag() {
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
    if (!t || t.type === 'drag') return;
    const g = this.game, sim = g.sim;
    if (t.type === 'assist') return;
    if (t.type === 'waitHelp') {
      const v = t.victim;
      const crew = this.mass + this.helpers(2.6).reduce((s, m) => s + m.mass, 0);
      if (v.dead || !v.collapsed) { this.task = null; return; }
      if (crew >= v.mass * 0.55) { this.task = null; this.goal = { type: 'drag', victim: v }; this.startTask(); }
      return;
    }
    if (t.type === 'job') {
      const crew = t.job.crew.filter((m) => !m.dead);
      const ready = crew.every((m) => m === this || (m.canAct() && m.task?.type === 'assist' && m.task.lead === this && m.pos.distanceTo(this.pos) < 4.5));
      t.waiting = !ready;
      if (ready) t.t += dtMin;
      if (t.t >= t.dur) { this.task = null; t.job.done(); }
      return;
    }
    t.t += dtMin * (['search', 'fillCont'].includes(t.type) ? this.helpRate() : 1);
    if (t.type === 'fillTub') {
      const p = sim.pressure();
      if (p <= 0.001) {
        g.log(`The tap coughs air and stops. The water's gone. The tub holds ${Math.round(sim.tubL)} liters.`, 'warn');
        this.task = null; return;
      }
      sim.tubL = Math.min(sim.TUB_MAX, sim.tubL + 2.5 * p * dtMin);
      if (sim.tubL >= sim.TUB_MAX) { g.log(`The tub is full: ${sim.TUB_MAX} liters.`, 'good'); this.task = null; }
      return;
    }
    if (t.type === 'sleep') {
      if (this.needs.energy >= 98) { this.task = null; this.wake(); }
      return;
    }
    if (t.t < t.dur) return;
    this.task = null;
    const o = t.obj;
    switch (t.type) {
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
        this.wetMin = 60;
        this.bodyT = Math.max(98.6, this.bodyT - 0.5);
        g.log(`${this.name} soaks a towel and a shirt in the tub (${l.toFixed(0)} L). It helps.`);
        break;
      }
      case 'douse': g.douse(this, t.victim); break;
      case 'fillCont': g.fillContainers(this); break;
    }
  }

  updateBody(dtMin) {
    const g = this.game, sim = g.sim, map = g.map, n = this.needs;
    const h = dtMin / 60;
    const [cx, cy] = this.cell();
    const indoor = map.isIndoor(cx, cy);
    this.indoor = indoor;
    this.felt = indoor ? sim.indoor + (map.isGarage(cx, cy) ? 5 : 0) - (this.bed?.together ? 2 : 0) : sim.outdoor() + 14 * sim.sun();
    const working = this.task && !this.asleep;
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
    } else if (!this.collapsed) n.energy -= 3.2 * act * h;

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
    const say = (key, cond, reset, msg, kind = 'warn') => {
      if (cond && !f['a_' + key]) { f['a_' + key] = true; g.log(msg, kind); }
      else if (reset && f['a_' + key]) f['a_' + key] = false;
    };
    const kid = this.child;
    say('thirsty', pct > 1.2, pct < 0.6, kid ? `Theo: "I'm thirsty. Can I have water?"` : this.teen ? `Jess: "Is there any water that isn't warm?"` : `${this.name} is thirsty.`);
    say('dehyd', pct > 2.5, pct < 1.5, kid ? `Theo has stopped asking for water. He's quiet, lips cracked. That's worse.` : `${this.name} is dehydrated: headache, dark urine, slow.`, 'bad');
    say('severe', pct > 4.5, pct < 3.5, `${this.name} is severely dehydrated: dizzy, confused, barely sweating.`, 'bad');
    say('hot', this.bodyT >= EXHAUSTION_F, this.bodyT < 100.2, kid ? `Theo is flushed and limp. He's overheating, fast. Kids heat up quicker than adults.` : `${this.name} has heat exhaustion: pounding head, nausea, cramping.`, 'bad');
    say('hungry', n.food < 25, n.food > 40, kid ? `Theo: "My stomach hurts. When's breakfast?"` : `${this.name} is hungry.`);
    say('tired', n.energy < 20, n.energy > 40, `${this.name} can barely keep ${this.his} eyes open.`);
    if (kid) {
      say('alone', f.alone && n.morale < 50, !f.alone, `Theo: "Mom? Dad? Where are you?" He doesn't like being alone in this.`);
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
    return ['OK', 'ok'];
  }

  doing() {
    const t = this.task;
    if (this.dead) return '';
    if (this.draggedBy) return `Being dragged by ${this.draggedBy.name}`;
    if (this.collapsed) return 'Unconscious';
    if (t) {
      const o = t.obj ? t.obj.name.toLowerCase() : '';
      return {
        search: `Searching the ${o}`, open: `Opening the ${o}`, drinkTap: 'Drinking from the tap',
        drinkTub: 'Drinking from the tub', fillCont: 'Filling containers', fillTub: 'Filling the tub',
        soak: 'Soaking a towel', douse: `Pouring water over ${t.victim?.name}`, drag: `Dragging ${t.victim?.name}`,
        sleep: t.obj ? 'Sleeping' : 'Sleeping on the floor',
        assist: `Helping ${t.lead?.name}`, waitHelp: `Waiting for help to lift ${t.victim?.name}`,
        job: t.waiting ? `${t.job?.label}: waiting for everyone` : t.job?.label,
      }[t.type] || '';
    }
    if (this.ai && this.mode?.type === 'follow') return `Following ${this.game.family.find((m) => m.id === this.mode.who)?.name}`;
    if (this.path.length) return 'Walking';
    if (this.ai && this.mode?.type === 'stay') return 'Staying put';
    if (this.wetMin > 0) return 'Wet towel on';
    return '';
  }
  progress() {
    const t = this.task;
    if (!t || !isFinite(t.dur)) return null;
    return Math.min(1, t.t / t.dur);
  }
}
