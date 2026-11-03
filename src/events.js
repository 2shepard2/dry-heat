// Night-event data stays separate so content can grow without changing the interpreter.
import { NIGHT_EVENTS } from './data/events.js';
import { T } from './map.js';

const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clamp = (v, max = 100) => Math.max(0, Math.min(max, v));
const parent = (m) => !m.child && !m.teen;
const targets = ['all', 'parents', 'kids', 'jess', 'theo'];
const warn = (id, message) => console.warn(`Night event ${id || '(no id)'}: ${message}`);

// Invalid data is rejected before any effects run. Unknown effect keys alone are ignored.
function validEvent(e) {
  if (!record(e) || typeof e.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id)
    || !Number.isFinite(e.weight) || e.weight <= 0 || !Number.isInteger(e.minDay) || e.minDay < 1
    || (e.once !== undefined && typeof e.once !== 'boolean') || typeof e.text !== 'string') return false;
  if (e.needs !== undefined) {
    if (!record(e.needs)) return false;
    for (const [k, v] of Object.entries(e.needs)) {
      if (k === 'tubMinL' ? !Number.isFinite(v) || v < 0
        : ['kidAwake', 'carryingFood'].includes(k) ? v !== true : true) return false;
    }
  }
  for (const branch of [e.watched, e.unwatched]) {
    if (!record(branch) || typeof branch.text !== 'string' || !record(branch.effects)) return false;
    for (const [k, v] of Object.entries(branch.effects)) {
      if (['tubL', 'loseFood'].includes(k) && !Number.isFinite(v)) return false;
      if (k === 'theoWanders' && v !== true) return false;
      if (k === 'wake' && !['all', 'kids', 'parents'].includes(v)) return false;
      if (k === 'log' && !['warn', 'bad'].includes(v)) return false;
      if (k === 'morale' || k === 'energy') {
        if (!record(v) || Object.entries(v).some(([who, delta]) =>
          !(targets.includes(who) || k === 'energy' && who === 'watcher') || !Number.isFinite(delta))) return false;
      }
    }
  }
  return true;
}

export class NightEvents {
  constructor(game, events = NIGHT_EVENTS) {
    this.game = game;
    this.used = new Set();
    this.pending = [];
    this.events = [];
    const ids = new Set();
    for (const e of events) {
      if (!validEvent(e) || ids.has(e.id)) { warn(e?.id, 'malformed or duplicate event skipped'); continue; }
      ids.add(e.id);
      this.events.push(e);
    }
    // Fixed 90-minute slots within each 22:00–05:00 night; no daytime rolls.
    const now = game.sim.min;
    const start = Math.floor((now - 22 * 60) / 1440) * 1440 + 22 * 60;
    this.nextAt = start + 90;
    while (this.nextAt <= now) this.advance();
  }

  advance() {
    this.nextAt += 90;
    const minute = ((this.nextAt % 1440) + 1440) % 1440;
    if (minute >= 300 && minute < 1320) this.nextAt = Math.floor(this.nextAt / 1440) * 1440 + 1320 + 90;
  }

  awake() { return this.game.family.some((m) => !m.dead && !m.asleep && !m.collapsed); }
  watcher() { return this.game.family.find((m) => parent(m) && m.isWatching()); }
  group(who, watcher) {
    return this.game.family.filter((m) => !m.dead && (who === 'all' || who === m.id
      || who === 'parents' && parent(m) || who === 'kids' && !parent(m) || who === 'watcher' && m === watcher));
  }
  eligible(e) {
    const g = this.game, n = e.needs || {};
    return g.sim.day >= e.minDay && !(e.once && this.used.has(e.id))
      && (n.tubMinL === undefined || g.sim.tubL >= n.tubMinL)
      && (!n.kidAwake || this.group('kids').some((m) => !m.asleep && !m.collapsed))
      && (!n.carryingFood || g.family.some((m) => !m.dead && m.inv.some((item) => this.food(item))));
  }
  food(e) { return this.game.ITEMS[e.id]?.cat === 'food' && e.n > 0; }

