# Wave 5b: days 2-10 objectives, and the got-out ending

Source: Daniel, 2026-11-20, after the jam submission: use the time left to make the posted build better.
Two gaps: from day 2 on the objective panel still shows day 1's list, and the got-out ending (STORY section 4,
"How the endings feel and play") has card text but no way to reach it. Read STORY section 0 "Outcomes" and section 4
first. JAM.md "Theme" is the tone rule for objective text: the list changes without comment, and late in the game
it is down to one line.

Two parallel jobs with separate files. Each runs from base `b2679c6`.

| Part | Owner | Files |
|---|---|---|
| A. Daily objectives | Codex (job 1) | new `src/data/days.js`, new `src/days.js`, `src/beats.js` (outage objective hand-off only), one install line in `src/main.js` (marked `// wave 5b-A`), tests |
| B. Got out | Codex (job 2) | `src/endings.js`, `src/main.js` (leave action, scene, jump), `src/systems.js` (car trip only), `src/data/endings.js` (the edits listed in B7 only), `style.css` (only if needed), tests |

Both add tests to `src/systems.test.js`; append at the end of the file, inside a `// wave 5b-A` or `// wave 5b-B`
block, so the merge is clean.

## A. Daily objectives, days 2-10 (job 1)

1. **Data: `src/data/days.js`.** `export const DAYS = { 2: [...], 3: [...], ..., 10: [...] }`. Each objective:
   `{ id, text, check?, fail? }`, where `check` and `fail` are names from a small vocabulary that `src/days.js`
   evaluates each frame (or each game minute). Use existing state only. Suggested vocabulary (add others only if
   the state already exists): `aliveAtNight` (everyone alive at 8 PM), `tubAbove:<L>`, `waterAbove:<L>` (tub plus
   stored containers), `shadeBuilt`, `solarBuilt`, `waltVisited` (any morning visit that day), `watchKept`
   (someone on watch for most of the night), `cooked`, `nebulizer` (Theo used it that day), `heardRadio:<id>`.
   An objective without `check` is a plain instruction that never ticks (that is fine for the late days).
2. **Content and tone.** Write the text yourself, in the voice of the existing day-1 list (main.js `objectives`):
   plain imperative, no exclamation marks, no "shift", no hints of the theme. The list shrinks over the days:
   about 4-5 lines on days 2-4, 3 on days 5-7, 2 on days 8-9, and day 10 is one line: `Keep everyone alive.`
   Day 6 adds nothing about leaving. The radio does that, and the choice lives in B. Keep Walt and solar
   objectives only until the circuit is built (skip already-done ones: `solarBuilt` true means drop the Walt
   line from later days).
3. **Behaviour.** At 6:00 AM on days 2-10 (outage only), replace `game.objectives` with that day's list. Unfinished
   items from yesterday are not carried. Log one line: `Day N.` (no other comment). Done and failed use the
   existing `game.objective(id, state)` path and its log line. The day-1 hand-off in `beats.js` (`outageObjectives`)
   stays as is; day 1 ends at the first 6 AM after it.
4. **Day 11 and endings.** No list on day 11 (the held-out scene starts at 6:20). If `game.departed` (B) is true,
   stop updating.

Done when: tests cover the 6 AM swap for every day 2-10, the shrinking line counts, at least three check
names ticking from real state, the solar line dropping after the circuit is built, and no objective text
containing "shift" (case-insensitive). `node --test src/systems.test.js` passes.

## B. Got out (job 2)

The design is STORY section 4 "Got out = desperation, no choices left". It is never offered as a hopeful button.

