import { PER_L, makeEntry } from './inventory.js';
// Ending state and card assembly. Presentation lives in main.js; content is plain data.
export const CONVOY_MIN = 10 * 1440 + 6 * 60 + 20;
export const HELD_OUT_SECONDS = 40;
export const DEPARTURE_SECONDS = 30;
export const FRONT_DOOR = { x: 27.5, z: 16.5 };

export function departureVia(game) { return game.systems.car.fuelL >= 8 ? 'drive' : 'walk'; }
export function walkingTime(game) { return game.sim.hour >= 20 || game.sim.hour < 4; }
export function departurePressure(game) {
  const home = game.map.objects.filter((o) => o.home).flatMap((o) => [...(o.items || []), ...(o.unseen || [])]);
  const stock = [...home, ...game.family.flatMap((m) => m.inv)];
  // The garage's guaranteed jugs exist even before their first search generates entries.
  const shelf = game.map.objects.find((o) => o.home && o.ch === 'S' && o.x === 35);
  const pendingJugs = shelf && !shelf.questStock && game.decisions?.jugs === 'shelf'
    ? 10 * makeEntry('water_gallon').left + 4 * makeEntry('water_gallon_half').left : 0;
  const liters = game.sim.tubL + pendingJugs + stock.reduce((sum, e) => sum + (PER_L[e.id]?.hydration >= 35 ? e.left || 0 : 0), 0);
  return liters < 12 - 1e-9 || (game.family.some((m) => m.id === 'theo' && !m.dead)
    && !stock.some((e) => e.id === 'inhaler_spare' && e.n > 0) && !game.systems.solar.built)
    || game.tubThiefDay >= 4;
}
const helperNames = { walt: "Walt's daughter", 'cul-de-sac': 'the woman from the cul-de-sac', stranger: 'the stranger' };

export function recordWords(game, who, text) {
  const m = game.family.find((m) => m.id === who);
  if (!m || m.dead || !text) return false;
  m.lastWords = { text: String(text), day: game.sim.day, min: game.sim.min };
  return true;
}
export function recordKindness(game, who, how) {
  (game.kindness ||= []).push({ who, day: game.sim.day, how });
}
export function syncKindness(game) {
  game.kindness ||= [];
  if (game.decisions?.walt === 'walked' && !game.kindness.some((k) => k.how === 'walked')) {
    // This happened in the prologue, even when the player skipped it.
    game.kindness.push({ who: 'walt', day: -1, how: 'walked' });
  }
  if (game.systems?.solar.built && !game.kindness.some((k) => k.how === 'solar')) recordKindness(game, 'walt', 'solar');
}
export function chooseHelper(game) {
  const records = [...(game.kindness || [])].reverse();
  return records.find((k) => ['walt', 'cul-de-sac'].includes(k.who))?.who || records[0]?.who || null;
}
// Install at the game boundary: all current speech paths log quoted family speech;
// direct bubbles are recorded before visibility checks, including off-screen speakers.
export function installEndingTracking(game) {
  if (game.endingTracking) return;
  game.endingTracking = true;
  game.kindness ||= [];
  const log = game.log.bind(game);
  game.log = (text, tone) => {
    const spoken = String(text).match(/^([^:]+):\s*["“]([\s\S]*?)["”](?:\s|$)/);
    if (spoken) {
      const m = game.family.find((m) => m.name === spoken[1]);
      if (m) recordWords(game, m.id, spoken[2]);
    }
    return log(text, tone);
  };
  if (game.bubbles) {
    const say = game.bubbles.say.bind(game.bubbles);
    game.bubbles.say = (who, text, opts) => { recordWords(game, who, text); return say(who, text, opts); };
  }
  if (game.systems) {
    const complete = game.systems.complete.bind(game.systems);
    game.systems.complete = (...args) => { const result = complete(...args); syncKindness(game); return result; };
  }
}

