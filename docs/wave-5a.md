# Wave 5a: endings (held out, didn't all make it) and the ending engine

Source: Daniel, 2026-11-13. The design is `docs/STORY.md` section 4, "How the endings feel and play". Read that
first; it is the brief for tone. Today the outage runs forever and only total loss ends the game. This wave adds
the ending engine, the held-out ending, the death treatment and the cards. Got out (pack, leave, trip, camp) is
wave 5b and plugs into the same engine.

| Part | Owner | Files |
|---|---|---|
| A. Engine and scenes | Codex | new `src/endings.js`, `src/main.js` (ending scene + cards + portrait), `src/ui.js` (grey portrait only), `src/family.js` (last words, death), `src/events.js` (kindness record), `src/data/events.js` (add `helped` fields only), `style.css` (ending cards only), tests |
| B. Card text | Claude (Sonnet) | new `src/data/endings.js` only, written against the schema below |

Codex: build against the schema with a small stub `src/data/endings.js` (3 or 4 cards per ending is enough for
tests). Claude replaces the stub's contents with the real text at merge. Don't write the final prose.

## A. Engine and scenes (Codex)

1. **Last words.** Every spoken line (beat lines, night lines, bubbles, event speech) records
   `member.lastWords = { text, day, min }`. Lines said by neighbours don't count.
2. **Kindness record.** `game.kindness = [{ who, day, how }]`. Push on: `decisions.walt === 'walked'` (who
   `walt`), Walt's solar circuit built (`walt`), and any event outcome whose effects carry `helped: '<who>'`. Add
   `helped` to `neighbor-at-door` watched (`who: 'cul-de-sac'`, the woman with the baby carrier) and
   `stranger-at-the-gate` watched (`who: 'stranger'`). The convoy's helper is the most recent named helper, with
   Walt or the cul-de-sac woman preferred over the stranger. No helper means the convoy still comes, and nobody
   climbs down.
3. **Death treatment.** A death never ends the game early (total loss still does, as now). From the moment of death:
   their portrait stays in the bar, greyed and not clickable, for the rest of the game; their figure is removed
   from the world after one log line (the existing death text); routines and beds are not reassigned, so the gap
   shows. Record `member.diedAt = { day, min }`.
4. **Held out trigger.** Day 11 at 6:20 AM, with the family still at the house and at least one member alive.
   Night events and the survival clock hold, as during the outage night (reuse that `night`-style interlude
   pattern from 4e: real-time, any click or key skips to the cards, and watched and skipped end in the same state).
5. **Held out scene (~40 s).** Sound cue as text first: log "A diesel engine somewhere on the main road, then a
   backup beeper." The first survivor to speak is Theo if alive ("Dad. Listen."). A Guard water truck (a simple
   box truck mesh, olive) backs into the street in front of the house. The family walks out to the kerb; two or
   three neighbour figures come out with jugs. If there is a helper, a figure climbs down from the cab, and a
   soldier line: "Somebody called this street in." A soldier hands the youngest survivor a bottle: log "It is
   cold. It is the first cold thing in eleven days." Then fade to cards.
6. **Cards.** `buildEnding(game, ENDINGS)` returns the ordered cards for the reached ending (schema below),
   shown one at a time on black (the outage card style), click to advance, then a final card with the title,
   "Day N" and a Restart button. Placeholders filled from state: `{dead}`, `{deadList}`, `{lastWords}`,
   `{lastWordsDay}`, `{missedDays}` (days between the latest death and the convoy, as a word: "one day", "three days"),
   `{helper}`, `{youngest}`, `{survivors}`, `{days}`.
7. **Playtest jump (for Daniel only).** URL `?ending=held_out` or `?ending=held_out&dead=jess` (comma list) starts at
   day 10, 11 PM with default stock and those members dead (each with a plausible last line), so Daniel can see the
   ending without playing 11 days. It's not shown in the UI.

Done when: tests cover last words, kindness record and helper choice, grey portrait state, the held out trigger
(watched and skipped converge), card filtering for each condition and every placeholder filled (no `{` left in any card
for the stub and for the real data file), and `?ending=` parsing; `node --test src/systems.test.js` passes.

## B. `src/data/endings.js` schema (shared contract)

```js
// Each card: { id, ending, order, when?, text }
//   ending  'held_out' | 'got_out' | 'any'      ('any' cards show for both)
//   order   number; cards sort by it
//   when    optional; every key must match:
//     anyDead: bool       noneDead: bool        dead: '<id>'       alive: '<id>'
//     helper: '<who>' | true | false            solar: bool        via: 'drive' | 'walk'   (got_out only)
//     missed: bool  (a death happened before the convoy; held_out only)
//   text    one or two short sentences; may use the placeholders in A6
// The builder keeps, for each order value, the first matching card (so put specific cards before general ones),
// and shows at most 7. Title cards: { id, ending, title: true, when?, text } (one per ending, plus the failure
// ending 'all_lost').
export const ENDINGS = [ ... ];
```

Wave 5b (got out) will add `via` cards and the pack/leave/trip/camp scene against the same engine.
