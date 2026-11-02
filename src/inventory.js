// Inventory stacks and loot rolls. An entry is { id, n } or, for bulk liquids, { id, n: 1, left: liters }.
import { ITEMS, LOOT } from './data/items.js';
import { POWER_OUT_MIN } from './sim.js';

// Bulk liquids are drunk a liter at a time and can be refilled from the tub.
export const PER_L = {
  water_case: { hydration: 35 }, water_gallon: { hydration: 35 }, water_gallon_half: { hydration: 35 },
  water_cooler_jug: { hydration: 35 }, ice_bag: { hydration: 35 }, orange_juice: { hydration: 12, food: 4 },
  milk_gallon: { hydration: 8, food: 5 }, bucket_5gal: { hydration: 35 }, cooler: { hydration: 35 },
};
const EMPTY_KG = {
  water_case: 0.5, water_gallon: 0.1, water_gallon_half: 0.1, water_cooler_jug: 0.7, ice_bag: 0.05,
  orange_juice: 0.1, milk_gallon: 0.1, bucket_5gal: 0.9, cooler: 2.5,
};
const REFILLABLE = new Set(['water_gallon', 'water_gallon_half', 'water_cooler_jug', 'bucket_5gal', 'cooler']);
const STARTS_EMPTY = new Set(['bucket_5gal', 'cooler']);

export const capOf = (id) => (id === 'cooler' ? 40 : ITEMS[id].liters || 0);
export const isLiquid = (e) => e.left !== undefined;
export const refillable = (e) => isLiquid(e) && REFILLABLE.has(e.id) && e.left < capOf(e.id) - 0.05;

export function makeEntry(id, n = 1) {
  if (PER_L[id]) return { id, n: 1, left: STARTS_EMPTY.has(id) ? 0 : capOf(id) };
  return { id, n };
}

export const entryKg = (e) => (isLiquid(e) ? EMPTY_KG[e.id] + e.left : ITEMS[e.id].kg * e.n);
export const invKg = (inv) => inv.reduce((s, e) => s + entryKg(e), 0);

export function addEntry(inv, e) {
  if (!isLiquid(e)) {
    const same = inv.find((x) => x.id === e.id && !isLiquid(x));
    if (same) { same.n += e.n; return; }
  }
  inv.push(e);
}

// Fridge and freezer contents started warming when the power died.
export function isSpoiled(e, sim) {
  if (e.id === 'ice_bag') return false; // melted ice is still water
  const s = ITEMS[e.id].spoilsH;
  return !!s && (sim.min - POWER_OUT_MIN) / 60 > s;
}

export function label(e, sim) {
  const it = ITEMS[e.id];
  let s = it.name;
  if (isLiquid(e)) s += ` (${e.left.toFixed(1)} of ${capOf(e.id).toFixed(1)} L)`;
  else if (e.n > 1) s += ` ×${e.n}`;
  if (isSpoiled(e, sim)) s += ' (spoiled)';
  return s;
}

export function rollLoot(obj, rng, lotId) {
  const items = [];
  const picked = lotId === 'se' ? 0.35 : 1; // the vacant rental was cleaned out before anyone left
  for (const table of obj.loot || []) {
    const entries = LOOT[table];
    if (!entries) continue;
    let rolls = rng.int(1, 4) + (obj.home ? 1 : 0);
    if (rng.next() > picked) rolls = rng.int(0, 1);
    for (let i = 0; i < rolls; i++) {
      const e = rng.weighted(entries);
      const n = rng.int(e.min ?? 1, e.max ?? 1);
      if (PER_L[e.id]) for (let k = 0; k < n; k++) addEntry(items, makeEntry(e.id));
      else addEntry(items, makeEntry(e.id, n));
    }
  }
  return items;
}

export { ITEMS };