const list = (names) => names.length < 2 ? names[0] || '' : names.length === 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ', and ' + names.at(-1);
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
export function endingContext(game) {
  const end = game.ending || {}, kind = end.kind || (game.family.every((m) => m.dead) ? 'all_lost' : 'held_out');
  const dead = game.family.filter((m) => m.dead), alive = game.family.filter((m) => !m.dead);
  const latest = [...dead].sort((a, b) => (b.diedAt?.min ?? -Infinity) - (a.diedAt?.min ?? -Infinity))[0];
  const min = end.min ?? game.sim.min, day = end.day ?? game.sim.day;
  const missed = kind === 'held_out' && !!latest?.diedAt && latest.diedAt.min < min;
  const gap = latest?.diedAt ? Math.max(0, day - latest.diedAt.day) : 0;
  const helper = chooseHelper(game), youngest = [...alive].sort((a, b) => a.age - b.age)[0];
  return { kind, dead, alive, helper, missed, via: end.via, solar: !!game.systems?.solar.built,
    values: { dead: latest?.name || '', deadList: list(dead.map((m) => m.name)),
      lastWords: latest?.lastWords?.text || '', lastWordsDay: latest?.lastWords ? String(latest.lastWords.day) : '',
      missedDays: gap ? `${words[gap] || gap} ${gap === 1 ? 'day' : 'days'}` : 'less than one day',
      helper: helperNames[helper] || helper || '', youngest: youngest?.name || '',
      survivors: list(alive.map((m) => m.name)), days: String(day) } };
}
export function endingMatches(context, when = {}) {
  return Object.entries(when).every(([key, value]) => {
    switch (key) {
      case 'anyDead': return Boolean(context.dead.length) === value;
      case 'noneDead': return (context.dead.length === 0) === value;
      case 'dead': return context.dead.some((m) => m.id === value);
      case 'alive': return context.alive.some((m) => m.id === value);
      case 'helper': return typeof value === 'boolean' ? Boolean(context.helper) === value : context.helper === value;
      case 'solar': return context.solar === value;
      case 'via': return context.kind === 'got_out' && context.via === value;
      case 'missed': return context.kind === 'held_out' && context.missed === value;
      default: return false;
    }
  });
}
// Returns up to seven narrative cards, then the first matching title card.
export function buildEnding(game, ENDINGS) {
  const ctx = endingContext(game);
  const matching = ENDINGS.filter((c) => (c.ending === ctx.kind || c.ending === 'any') && endingMatches(ctx, c.when));
  const orders = new Set();
  const cards = matching.filter((c) => !c.title).sort((a, b) => a.order - b.order).filter((c) => {
    if (orders.has(c.order)) return false;
    orders.add(c.order); return true;
  }).slice(0, 7);
  const title = matching.find((c) => c.title);
  if (title) cards.push(title);
  return cards.map((c) => ({ ...c, text: c.text.replace(/\{([^{}]+)\}/g, (_, key) => {
    if (!(key in ctx.values)) throw new Error(`Unknown ending placeholder: ${key}`);
    return ctx.values[key];
  }) }));
}
export function parseEndingJump(search) {
  const p = new URLSearchParams(search);
  const ending = p.get('ending');
  if (!['held_out', 'got_out'].includes(ending)) return null;
  return { ending, ...(ending === 'got_out' ? { via: p.get('via') === 'drive' ? 'drive' : 'walk' } : {}), dead: [...new Set((p.get('dead') || '').split(',').filter((id) => ['marcus', 'elena', 'jess', 'theo'].includes(id)))] };
}
export function applyEndingJump(game, jump) {
  if (!jump) return false;
  game.skipToOutage();
  game.sim.min = jump.ending === 'got_out' ? 5 * 1440 + 19 * 60 : 9 * 1440 + 23 * 60;
  if (jump.ending === 'got_out') {
    game.systems.heard.add('fairgrounds-camp'); game.leaveOpen = true;
    game.systems.car.fuelL = jump.via === 'drive' ? 20 : 4;
  }
  game.sim.tubL = game.sim.TUB_MAX;
  for (const m of game.family) {
    if (!jump.dead.includes(m.id)) continue;
    recordWords(game, m.id, { marcus: "I'll be here.", elena: 'Try to sleep.', jess: "I'm right here.", theo: 'Stay with me.' }[m.id]);
    m.die('');
  }
  // The prologue scheduler must not replay ten days of historical events.
  if (game.nightEvents) {
    game.nightEvents.nextAt = game.sim.min;
    game.nightEvents.advance();
    while (game.nightEvents.nextAt <= game.sim.min) game.nightEvents.advance();
  }
  syncKindness(game);
  return true;
}

