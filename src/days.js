import { DAYS } from './data/days.js';
import { ITEMS } from './inventory.js';

const WATER = new Set(['water_case', 'water_bottle', 'water_bottle_half', 'water_gallon',
  'water_gallon_half', 'water_cooler_jug', 'ice_bag', 'bucket_5gal', 'cooler']);

// Count discovered household stock and carried water once, never unseen loot,
// neighbours' supplies, pool water, milk or juice.
export function drinkingWater(game) {
  const inventories = new Set([
    ...game.map.objects.filter((o) => o.home).map((o) => o.items),
    ...game.family.map((m) => m.inv),
  ]);
  const entries = new Set([...inventories].flatMap((inv) => inv || []));
  return game.sim.tubL + [...entries].reduce((sum, e) => {
    const item = ITEMS[e.id];
    return sum + (WATER.has(e.id) ? (e.left ?? (item.liters || 0) * e.n) : 0);
  }, 0);
}

export function dayCheck(game, name, day) {
  const [key, arg] = (name || '').split(':');
  const s = game.systems;
  switch (key) {
    case 'anyDead': return game.family.some((m) => m.dead);
    case 'aliveAtNight': return game.sim.min >= (day - 1) * 1440 + 20 * 60 && game.family.every((m) => !m.dead);
    case 'waterAbove': return drinkingWater(game) >= Number(arg);
    case 'tubAbove': return game.sim.tubL >= Number(arg);
    case 'shadeBuilt': return game.sim.shadedWindows > 0 || !!s.tarp;
    case 'solarBuilt': return !!s.solar.built;
    case 'waltVisited': return s.walt.lastVisit >= (day - 1) * 1440 + 6 * 60 && s.walt.lastVisit < (day - 1) * 1440 + 11 * 60;
    case 'nebulizer': return s.solar.treatedDay === day;
    case 'heardRadio': return s.heard.has(arg);
    default: return false;
  }
}

export class DailyObjectives {
  constructor(game) { this.g = game; this.reset(); }
  reset() { this.day = 1; }
  update() {
    const g = this.g;
    if (g.sim.phase !== 'outage' || g.departed || g.over || g.ending) return;
    const day = Math.floor((g.sim.min - 6 * 60) / 1440) + 1;
    if (day < 2) return;
    if (day !== this.day) {
      this.day = day;
      g.objectives = (DAYS[day] || []).map((o) => ({ ...o }));
      if (DAYS[day]) g.log(`Day ${day}.`);
    }
    if (!DAYS[day]) return;
    // Drop completed infrastructure instructions, including Walt visits, on
    // installation and immediately when a circuit is finished later that day.
    if (g.systems.solar.built) g.objectives = g.objectives.filter((o) => !['solarBuilt', 'waltVisited'].includes(o.check));
    for (const o of g.objectives) {
      if (o.done || o.failed) continue;
      if (o.fail && dayCheck(g, o.fail, day)) g.objective(o.id, 'failed');
      else if (o.check && dayCheck(g, o.check, day)) g.objective(o.id, 'done');
    }
  }
}

// The prologue interpreter is already updated after the simulation each frame,
// including during the outage. Keep the single boot hook out of ending code.
export function installDailyObjectives(game) {
  if (game.days) return game.days;
  const days = game.days = new DailyObjectives(game);
  const update = game.beats.update.bind(game.beats);
  game.beats.update = (...args) => { const result = update(...args); days.update(); return result; };
  return days;
}