1. **When it opens.** After the `fairgrounds-camp` radio item has played (day 6, 12:00 or later; the radio data
   is `src/data/radio.js`), check once per game hour. It opens when any one is true:
   - drinkable water (tub plus stored containers) is below 12 L,
   - Theo is alive, there is no `inhaler_spare` anywhere in the house or carried (the `cart` decision can leave
     it at the store), and the solar circuit is not built (no nebulizer),
   - the `tub-thief` night event has fired (unwatched or watched) on day 4 or later.
   When it opens, log once, in Elena's voice (bubble + log): `"The radio said the fairgrounds. We can't stay
   here."` Then a new action appears on the front door menu: **Leave for the fairgrounds**.
2. **Choosing.** The action opens a confirm panel in the outage-card style: one line saying how (`Drive. The tank
   has N liters.` if `car.fuelL >= 8`, otherwise `Walk, after dark. It is eleven miles.`), one line `What they can
   carry goes with them. The rest stays.`, and two buttons: `Go` and `Not yet`. Walking can only start between
   8 PM and 4 AM; in daytime `Go` reads `Go tonight` and arms the departure for 8 PM (cancel by using the door
   action again).
3. **Leaving scene (~30 s, same interlude pattern as held out: real time, any input skips, watched and skipped
   converge).** Survivors gather at the front door. Each member's carried inventory goes with them (record it on
   `game.departedWith`); nothing else moves. Marcus locks the door (log: `Marcus locks the door. Out of habit.`;
   if Marcus is dead, the oldest survivor does, without the "habit" line). Two neighbour figures stand at their
   gates and watch (no lines). Then:
   - **Drive:** the family gets in the car; the car pulls out and leaves the block by the nearest street edge.
     Log the fuel needle once (`The needle sits just above E.` if under 15 L). Checkpoint text line: `A Guard
     checkpoint on 27th Avenue. A soldier looks into the back seat, at Theo, and waves them through.` (youngest
     survivor if Theo is dead).
   - **Walk:** the family walks off the block at night; Theo (or the youngest) is carried by a parent (a simple
     pose or just walking close is fine). Log: `They take the canal path. Nobody talks.`
   Then fade to the cards.
4. **The trip does not kill anyone.** The existing card text assumes the dead were left at the house. Whoever is
   alive at the door arrives.
5. **State.** `game.departed = true` at the door; `game.ending = { kind: 'got_out', day, min, via }` where the day
   is the departure day for `drive` and departure day + 2 for `walk` (the cards say "two nights"). The held-out
   trigger must never fire after departure (it already checks `game.departed`). Survival clocks, night events
   and systems stop at the door.
6. **Playtest jump.** Extend `parseEndingJump`: `?ending=got_out&via=drive|walk` (default `walk`), optional
   `&dead=` as for held out. Start day 6, 7 PM, with skipped-prologue default stock, the fairgrounds radio
   marked as heard, the leave action already open, and fuel set to 20 L for drive and 4 L for walk. Not shown in
   the UI. Keep `?ending=held_out` working.
7. **Card data edits (only these; don't change any other card text).**
   - `go-walk`: add `when: { via: 'walk', noneDead: true }` (it names Theo and Jess carrying him).
   - `go-key`: add `when: { alive: 'marcus' }`.
   - Add after `go-key`: `{ id: 'go-key-elena', ending: 'got_out', order: 90, when: { dead: 'marcus', alive: 'elena' }, text: 'Elena still has the house key. She has never said why she keeps it.' }`

Done when: tests cover each of the three opening conditions (water, inhaler, tub-thief) (and that nothing opens before the radio item), the
drive/walk choice at the 8 L line, the daytime arm-for-8-PM path, watched and skipped scenes converging to the
same `game.ending` and `departedWith`, no deaths on the trip, held out never firing after departure, the jump
parsing for both `via` values, and card selection for drive, walk, walk with a death, and Marcus dead.
`node --test src/systems.test.js` passes.

## Browser checks at merge (Claude)

Both ending URLs (`?ending=got_out&via=drive`, `?ending=got_out&via=walk&dead=jess`, `?ending=held_out`), a
normal start through the day-1 cut, then the day 2 objective list at 6 AM, by real clicks per AGENTS.md.
