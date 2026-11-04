// Prologue interpreter. Content and browser presentation are injected so the
// sequence can also be exercised in Node without a DOM or renderer.
import { BEATS } from './data/beats.js';
import { DEFAULT_DECISIONS } from './systems.js';
import { POWER_OUT_MIN } from './sim.js';
import { makeEntry, addEntry } from './inventory.js';

export const beatMinute = (b) => (b.day - 1) * 1440 + b.at;
export function mapBeatTargets(map) {
  const home = (ch) => map.objects.find((o) => o.home && o.ch === ch);
  const prop = (key, name, x, y) => ({ key, name, x, y, w: 1, h: 1, home: true, prologueProp: true });
  const targets = {
    coffee: prop('coffee', 'Coffee maker', 30, 7), desk: prop('desk', 'Work desk', 25, 7),
    sink: home('Z'), fridge: home('F'), pantry: home('K'),
    'garage-jugs': home('S'), 'garage-shelf': home('S'),
    car: map.objects.find((o) => o.home && o.car), inhaler: home('k'), couch: home('L'),
    'dinner-table': prop('dinner-table', 'Dinner table', 30, 11), beds: home('R'),
    sprinkler: prop('sprinkler', 'Sprinkler', 29, 17),
    'front-door': prop('front-door', 'Front door', 27, 15), street: prop('street', 'Street', 28, 21),
    'walt-mailbox': prop('walt-mailbox', "Walt’s mailbox", 15, 19),
    walt: map.sites.find((s) => s.key === 'walt'),
    'pruitt-gate': prop('pruitt-gate', "Pruitt’s gate", 41, 15),
    'okafor-wall': prop('okafor-wall', 'Okafors’ wall', 31, 25),
    'gas-station': prop('gas-station', 'Circle K · by car', 38, 18),
    store: prop('store', 'Fry’s · by car', 35, 18),
  };
  for (const [key, o] of Object.entries(targets)) {
    if (!o) throw new Error(`Missing prologue target: ${key}`);
    (o.beatTargets ||= []).push(key);
  }
  map.prologueProps = Object.values(targets).filter((o) => o.prologueProp);
  return targets;
}

