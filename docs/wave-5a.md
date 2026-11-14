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

## 5a contracts

- `buildEnding(game, ENDINGS)` in `src/endings.js` returns a new array of matching card objects with their `text` interpolated. It reads `game.ending = { kind, day, min, via? }`, where `kind` is `held_out`, `got_out`, or `all_lost`; `min` uses the simulation's absolute-minute clock. With no reached state it infers `all_lost` for total loss, otherwise `held_out`. This inference supports isolated content tests; gameplay always sets the reached state explicitly.
- Cards with `ending: 'any'` join the reached ending's cards. Narrative cards sort by numeric `order`, stably: at each order the first matching data entry wins. The result contains at most seven narrative cards, followed by the first matching `title: true` card. A title does not require `order`. Inputs are not mutated. Unknown placeholders throw, and unknown condition keys reject the card, so data mistakes fail verification.
- All `when` keys must match: `anyDead` and `noneDead` are booleans; `dead` and `alive` are member ids; `helper` is a helper id or a boolean; `solar` tests the built circuit, not whether the fan was placed; `via` is `drive` or `walk` and only matches `got_out`; `missed` is a boolean and only matches `held_out`. `missed` means the latest death's absolute minute precedes the reached convoy minute, including a death earlier that same morning.
- Placeholders: `{dead}` names the latest person to die; `{deadList}` lists all losses in family order; `{lastWords}` and `{lastWordsDay}` use that latest person's actual final speech and its numeric day. `{missedDays}` compares the death day with the convoy day: `one day`, `three days`, or `less than one day` for a same-day loss. `{helper}` names the selected helper (`walt` becomes `Walt's daughter`, `cul-de-sac` becomes `the woman from the cul-de-sac`, `stranger` becomes `the stranger`). `{youngest}` names the youngest survivor; `{survivors}` lists survivors in family order; `{days}` is the reached day as a number. Unavailable names/speech interpolate to an empty string. The stub is explicitly marked for replacement; no final narrative prose was authored.
- `installEndingTracking(game)` is installed after bubbles and the beat interpreter exist. It records family speech at the shared quoted-log and direct-bubble boundaries, before bubble visibility checks, without changing the owned beat/bubble/system modules. Neighbour speech and speech attributed to dead members cannot replace `member.lastWords = { text, day, min }`. All current beat, chore, night, system, warning, refusal and event log paths share these boundaries. `recordWords(game, who, text)` is available for future explicit speech paths.
- `game.kindness` is an ordered array of `{ who, day, how }`. `syncKindness(game)` captures the walked Walt decision once (`day: -1`, `how: 'walked'`, including skipped-prologue defaults), and the successfully built circuit once (`how: 'solar'`, on the build day). It runs during normal ending checks and immediately after system completions; the outage cut also synchronizes defaults. Night-event `effects.helped` appends immediately, with the event id as `how`. Only the watched branches of the two specified events gained `helped`. `chooseHelper(game)` takes the most recent Walt/cul-de-sac record, otherwise the most recent other helper, otherwise `null`.
- Death is idempotent: `member.diedAt = { day, min }`, the existing death log once, then `obj.visible = false`. The member remains in `game.family`; its portrait uses the existing grey styling and a disabled button, with no portrait/menu actions or world tag. Dead members leave selection/detail state. The previous/current bed is reserved, and the children's personal beds remain reserved even if they had not slept there. Routine spots remain keyed by member; no survivor takes over a dead member's routine. Only total loss calls `EndingEngine.allLost()` and freezes into the failure title card.
- `EndingEngine.check()` starts held out at absolute minute `14780` (day 11, 06:20) or the first eligible later check. It requires outage, a living family, no `game.departed`, and no living off-map (`away`) member. `departed` is reserved for wave 5b. Nearby scavenging is still holding out on this block. The ordinary frame step is capped at the convoy minute, then the scene bypasses survival, chores, systems and night-event scheduling. Members animate/walk with zero body minutes and fixed real-time speed, even if the player was paused or fast-forwarding. This does not add a got-out trigger or scene.
- The scene is 40 real seconds: engine/beeper text at 0, Theo's `Dad. Listen.` at 4 (youngest survivor says `Listen.` if Theo died), truck arrives from 7–17, family walks to the kerb at 12, neighbours emerge from 14, helper climbs down from 20–23 if one exists, soldier line at 23, cold bottle at 30, optional existing solar-fan framing from 34, fade from 37. `skip()` runs the same milestones once, then converges survivor positions, speech, logs, cards and frozen clock/state. Any pointer/key input skips and is consumed; the generated pointer click cannot advance the first card. Cards advance by click/Continue, followed by title, `Day N`, Restart. Restart removes only the ending/dead URL parameters.
- Playtest URL: `?ending=held_out` starts automatically at day 10, 23:00, with skipped-prologue default stock and a full tub. Optional `&dead=jess` or `&dead=jess,theo` seeds those deaths and short plausible last lines at that time. Supported ids are `marcus,elena,jess,theo`; duplicates/unknown ids are ignored. Any unsupported/missing `ending` disables the jump. All four deaths use the normal total-loss route. `parseEndingJump(search)` returns `{ ending: 'held_out', dead: [...] }` or `null`; `applyEndingJump(game, jump)` seeds through the normal outage/death hooks and resets historical event slots. There is no jump UI. Use the ordinary speed controls to reach dawn faster.

Validation: Node 22, `node --test src/systems.test.js`: **75 tests, 75 pass, 0 fail** (64 existing + 11 new). New coverage includes speech boundaries, real solar/event kindness hooks, helper preference, death/portrait DOM state, trigger guards, watched/skip convergence at five skip points across survivor/helper variants, failure title, every schema condition, stable ordering/cap, every placeholder, all 16 family survival combinations against the imported data file, and URL parsing/application. The imported-data test remains in place for Claude's real text replacement. Syntax checks and `git diff --check` pass.

Browser-only questions for merge: is the reversing truck clearly framed; do the helper descent, jugs and bottle read at game scale; is the solar-fan final shot legible; do the fade/cards feel paced; do real pointer/key skips consume their generated inputs and preserve the first card; is the dead portrait clearly grey and inert throughout? Browser launch here was attempted but the installed Chromium is missing `libatk-bridge-2.0.so.0`; no visual verification is claimed. Claude should run the normal browser playthrough plus both ending URLs after replacing the stub.

Doc gaps: the required `dry-heat-work recipe` knowledge search found historical wave reports, but no dedicated recipe. A recipe should link `AGENTS.md`, the current wave ownership/spec, and the Node/browser verification commands. The repository agent front page and this wave spec supplied the needed instructions for this bounded task.