export class EndingEngine {
  constructor(game, { view = () => {}, cards = () => {} } = {}) { this.g = game; this.view = view; this.cards = cards; this.scene = null; this.trackNightEvents(); }
  trackNightEvents() {
    const g = this.g, events = g.nightEvents;
    if (!events || events.departureTracking) return;
    events.departureTracking = true;
    const run = events.run.bind(events);
    events.run = (event, ...args) => {
      const result = run(event, ...args);
      if (result && event.id === 'tub-thief') g.tubThiefDay = g.sim.day;
      return result;
    };
  }
  checkDeparture() {
    const g = this.g;
    this.trackNightEvents();
    if (g.over || g.ending || g.departed || g.sim.phase !== 'outage') return false;
    if (g.departureArmed && walkingTime(g)) return this.depart();
    const hour = Math.floor(g.sim.min / 60);
    if (this.pressureHour === hour) return false;
    this.pressureHour = hour;
    if (!g.leaveOpen && g.sim.day >= 6 && g.sim.min >= 5 * 1440 + 720
      && g.systems.heard.has('fairgrounds-camp') && departurePressure(g)) {
      g.leaveOpen = true;
      const text = "The radio said the fairgrounds. We can't stay here.";
      g.log(`Elena: "${text}"`); g.bubbles?.say('elena', text);
      g.log('Leaving is possible now: open the House panel at the top, or click the front door.');
    }
    return false;
  }
  chooseDeparture() {
    const g = this.g;
    if (!g.leaveOpen || g.ending || g.over) return false;
    if (departureVia(g) === 'walk' && !walkingTime(g)) { g.departureArmed = true; return 'armed'; }
    return this.depart();
  }
  cancelDeparture() { this.g.departureArmed = false; }
  depart() {
    const g = this.g, alive = g.family.filter((m) => !m.dead);
    if (g.ending || g.departed || !g.leaveOpen || !alive.length || alive.some((m) => m.away)) return false;
    const via = departureVia(g);
    if (via === 'walk' && !walkingTime(g)) return false;
    g.departureArmed = false; g.departed = true;
    g.departedWith = Object.fromEntries(alive.map((m) => [m.id, m.inv.map((e) => ({ ...e }))]));
    g.ending = { kind: 'got_out', day: g.sim.day + (via === 'walk' ? 2 : 0), min: g.sim.min, via };
    g.systems.car.running = false;
    if (via === 'drive') g.systems.departureTrip();
    g.cutting = true; g.bubbles?.clear?.();
    for (const m of alive) { m.stopTask(true); m.wake(true); m.autonomy = false; m.play('idle'); }
    this.scene = { elapsed: 0, fired: new Set(), departure: true };
    this.update(0); return true;
  }
  check() {
    const g = this.g;
    syncKindness(g);
    if (this.checkDeparture()) return true;
    if (g.over || g.ending || g.sim.phase !== 'outage' || g.sim.min < CONVOY_MIN
      || g.departed || !g.family.some((m) => !m.dead) || g.family.some((m) => !m.dead && m.away)) return false;
    this.scene = { elapsed: 0, fired: new Set() };
    g.ending = { kind: 'held_out', day: g.sim.day, min: g.sim.min };
    g.cutting = true; g.bubbles?.clear?.();
    for (const m of g.family.filter((m) => !m.dead)) { m.stopTask(true); m.wake(true); m.autonomy = false; }
    this.update(0);
    return true;
  }
  kerb(m) { return { x: 26.5 + this.g.family.indexOf(m) * 1.5, z: 19.5 }; }
  update(dtReal) {
    if (!this.scene) return;
    const n = this.scene, g = this.g;
    if (n.departure) { this.updateDeparture(dtReal); return; }
    n.elapsed = Math.min(HELD_OUT_SECONDS, n.elapsed + dtReal);
    const at = (t, fn) => { if (n.elapsed >= t && !n.fired.has(t)) { n.fired.add(t); fn(); } };
    at(0, () => g.log('A diesel engine somewhere on the main road, then a backup beeper.'));
    at(4, () => {
      const m = g.family.find((m) => m.id === 'theo' && !m.dead) || [...g.family].filter((m) => !m.dead).sort((a, b) => a.age - b.age)[0];
      const text = m.id === 'theo' ? 'Dad. Listen.' : 'Listen.';
      g.log(`${m.name}: "${text}"`); g.bubbles?.say(m.id, text);
    });
    at(12, () => { for (const m of g.family.filter((m) => !m.dead)) { const p = this.kerb(m); m.walkTo(Math.floor(p.x), Math.floor(p.z)); } });
    at(23, () => { if (chooseHelper(g)) g.log('Soldier: "Somebody called this street in."'); });
    at(30, () => g.log('It is cold. It is the first cold thing in eleven days.'));
    this.view({ elapsed: n.elapsed, helper: chooseHelper(g), youngest: endingContext(g).values.youngest, done: n.elapsed >= HELD_OUT_SECONDS });
    if (n.elapsed >= HELD_OUT_SECONDS) this.finish();
  }
  updateDeparture(dtReal) {
    const n = this.scene, g = this.g, via = g.ending.via;
    n.elapsed = Math.min(DEPARTURE_SECONDS, n.elapsed + dtReal);
    const alive = g.family.filter((m) => !m.dead);
    const at = (t, fn) => { if (n.elapsed >= t && !n.fired.has(t)) { n.fired.add(t); fn(); } };
    at(0, () => alive.forEach((m, i) => {
      // Scripted gathering also brings collapsed survivors: the trip cannot take a life.
      m.pos.set(FRONT_DOOR.x + i * .55, 0, FRONT_DOOR.z);
    }));
    at(7, () => {
      const lock = alive.find((m) => m.id === 'marcus') || [...alive].sort((a, b) => b.age - a.age)[0];
      g.log(lock.id === 'marcus' ? 'Marcus locks the door. Out of habit.' : `${lock.name} locks the door.`);
    });
    at(12, () => {
      if (via === 'walk') g.log('They take the canal path. Nobody talks.');
      else if (g.systems.car.departureFuelL < 15) g.log('The needle sits just above E.');
    });
    at(23, () => {
      if (via !== 'drive') return;
      const child = alive.find((m) => m.id === 'theo') || [...alive].sort((a, b) => a.age - b.age)[0];
      g.log(`A Guard checkpoint on 27th Avenue. A soldier looks into the back seat, at ${child.name}, and waves them through.`);
    });
    this.view({ departure: true, elapsed: n.elapsed, via, done: n.elapsed >= DEPARTURE_SECONDS });
    if (n.elapsed >= DEPARTURE_SECONDS) this.finish();
  }
  skip() { if (!this.scene) return false; this.update(HELD_OUT_SECONDS); return true; }
  finish() {
    const g = this.g;
    // Fixed final positions and speech/effects on both routes, independent of paths or speed.
    for (const m of g.family.filter((m) => !m.dead)) { const p = this.scene.departure ? { x: this.g.map.W + 2, z: 21 + this.g.family.indexOf(m) * .5 } : this.kerb(m); m.stopTask(true); m.pos.set(p.x, 0, p.z); }
    g.bubbles?.clear?.(); g.over = true; g.sim.speed = 0; g.cutting = false; this.scene = null;
    this.cards();
  }
  allLost() {
    const g = this.g;
    g.ending = { kind: 'all_lost', day: g.sim.day, min: g.sim.min };
    g.over = true; g.sim.speed = 0; this.cards();
  }
}