export class Prologue {
  constructor(game, { beats = BEATS, targets = mapBeatTargets(game.map), present = () => {}, aurora = () => {}, cut = () => {} } = {}) {
    this.g = game; this.beats = beats; this.targets = targets;
    this.present = present; this.aurora = aurora; this.cut = cut;
    this.index = -1; this.current = null; this.seenHints = new Set(); this.completed = new Set();
    this.lines = []; this.lineDelay = 0; this.pending = false; this.trip = null;
    game.flags ||= {}; game.decisions = {}; game.beats = this;
    if (targets.inhaler?.items) addEntry(targets.inhaler.items, makeEntry('inhaler_empty'));
    if (targets.fridge?.items) addEntry(targets.fridge.items, makeEntry('fridge_list'));
    game.jumpBeat = (id) => this.jump(id);
    game.pickChoice = (value) => this.pick(value);
    game.skipToOutage = () => this.outage(true);
    game.readDecisions = () => ({ ...game.decisions });
  }
  get paused() { return this.current?.do?.type === 'choice' && !this.pending && !this.current.optional; }
  start() { if (this.index < 0) this.next(); }
  jump(id) {
    const i = this.beats.findIndex((b) => b.id === id);
    if (i < 0 || this.g.sim.phase !== 'prologue') return false;
    this.restoreTrip();
    for (const m of this.g.family) m.stopTask(true);
    this.index = i; this.g.sim.min = beatMinute(this.beats[i]); this.begin(this.beats[i]); return true;
  }
  next() { this.index++; if (this.beats[this.index]) this.begin(this.beats[this.index]); else this.current = null; }
  begin(b) {
    this.current = b; this.pending = false; this.elapsed = 0; this.arrivals = new Set();
    this.g.sim.min = Math.max(this.g.sim.min, beatMinute(b));
    this.g.sim.prologueDay = b.day;
    this.startedAt = this.g.sim.min;
    this.g.objectives = (b.objectives || []).map((text, i) => ({ id: `prologue-${i}`, text }));
    this.lines = [...(b.lines || [])]; this.lineDelay = 0;
    if (b.log) this.g.log(b.log);
    if (b.teach && !this.seenHints.has(b.teach)) { this.seenHints.add(b.teach); this.g.log(b.teach, 'hint'); }
    this.aurora(b.id === 'p14a', b);
    this.present(b.do?.type === 'choice' ? b.do : null);
  }
  speak(dtReal) {
    this.lineDelay -= dtReal;
    if (this.lines.length && this.lineDelay <= 0) {
      const l = this.lines.shift();
      const name = this.g.family.find((m) => m.id === l.who)?.name || ({ walt: 'Walt', pruitt: 'Mr. Pruitt', okafor: 'Okafor', radio: 'Radio' }[l.who] || l.who);
      this.g.log(`${name}: "${l.text}"`); this.lineDelay = 1.6;
    }
  }
  update(dtMin, dtReal) {
    if (this.g.sim.phase !== 'prologue' || !this.current) return;
    this.speak(dtReal);
    const b = this.current, d = b.do || { type: 'wait', minutes: 0 };
    this.elapsed += dtMin;
    if (this.trip && this.g.sim.min >= this.trip.until) { this.restoreTrip(); this.pending = true; }
    if (d.type === 'wait' && this.elapsed >= (d.minutes || 0)) this.pending = true;
    if (d.type === 'walk') {
      const o = this.targets[d.target];
      if (this.g.family.some((m) => (!d.who || m.id === d.who) && !m.away && Math.hypot(m.pos.x - o.x - 0.5, m.pos.z - o.y - 0.5) < 2)) this.pending = true;
    }
    if (b.optional && this.elapsed >= (b.timeout ?? 30)) { this.restoreTrip(); this.pending = true; }
    if (this.pending && !this.lines.length && this.lineDelay <= 0) this.finish();
  }
  notify(type, who, target) {
    const d = this.current?.do;
    if (!d || this.g.sim.phase !== 'prologue' || d.type !== type || d.target !== target || (d.who && d.who !== who) || (d.kid && d.kid !== who)) return false;
    this.arrivals.add(who);
    if (type !== 'together' || ['marcus', 'elena'].every((id) => this.arrivals.has(id))) this.pending = true;
    if (['pantry', 'fridge'].includes(target)) {
      const m = this.g.family.find((m) => m.id === who), o = this.targets[target];
      if (m && this.g.searchDone) o.searched ? this.g.openContainer(m, o) : this.g.searchDone(m, o);
    }
    return true;
  }
  // Main uses these same actions for furniture menus and child orders.
  interact(target, members = this.g.selected) {
    const d = this.current?.do, o = this.targets[target];
    if (!d || this.pending || !o || (d.target !== target && !(d.type === 'trip' && target === 'car'))) return false;
    if (d.type === 'trip') return this.depart(d);
    if (d.type === 'walk') return members.filter((m) => !d.who || m.id === d.who).map((m) => m.useObject(o, 'prologue', { beatType: 'walk', target })).some(Boolean);
    if (!['use', 'order', 'together'].includes(d.type)) return false;
    const crew = d.type === 'order' ? this.g.family.filter((m) => m.id === d.kid)
      : d.who && this.g.family.find((m) => m.id === d.who)?.ai
        ? this.g.family.filter((m) => m.id === d.who)
        : members.filter((m) => !d.who || m.id === d.who);
    if (d.type === 'together' && !['marcus', 'elena'].every((id) => crew.some((m) => m.id === id))) { this.g.log('Select both Marcus and Elena to help together.'); return false; }
    return crew.map((m) => m.useObject(o, 'prologue', { beatType: d.type, target, duration: target === 'desk' ? Math.max(2, 720 - this.g.sim.hour * 60) : 2 })).some(Boolean);
  }
  depart(d) {
    if (this.trip) return false;
    const crew = d.who.map((id) => this.g.family.find((m) => m.id === id)).filter(Boolean);
    const car = this.targets.car;
    this.trip = { crew, until: this.g.sim.min + (d.minutes || 0), cells: this.g.map.objCells(car).map(([x, y]) => {
      const i = this.g.map.idx(x, y), before = this.g.map.type[i];
      this.g.map.type[i] = car.floor;
      return [i, before];
    }) };
    for (const m of crew) { m.stopTask(true); m.away = true; m.obj.visible = false; }
    if (car.mesh) car.mesh.visible = false;
    car.away = true;
    this.g.log(d.label || `They drive to ${this.targets[d.target].name}.`);
    return true;
  }
  restoreTrip() {
    if (!this.trip) return;
    for (const [i, before] of this.trip.cells) this.g.map.type[i] = before;
    this.trip.crew.forEach((m, i) => { m.away = false; m.obj.visible = true; m.pos.set(35.5 + i, 0, 18.5); });
    const car = this.targets.car; car.away = false; if (car.mesh) car.mesh.visible = true;
    this.trip = null;
  }
  pick(value) {
    const d = this.current?.do;
    if (d?.type !== 'choice' || this.pending) return false;
    const option = d.options.find((o) => o.value === value);
    if (!option) return false;
    this.g.decisions[d.flag] = value;
    this.g.sim.step(option.minutes || 0);
    this.lines.push(...(option.lines || []));
    if (option.log) this.g.log(option.log);
    this.present(null); this.pending = true; return true;
  }
  sleep() {
    if (this.current?.do?.type !== 'sleep') return false;
    for (const m of this.g.family) { m.stopTask(true); m.goal = { type: 'sleep', obj: null }; m.startTask(); }
    this.pending = true; return true;
  }
  finish() {
    const b = this.current;
    for (const flag of b.sets || []) this.g.flags[flag] = true;
    this.completed.add(b.id); this.present(null);
    if (b.outage) { this.outage(); return; }
    if (b.do?.type === 'sleep') for (const m of this.g.family) { m.stopTask(true); m.needs.energy = 95; }
    this.next();
  }
  outage(defaults = false) {
    if (this.g.sim.phase === 'outage') return false;
    this.restoreTrip(); this.present(null); this.aurora(false);
    const g = this.g;
    g.prologueSnapshot = { decisions: { ...g.decisions }, flags: { ...g.flags }, completed: [...this.completed] };
    g.decisions = { ...DEFAULT_DECISIONS, ...(defaults ? {} : g.decisions) };
    for (const m of g.family) { m.stopTask(true); m.pos.set(m.def.at[0] + 0.5, 0, m.def.at[1] + 0.5);
      // They slept the night in the AC: wake rested and fed, whatever the prologue clock did.
      Object.assign(m.needs, { energy: Math.max(m.needs.energy, 80), food: Math.max(m.needs.food, 70), hydration: Math.max(m.needs.hydration, 95) }); }
    g.sim.phase = 'outage'; g.sim.min = POWER_OUT_MIN; g.sim.indoor = 78; g.sim.speed = 1;
    applyDecisions(g);
    this.current = null; this.lines = []; this.cut(); return true;
  }
}

