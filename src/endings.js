// Ending state and card assembly. Presentation lives in main.js; content is plain data.
export const CONVOY_MIN = 10 * 1440 + 6 * 60 + 20;
export const HELD_OUT_SECONDS = 40;
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
  if (p.get('ending') !== 'held_out') return null;
  return { ending: 'held_out', dead: [...new Set((p.get('dead') || '').split(',').filter((id) => ['marcus', 'elena', 'jess', 'theo'].includes(id)))] };
}
export function applyEndingJump(game, jump) {
  if (!jump) return false;
  game.skipToOutage();
  game.sim.min = 9 * 1440 + 23 * 60;
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
  constructor(game, { view = () => {}, cards = () => {} } = {}) { this.g = game; this.view = view; this.cards = cards; this.scene = null; }
  check() {
    const g = this.g;
    syncKindness(g);
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
  skip() { if (!this.scene) return false; this.update(HELD_OUT_SECONDS); return true; }
  finish() {
    const g = this.g;
    // Fixed final positions and speech/effects on both routes, independent of paths or speed.
    for (const m of g.family.filter((m) => !m.dead)) { const p = this.kerb(m); m.stopTask(true); m.pos.set(p.x, 0, p.z); }
    g.bubbles?.clear?.(); g.over = true; g.sim.speed = 0; g.cutting = false; this.scene = null;
    this.cards();
  }
  allLost() {
    const g = this.g;
    g.ending = { kind: 'all_lost', day: g.sim.day, min: g.sim.min };
    g.over = true; g.sim.speed = 0; this.cards();
  }
}
