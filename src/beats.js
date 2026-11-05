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
    this.todos = new Map(); this.todoDay = null;
    this.absences = []; this.boarding = null; this.choiceReady = false;
    game.flags ||= {}; game.decisions = {}; game.beats = this;
    if (targets.inhaler?.items) addEntry(targets.inhaler.items, makeEntry('inhaler_empty'));
    if (targets.fridge?.items) addEntry(targets.fridge.items, makeEntry('fridge_list'));
    game.jumpBeat = (id) => this.jump(id);
    game.pickChoice = (value) => this.pick(value);
    game.skipToOutage = () => this.outage(true);
    game.readDecisions = () => ({ ...game.decisions });
  }
  get paused() { return this.choiceReady && !this.pending && !this.thenStarted && !this.trip && !this.boarding && !this.current?.optional; }
  start() { if (this.index < 0) this.next(); }
  jump(id) {
    const i = this.beats.findIndex((b) => b.id === id);
    if (i < 0 || this.g.sim.phase !== 'prologue') return false;
    this.restoreTrip(); this.boarding = null;
    for (const m of this.g.family) m.stopTask(true);
    this.index = i; this.g.sim.min = beatMinute(this.beats[i]); this.begin(this.beats[i]); return true;
  }
  next() { this.index++; if (this.beats[this.index]) this.begin(this.beats[this.index]); else this.current = null; }
  begin(b, force = false) {
    this.current = b; this.waiting = !force && this.g.sim.min < beatMinute(b);
    this.choiceReady = false; this.thenStarted = false; this.present(null);
    this.aurora(false, b);
    if (this.waiting) { this.pending = false; this.lines = []; this.lineDelay = 0; this.refreshObjectives(); return; }
    this.current = b; this.pending = false; this.elapsed = 0; this.arrivals = new Set();
    this.g.sim.min = Math.max(this.g.sim.min, beatMinute(b));
    this.g.sim.prologueDay = b.day;
    this.startedAt = this.g.sim.min;
    this.refreshObjectives();
    this.lines = [...(b.lines || [])]; this.lineDelay = 0;
    if (b.log) this.g.log(b.log);
    if (b.teach && !this.seenHints.has(b.teach)) { this.seenHints.add(b.teach); this.g.log(b.teach, 'hint'); }
    this.aurora(b.id === 'p14a', b);
    this.showChoice();
  }
  speak(dtReal) {
    this.lineDelay -= dtReal;
    if (this.lines.length && this.lineDelay <= 1e-8) {
      const l = this.lines.shift();
      const name = this.g.family.find((m) => m.id === l.who)?.name || ({ walt: 'Walt', pruitt: 'Mr. Pruitt', okafor: 'Okafor', radio: 'Radio' }[l.who] || l.who);
      this.g.log(`${name}: "${l.text}"`); this.lineDelay = 2.5;
    }
  }
  update(dtMin, dtReal) {
    if (this.g.sim.phase !== 'prologue' || !this.current) return;
    this.updateAbsences();
    if (this.waiting) {
      if (this.g.sim.min < beatMinute(this.current)) return;
      this.begin(this.current, true);
    }
    this.speak(dtReal); this.showChoice();
    const b = this.current, d = b.do || { type: 'wait', minutes: 0 };
    this.elapsed += dtMin;
    if (this.boarding) this.updateBoarding();
    if (this.trip && this.g.sim.min >= this.trip.until) { this.restoreTrip(); this.pending = true; }
    if (d.type === 'wait' && this.elapsed >= (d.minutes || 0)) this.pending = true;
    if (d.type === 'walk') {
      const o = this.targets[d.target];
      if (this.g.family.some((m) => (!d.who || m.id === d.who) && !m.away && Math.hypot(m.pos.x - o.x - 0.5, m.pos.z - o.y - 0.5) < 2)) this.pending = true;
    }
    if (this.pending && b.then && !this.thenStarted) {
      this.thenStarted = true; this.pending = false; this.queueTrip(b.then);
    }
    if (b.optional && !this.trip && !this.boarding && this.elapsed >= (b.timeout ?? 30)) { this.restoreTrip(); this.pending = true; }
    if (this.pending && !this.lines.length && this.lineDelay <= 1e-8) this.finish();
  }
  notify(type, who, target) {
    if (type === 'boarding' && this.boarding) { this.boarding.arrived.add(who); return true; }
    const d = this.current?.do;
    if (!d || this.waiting || this.g.sim.phase !== 'prologue' || d.type !== type || d.target !== target || (d.who && d.who !== who) || (d.kid && d.kid !== who)) return false;
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
    if (!d || this.waiting || this.boarding || this.trip || this.pending || !o || (d.target !== target && !(d.type === 'trip' && target === 'car'))) return false;
    if (d.type === 'trip') return this.queueTrip(d);
    if (d.type === 'walk') return members.filter((m) => !d.who || m.id === d.who).map((m) => m.useObject(o, 'prologue', { beatType: 'walk', target })).some(Boolean);
    if (!['use', 'order', 'together'].includes(d.type)) return false;
    const crew = d.type === 'order' ? this.g.family.filter((m) => m.id === d.kid)
      : d.who && this.g.family.find((m) => m.id === d.who)?.ai
        ? this.g.family.filter((m) => m.id === d.who)
        : members.filter((m) => !d.who || m.id === d.who);
    if (d.type === 'together' && !['marcus', 'elena'].every((id) => crew.some((m) => m.id === id))) { this.g.log('Select both Marcus and Elena to help together.'); return false; }
    return crew.map((m) => {
      m.stopTask(true);
      return m.useObject(o, 'prologue', { beatType: d.type, target, duration: target === 'desk' ? Math.max(2, 720 - this.g.sim.hour * 60) : 2 });
    }).some(Boolean);
  }
  showChoice() {
    if (this.current?.do?.type === 'choice' && !this.waiting && !this.pending && !this.choiceReady && !this.lines.length && this.lineDelay <= 1e-8) {
      this.choiceReady = true; this.present(this.current.do);
    }
  }
  refreshObjectives() {
    const b = this.current;
    if (this.todoDay !== b.day) { this.todos.clear(); this.todoDay = b.day; }
    for (const o of this.todos.values()) o.current = false;
    const current = (b.objectives || []).map((text, i) => {
      const coveredBy = b.covers?.[i] || b.id;
      const o = this.todos.get(text) || { id: `prologue-${b.id}-${i}`, text, coveredBy, prologue: true };
      o.current = !this.waiting && i === (b.activeObjective ?? 0);
      this.todos.set(text, o); return o;
    });
    for (const o of this.todos.values()) o.done = this.completed.has(o.coveredBy);
    this.g.objectives = [...current, ...[...this.todos.values()].filter((o) => !current.includes(o))];
  }
  guidance() {
    const b = this.current, d = b?.do;
    if (!d) return null;
    const name = (id) => this.g.family.find((m) => m.id === id)?.name || id;
    const o = this.targets[d.target];
    let target = d.type === 'order' ? this.g.family.find((m) => m.id === d.kid) : o;
    let crew = d.type === 'together' ? ['marcus', 'elena'] : Array.isArray(d.who) ? d.who : [d.who || 'marcus'];
    if (d.type === 'order') crew = ['marcus'];
    if (crew.every((id) => this.g.family.find((m) => m.id === id)?.ai)) crew = ['marcus'];
    const actions = { coffee: 'make coffee in the kitchen', desk: 'work at the desk in the spare room',
      pantry: 'check the pantry in the kitchen', inhaler: 'check Theo’s inhaler in the kitchen drawers',
      sprinkler: 'join Theo at the sprinkler in the back yard', 'dinner-table': 'sit at the dinner table in the living room' };
    let text = d.type === 'choice' ? (this.choiceReady ? 'Choose below' : 'Listen, then choose below')
      : d.type === 'order' ? `Click ${name(d.kid)} and tell ${d.kid === 'theo' ? 'him to get in the car' : 'her to wash the dishes at the kitchen sink'}`
      : d.type === 'sleep' ? 'Press Z or click a bed to send everyone to sleep'
      : d.type === 'wait' ? 'Wait and watch the sky; the clock is running'
      : `${(d.who && !Array.isArray(d.who) ? [d.who] : crew).map(name).join(' and ')}: ${actions[d.target] || `${d.type === 'walk' ? 'walk to' : d.type === 'together' || d.type === 'trip' ? 'drive to' : 'use'} ${o?.name || d.target}`}`;
    if (d.type === 'sleep') target = this.targets.beds;
    if (d.type === 'together' || d.type === 'trip') target = this.targets.car;
    if (this.waiting) text = `Free time until ${this.clockAt(b.at)} — next: ${text}`;
    if (this.boarding) { target = this.targets.car; text = 'Getting in the car — the family will drive away together'; }
    if (this.trip) { target = null; text = `${this.trip.label} — back around ${this.clockAt(this.trip.until)}; wait for them to return`; }
    return { text, target, crew };
  }
  clockAt(minute) {
    const local = (minute % 1440 + 1440) % 1440, h = Math.floor(local / 60);
    return `${(h + 11) % 12 + 1}:${String(Math.floor(local % 60)).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  queueTrip(d) {
    if (this.trip || this.boarding) return false;
    this.boarding = { data: d, arrived: new Set() };
    this.updateBoarding(); return true;
  }
  updateBoarding() {
    const boarding = this.boarding;
    for (const id of boarding.data.who) {
      const m = this.g.family.find((m) => m.id === id);
      if (!m || boarding.arrived.has(id)) continue;
      if (m.task?.beatType !== 'boarding' && m.goal?.beatType !== 'boarding') {
        m.useObject(this.targets.car, 'prologue', { beatType: 'boarding', target: 'car', duration: 0.2 });
      }
    }
    if (boarding.data.who.every((id) => boarding.arrived.has(id))) {
      this.boarding = null; this.depart(boarding.data);
    }
  }
  updateAbsences() {
    for (const a of this.absences) {
      if (!a.pickupStarted && this.g.sim.min >= a.until - (a.minutes || 20)) {
        a.pickupStarted = true;
        const parent = this.g.family.find((m) => m.id === (a.pickup || 'elena'));
        if (parent) { parent.stopTask(true); parent.away = true; parent.obj.visible = false; }
        this.setCarAway(true);
        this.g.log(`${parent?.name || 'Elena'} drives to pick ${this.g.family.find((m) => m.id === a.who)?.name} up from camp.`);
      }
      if (!a.returned && this.g.sim.min >= a.until) {
        a.returned = true;
        this.setCarAway(false);
        for (const [i, id] of [a.who, a.pickup || 'elena'].entries()) {
          const m = this.g.family.find((m) => m.id === id);
          if (m) this.returnMember(m, i);
        }
        this.completed.add(a.id || 'camp-pickup');
        this.g.log(`${this.g.family.find((m) => m.id === a.pickup)?.name || 'Elena'} brings Theo home from camp.`, 'good');
        this.refreshObjectives();
      }
    }
  }
  setCarAway(away) {
    const car = this.targets.car, map = this.g.map;
    if (away && !this.carCells) {
      this.carCells = map.objCells(car).map(([x, y]) => {
        const i = map.idx(x, y), before = map.type[i]; map.type[i] = car.floor; return [i, before];
      });
    } else if (!away && this.carCells) {
      for (const [i, before] of this.carCells) map.type[i] = before;
      this.carCells = null;
      // Nobody gets trapped inside the returning car's collision cells.
      const occupied = new Set(map.objCells(car).map(([x, y]) => map.idx(x, y)));
      for (const [i, m] of this.g.family.filter((m) => !m.away && occupied.has(map.idx(...m.cell()))).entries()) this.returnMember(m, i);
    }
    car.away = away; if (car.mesh) car.mesh.visible = !away;
  }
  returnMember(m, i = 0) {
    const cells = this.g.map.useCells(this.targets.car), cell = cells[i % cells.length];
    m.stopTask(true); m.away = false; m.obj.visible = true;
    if (cell) m.pos.set(cell[0] + .5, 0, cell[1] + .5);
  }
  depart(d) {
    if (this.trip) return false;
    const crew = d.who.map((id) => this.g.family.find((m) => m.id === id)).filter(Boolean);
    this.trip = { crew, away: d.away, label: d.label || 'Trip',
      until: d.until !== undefined ? Math.max(this.g.sim.min + 1, (this.current.day - 1) * 1440 + d.until) : this.g.sim.min + (d.minutes || 0) };
    for (const m of crew) { m.stopTask(true); m.away = true; m.obj.visible = false; }
    this.setCarAway(true);
    this.g.log(d.label || `They drive to ${this.targets[d.target]?.name || 'town'}.`);
    return true;
  }
  restoreTrip() {
    if (!this.trip) return;
    this.setCarAway(false);
    const a = this.trip.away;
    this.trip.crew.forEach((m, i) => {
      if (a?.who === m.id) { m.away = true; m.obj.visible = false; }
      else this.returnMember(m, i);
    });
    if (a) this.absences.push({ ...a, until: (this.current.day - 1) * 1440 + a.until });
    this.g.log(a ? `${this.trip.crew.filter((m) => m.id !== a.who).map((m) => m.name).join(' and ')} is home. ${this.g.family.find((m) => m.id === a.who)?.name} is at day camp until ${this.clockAt(a.until)}.` : `${this.trip.crew.map((m) => m.name).join(' and ')} return home.`, 'good');
    this.trip = null;
  }
  pick(value) {
    const d = this.current?.do;
    if (d?.type !== 'choice' || !this.choiceReady || this.pending || this.thenStarted) return false;
    const option = d.options.find((o) => o.value === value);
    if (!option) return false;
    this.g.decisions[d.flag] = value;
    this.g.sim.step(option.minutes || 0);
    this.lines.push(...(option.lines || []));
    if (option.log) this.g.log(option.log);
    this.present(null); this.pending = true; return true;
  }
  sleep() {
    if (this.waiting || this.current?.do?.type !== 'sleep') return false;
    for (const m of this.g.family) { m.stopTask(true); m.goal = { type: 'sleep', obj: null }; m.startTask(); }
    this.pending = true; return true;
  }
  finish() {
    const b = this.current;
    for (const flag of b.sets || []) this.g.flags[flag] = true;
    this.completed.add(b.id); this.present(null);
    if (b.outage) { this.outage(); return; }
    if (b.do?.type === 'sleep') for (const m of this.g.family) { m.stopTask(true); m.needs.energy = 95; }
    if (b.do?.type === 'sleep' && this.beats[this.index + 1]) this.g.sim.min = beatMinute(this.beats[this.index + 1]);
    this.next();
  }
  outage(defaults = false) {
    if (this.g.sim.phase === 'outage') return false;
    this.restoreTrip(); this.setCarAway(false); this.boarding = null; this.present(null); this.aurora(false);
    const g = this.g;
    g.prologueSnapshot = { decisions: { ...g.decisions }, flags: { ...g.flags }, completed: [...this.completed] };
    g.decisions = { ...DEFAULT_DECISIONS, ...(defaults ? {} : g.decisions) };
    for (const m of g.family) { m.away = false; m.obj.visible = true; m.stopTask(true); m.pos.set(m.def.at[0] + 0.5, 0, m.def.at[1] + 0.5);
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