export function applyDecisions(g) {
  g.decisions = { ...DEFAULT_DECISIONS, ...g.decisions };
  const s = g.systems;
  s.car.fuelL = g.decisions.gas === 'full' ? 55 : 14;
  s.car.running = false; s.walt.trust = g.decisions.walt === 'walked' ? 2 : 0;
  // Apply to stock already discovered/carried as well as future search rolls.
  const all = [...g.map.objects.filter((o) => o.home).flatMap((o) => [o.items, o.unseen || []]), ...g.family.map((m) => m.inv)];
  const removed = new Set(g.decisions.cart === 'water' ? ['water_case'] : g.decisions.cart === 'pharmacy' ? ['inhaler_spare', 'bp_refill'] : ['birthday_jess']);
  if (g.decisions.jugs === 'recycled') { removed.add('water_gallon'); removed.add('water_gallon_half'); }
  for (const inv of all) for (let i = inv.length - 1; i >= 0; i--) if (removed.has(inv[i].id)) inv.splice(i, 1);
  const shelf = g.map.objects.find((o) => o.home && o.ch === 'S' && o.x === 35);
  if (g.decisions.jugs === 'shelf' && shelf.questStock && !all.some((inv) => inv.some((e) => ['water_gallon', 'water_gallon_half'].includes(e.id)))) {
    for (let i = 0; i < 14; i++) addEntry(shelf.items, makeEntry(i < 10 ? 'water_gallon' : 'water_gallon_half'));
  }
  const pantry = g.map.objects.find((o) => o.home && o.ch === 'K');
  const cabinet = g.map.objects.find((o) => o.home && o.ch === 'T');
  const addOnce = (o, id) => { if (!all.some((inv) => inv.some((e) => e.id === id))) addEntry(o.items, makeEntry(id)); };
  if (g.decisions.cart !== 'water') addOnce(pantry, 'water_case');
  if (g.decisions.cart !== 'pharmacy') { addOnce(cabinet, 'inhaler_spare'); addOnce(cabinet, 'bp_refill'); }
  if (g.decisions.cart !== 'birthday') addOnce(pantry, 'birthday_jess');
  else { const jess = g.family.find((m) => m.id === 'jess'); if (jess) jess.needs.morale = Math.max(0, jess.needs.morale - 12); }
}