  flush() {
    if (!this.awake()) return;
    for (const [text, tone] of this.pending.splice(0)) this.game.log(text, tone);
  }
  update() {
    this.flush();
    while (this.game.sim.min >= this.nextAt) {
      const available = this.events.filter((e) => this.eligible(e));
      if (available.length) {
        // Normalize first: even very large finite weights cannot overflow the total.
        const max = Math.max(...available.map((e) => e.weight));
        let r = this.game.rng.next() * available.reduce((sum, e) => sum + e.weight / max, 0);
        const chosen = available.find((e) => (r -= e.weight / max) < 0) || available.at(-1);
        this.run(chosen, this.watcher());
      }
      this.advance();
    }
  }

  // Explicit test hook bypasses scheduling, needs, minDay and once. `true` still needs
  // a living parent to receive watcher energy; a real roll always uses an actual watch.
  trigger(id, watched) {
    const e = this.events.find((event) => event.id === id);
    if (!e) { warn(id, 'unknown event skipped'); return false; }
    const watcher = watched ? this.watcher() || this.group('parents').find((m) => m.canAct()) : null;
    return this.run(e, watcher, Boolean(watched));
  }
  run(e, watcher, watched = Boolean(watcher)) {
    if (!validEvent(e)) { warn(e?.id, 'malformed event skipped'); return false; }
    const branch = watched ? e.watched : e.unwatched;
    this.used.add(e.id);
    this.pending.push([e.text, ''], [branch.text, branch.effects.log || '']);
    this.flush();
    this.effects(e.id, branch.effects, watcher);
    this.flush();
    return true;
  }
  effects(id, effects, watcher) {
    const g = this.game;
    for (const [key, value] of Object.entries(effects)) {
      switch (key) {
        case 'tubL': g.sim.tubL = clamp(g.sim.tubL + value, g.sim.TUB_MAX); break;
        case 'morale':
        case 'energy':
          for (const [who, delta] of Object.entries(value)) {
            for (const m of this.group(who, watcher)) m.needs[key] = clamp(m.needs[key] + delta);
          }
          break;
        case 'wake':
          for (const m of this.group(value)) if (m.asleep) m.stopTask(true);
          break;
        case 'loseFood': this.loseFood(value); break;
        case 'theoWanders': this.wander(); break;
        case 'log': break; // Used for the result line above.
        default: warn(id, `unknown effect "${key}" skipped`);
      }
    }
  }
  loseFood(n) {
    const g = this.game, home = g.map.lots.indexOf(g.map.home);
    // Bags physically at home and generated container contents only. Do not roll
    // unsearched loot early or steal supplies from someone across the street.
    const inventories = [
      ...g.family.filter((m) => g.map.houseOf(...m.cell()) === home).map((m) => m.inv),
      ...g.map.objects.filter((o) => o.home).map((o) => o.items || []),
    ];
    const stacks = inventories.flatMap((inv) => inv.filter((e) => this.food(e)).map((e) => ({ inv, e })));
    const total = stacks.reduce((sum, { e }) => sum + e.n, 0);
    let left = Math.min(Math.max(0, Math.floor(n)), total);
    while (left > 0 && stacks.length) {
      const i = Math.floor(g.rng.next() * stacks.length), { inv, e } = stacks[i];
      e.n = Math.max(0, e.n - 1);
      if (!e.n) { inv.splice(inv.indexOf(e), 1); stacks.splice(i, 1); }
      left--;
    }
  }
  wander() {
    const g = this.game, theo = g.family.find((m) => m.id === 'theo');
    if (!theo?.canAct() || theo.flags.wandered) return;
    const home = g.map.home, spots = [];
    // The home's back yard is on the far side of its north wall (not the front drive).
    for (let y = 0; y < home.house.y0; y++) for (let x = home.house.x0; x <= home.house.x1; x++) {
      if (g.map.walkable(x, y) && g.map.get(x, y) === T.YARD) spots.push([x, y]);
    }
    if (!spots.length) { warn('theoWanders', 'no back-yard standing spot'); return; }
    const [x, y] = spots[Math.floor(g.rng.next() * spots.length)];
    theo.stopTask(true);
    theo.pos.set(x + 0.5, 0, y + 0.5);
    theo.mode = { type: 'stay' };
    theo.flags.wandered = true;
  }
}
