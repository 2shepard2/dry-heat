// The household: four people, their bodies, their bags, and what they're doing.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { findPath } from './path.js';
import { makeEntry, invKg } from './inventory.js';

export const FAMILY = [
  { id: 'marcus', name: 'Marcus', age: 41, role: 'Dad', h: 1.8, color: 0x56677a, cap: 28, speed: 1.45,
    at: [24, 7], start: ['car_keys', 'phone_dead'], needs: { hydration: 82, food: 70, energy: 55 } },
  { id: 'elena', name: 'Elena', age: 38, role: 'Mom', h: 1.66, color: 0x8a5a4a, cap: 24, speed: 1.4,
    at: [25, 8], start: ['water_bottle', 'bp_meds'], needs: { hydration: 80, food: 68, energy: 58 } },
  { id: 'jess', name: 'Jess', age: 15, role: 'Daughter', h: 1.62, color: 0x5f7046, cap: 18, speed: 1.5,
    at: [29, 11], start: ['phone_dead'], needs: { hydration: 76, food: 62, energy: 50 } },
  { id: 'theo', name: 'Theo', age: 7, role: 'Son', h: 1.2, color: 0xb08a3a, cap: 8, speed: 1.15,
    at: [25, 14], start: ['stuffed_animal'], needs: { hydration: 74, food: 60, energy: 62 } },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export class Member {
  constructor(def, gltf, baseH, game) {
    Object.assign(this, { id: def.id, name: def.name, age: def.age, role: def.role, cap: def.cap, walk: def.speed });
    this.def = def;
    this.game = game;
    this.child = def.age < 12;
    this.needs = { hydration: 80, food: 70, energy: 60, health: 100, morale: 60, ...def.needs };
    this.bodyT = 98.6;
    this.felt = 80;
    this.inv = def.start.filter((id) => game.ITEMS[id]).map((id) => makeEntry(id));
    this.path = [];
    this.goal = null;
    this.task = null;
    this.asleep = false;
    this.dead = false;
    this.flags = {};

    // body
    this.obj = new THREE.Group();
    const body = cloneSkinned(gltf.scene);
    const s = def.h / baseH;
    body.scale.setScalar(s);
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
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, def.h, 8), new THREE.MeshBasicMaterial({ visible: false }));
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
  busy() { return !!this.task || this.path.length > 0; }

  play(name, fade = 0.25) {
    const a = this.actions[name];
    if (!a || this.cur === a) return;
    a.reset().fadeIn(fade).play();
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a;
  }

  stopTask(quiet = false) {
    if (this.asleep) this.wake(quiet);
    this.task = null;
    this.goal = null;
    this.path = [];
  }

  // Walk to a cell. Returns false when there is no way there.
  moveTo(x, y, goal = null) {
    if (this.dead) return false;
    this.stopTask(true);
    const [cx, cy] = this.cell();
    const p = findPath(this.game.map, cx, cy, x, y);
    if (!p) return false;
    this.path = p;
    this.goal = goal;
    if (!p.length && goal) this.startTask();
    return true;
  }

  // Walk to whichever standing spot next to an object is closest, then do `type` there.
  useObject(obj, type, extra = {}) {
    if (this.dead) return false;
    const map = this.game.map;
    const [cx, cy] = this.cell();
    let best = null;
    for (const [x, y] of map.useCells(obj)) {
      if (x === cx && y === cy) { best = { p: [], x, y }; break; }
      const p = findPath(map, cx, cy, x, y);
      if (p && (!best || p.length < best.p.length)) best = { p, x, y };
    }
    if (!best) { this.game.log(`${this.name} can't get to the ${obj.name.toLowerCase()}.`, 'warn'); return false; }
    this.stopTask(true);
    this.path = best.p;
    this.goal = { type, obj, ...extra };
    if (!best.p.length) this.startTask();
    return true;
  }

  startTask() {
    const g = this.goal;
    this.goal = null;
    if (!g) return;
    const o = g.obj;
    if (o) this.faceTo(o.x + o.w / 2, o.y + o.h / 2);
    const slow = this.child ? 1.5 : 1;
    const dur = {
      search: (o?.home ? 8 : o?.car ? 15 : 20) * slow,
      open: 0.5, drinkTap: 6, drinkTub: 4, fillCont: 6, fillTub: Infinity, sleep: Infinity,
    }[g.type] ?? 1;
    this.task = { ...g, t: 0, dur };
    if (g.type === 'sleep') this.lieDown(o);
    if (g.type === 'fillTub') this.game.log(`${this.name} plugs the drain and opens the tap.`);
  }

  faceTo(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  lieDown(bed) {
    this.asleep = true;
    this.restAt = this.pos.clone();
    if (bed) this.pos.set(bed.x + 0.5, 0.55, bed.y + 0.5);
    else this.pos.y = 0.05;
    this.body.rotation.x = -Math.PI / 2;
    this.body.position.y = 0.15;
    this.play('idle');
  }

  wake(quiet) {
    if (!this.asleep) return;
    this.asleep = false;
    this.body.rotation.x = 0;
    this.body.position.y = 0;
    if (this.restAt) this.pos.copy(this.restAt);
    this.pos.y = 0;
    if (!quiet) this.game.log(`${this.name} is awake.`);
  }

  die(cause) {
    this.dead = true;
    this.stopTask(true);
    this.body.rotation.x = -Math.PI / 2;
    this.body.position.y = 0.12;
    this.pos.y = 0;
    this.mixer.stopAllAction();
    this.body.traverse((m) => { if (m.isMesh) m.material.color.multiplyScalar(0.45); });
    this.game.log(`${this.name} is dead. ${cause}`, 'dead');
    this.game.onDeath(this);
  }

  // ---- per frame ----
  update(dtMin, dtReal) {
    if (this.dead) return;
    const sim = this.game.sim;
    this.mixer.update(dtReal * Math.min(sim.speed, 2.5));

    // movement (walking speed scales with game speed)
    if (this.path.length && sim.speed > 0) {
      let dist = this.walk * dtReal * sim.speed * (this.flags.heatStroke ? 0.6 : 1);
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
      this.play(sim.speed >= 3 ? 'run' : 'walk');
      if (!this.path.length && this.goal) this.startTask();
    } else if (!this.asleep) {
      this.play('idle');
    }
    if (!this.asleep) {
      let dy = this.yaw - this.obj.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.obj.rotation.y += dy * Math.min(1, dtReal * 10);
    }

    if (dtMin <= 0) return;
    this.updateTask(dtMin);
    this.updateBody(dtMin);
  }

  updateTask(dtMin) {
    const t = this.task;
    if (!t) return;
    const g = this.game, sim = g.sim;
    t.t += dtMin;
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
        if (sim.pressure() > 0.05) { this.needs.hydration = 100; g.log(`${this.name} drinks from the tap until the water runs warm.`); }
        else g.log('The tap gurgles. Nothing comes out.', 'warn');
        break;
      case 'drinkTub': {
        const want = Math.max(1, Math.ceil((100 - this.needs.hydration) / 35));
        const l = Math.min(want, Math.floor(sim.tubL));
        if (l < 1) { g.log('The tub is dry.', 'warn'); break; }
        sim.tubL -= l;
        this.needs.hydration = clamp(this.needs.hydration + l * 35);
        g.log(`${this.name} drinks ${l} L from the tub. ${Math.round(sim.tubL)} L left.`);
        break;
      }
      case 'fillCont': g.fillContainers(this); break;
    }
  }

  updateBody(dtMin) {
    const g = this.game, sim = g.sim, map = g.map, n = this.needs;
    const h = dtMin / 60;
    const [cx, cy] = this.cell();
    const indoor = map.isIndoor(cx, cy);
    this.felt = indoor ? sim.indoor + (map.isGarage(cx, cy) ? 5 : 0) : sim.outdoor() + 14 * sim.sun();
    const working = this.task && !this.asleep;
    const act = this.asleep ? 0.6 : this.path.length ? 1.4 : working ? 1.2 : 1;
    const vul = this.child ? 1.3 : 1;

    // water: sweat climbs steeply above ~85°F felt
    n.hydration -= (1.2 + Math.pow(Math.max(0, this.felt - 85), 1.5) * 0.07) * act * vul * h;
    n.food -= 1.1 * act * h;
    if (this.asleep) {
      const q = this.felt > 95 ? 0.4 : this.felt > 88 ? 0.65 : 1; // nobody sleeps well at 95°F
      n.energy += 13 * q * h;
    } else n.energy -= 3.2 * act * h;

    // core temperature drifts toward what heat load, sweat and effort allow
    const sweat = n.hydration > 30 ? 1 : n.hydration > 10 ? 0.55 : 0.2;
    const load = Math.max(0, this.felt - 88);
    const target = 98.6 + load * 0.11 * (2 - sweat) * vul + (act - 1) * 1.5;
    this.bodyT += (target - this.bodyT) * Math.min(1, h * 1.2);

    let dHealth = 0;
    if (n.hydration < 15) dHealth -= (15 - n.hydration) * 0.4;
    if (n.food < 10) dHealth -= 1;
    if (n.energy < 5) dHealth -= 1;
    if (this.bodyT > 103) dHealth -= (this.bodyT - 103) * 5;
    if (!dHealth && n.hydration > 40 && n.food > 25 && this.bodyT < 100.5) dHealth = 0.6;
    n.health += dHealth * h;

    let dMorale = -0.4;
    if (this.felt > 95) dMorale -= (this.felt - 95) * 0.05;
    if (n.hydration < 40) dMorale -= 1;
    if (n.food < 30) dMorale -= 0.6;
    n.morale += dMorale * h;

    for (const k of Object.keys(n)) n[k] = clamp(n[k]);
    this.flags.heatStroke = this.bodyT >= 104;
    this.alerts();
    if (n.health <= 0) {
      const cause = this.bodyT >= 104 ? 'Heat stroke.' : n.hydration < 5 ? 'Dehydration.' : 'Their body gave out.';
      this.die(cause);
    }
  }

  // One message each time a line is crossed; re-arms after recovery.
  alerts() {
    const n = this.needs, f = this.flags, g = this.game;
    const say = (key, cond, reset, msg, kind = 'warn') => {
      if (cond && !f[key]) { f[key] = true; g.log(msg, kind); }
      else if (reset && f[key]) f[key] = false;
    };
    const kid = this.child;
    say('thirsty', n.hydration < 45, n.hydration > 60, kid ? `Theo: "I'm thirsty. Can I have water?"` : `${this.name} is thirsty.`);
    say('dehyd', n.hydration < 20, n.hydration > 35, `${this.name} is badly dehydrated: dizzy, no longer sweating much.`, 'bad');
    say('hot', this.bodyT > 101.5, this.bodyT < 100.2, kid ? `Theo is flushed and listless. He's overheating.` : `${this.name} is overheating. Get them out of the heat.`, 'bad');
    say('stroke', this.bodyT >= 104, this.bodyT < 102.5, `${this.name} has heat stroke: confused, skin hot and dry. They need to cool down now.`, 'bad');
    say('hungry', n.food < 25, n.food > 40, kid ? `Theo: "My stomach hurts. When's breakfast?"` : `${this.name} is hungry.`);
    say('tired', n.energy < 20, n.energy > 40, `${this.name} can barely keep their eyes open.`);
  }

  status() {
    if (this.dead) return ['Dead', 'dead'];
    if (this.flags.heatStroke) return ['Heat stroke', 'bad'];
    if (this.bodyT > 101.5) return ['Heat exhaustion', 'bad'];
    if (this.needs.hydration < 20) return ['Severely dehydrated', 'bad'];
    if (this.asleep) return ['Asleep', 'ok'];
    if (this.needs.hydration < 45) return ['Thirsty', 'warn'];
    if (this.needs.food < 25) return ['Hungry', 'warn'];
    if (this.needs.energy < 20) return ['Exhausted', 'warn'];
    if (this.needs.health < 50) return ['Unwell', 'warn'];
    return ['OK', 'ok'];
  }

  doing() {
    const t = this.task;
    if (this.dead) return '';
    if (t) {
      const o = t.obj ? t.obj.name.toLowerCase() : '';
      return {
        search: `Searching the ${o}`, open: `Opening the ${o}`, drinkTap: 'Drinking from the tap',
        drinkTub: 'Drinking from the tub', fillCont: 'Filling containers', fillTub: 'Filling the tub',
        sleep: this.task.obj ? 'Sleeping' : 'Sleeping on the floor',
      }[t.type] || '';
    }
    if (this.path.length) return 'Walking';
    return '';
  }
  progress() {
    const t = this.task;
    if (!t || !isFinite(t.dur)) return null;
    return Math.min(1, t.t / t.dur);
  }
}
