# Wave 4c: two things going, and speech bubbles

Daniel's playtest of 4b (2026-11-08): the prologue is Marcus's day. Coffee, Theo, desk until noon, Walt, and only
then Elena. Between story steps the player waits. Conversations scroll past in the log and you can't see who is
talking to whom. Decision: keep the whole family playable (parents direct, kids by order) and make the prologue
the practice run for running a household: **there is always a second thing to do, usually for someone else.**

Three parts, three owners, no shared files:

| Part | Owner | Files |
|---|---|---|
| A. Speech bubbles | MiniMax | new `src/bubbles.js`, `index.html`/CSS for the overlay, one call site in `beats.js` `speak()`, the `say()` helper in `family.js`, wiring in `main.js` (create + per-frame update only) |
| B. Chore engine + prologue rebalance | Codex | `src/beats.js` (except `speak()`), `src/data/beats.js`, `src/ui.js`, `src/main.js`, `src/family.js` (desk routine only), tests |
| C. Chore content | MiniMax (after A) | `src/data/chores.js` only |

## A. Speech bubbles

- `createBubbles(game)` returns `{ say(who, text), update(dtReal), clear() }`. A DOM overlay above the canvas, positioned every
  frame by projecting the speaker's head (figure position + head height) through the orthographic camera.
- Who can bubble: any family member on the map. Walt, Pruitt and Okafor only when they have a visible figure or site
  near the line's beat target; otherwise log only. Radio and narration are log only. A speaker who is off map
  (on a trip) or off screen gets no bubble; the log still has the line.
- Lifetime: `clamp(1.8 + 0.06 * text.length, 2.5, 7)` real seconds, short fade in/out. The clock stops while the game is paused.
  A new line from the same speaker replaces their bubble.
- Two bubbles whose boxes overlap are pushed apart vertically, so a back-and-forth reads as two people talking.
- Look: small, sober, readable at night. Dark translucent box, light text, max width about 220px, wraps, a tail
  pointing at the head. No names inside (the tail shows the speaker). Must not block clicks (`pointer-events: none`).
- Pacing: `beats.speak()` waits for the bubble's lifetime minus 0.6 s before the next line (minimum 1.6 s)
  instead of a flat 2.5 s. The hurry once a step is done stays, but at 1.4 s, not 0.9.
- Need lines in `family.js` `say()`: the spoken ones (currently written `Theo: "..."` / `Jess: "..."`) bubble from that
  member. Narration ("Theo is crying and won't stop.") stays log only. Add an explicit speech field; don't
  parse the log string.
- The log is unchanged: every line still lands there for scrollback.

## B. Chores: the second thing going

A **chore** is an optional, parallel, ordinary task with a time window. It never blocks a beat, is never
required, and quietly teaches the house (where things live) for the outage. Missed chores expire without comment.

Schema (contract; `src/data/chores.js` exports `CHORES`):

```js
{
  id: 'c-lunch',              // unique
  day: -1,                     // -1 Thursday, 0 Friday
  from: 435, to: 480,          // clock-minute window it is offered in
  who: 'elena',                // suggested person (hint and marker colour); any parent may do it,
                               // kids only via order when do.type === 'order'
  label: "Pack Theo's lunch",  // objective text, ordinary-life voice
  do: { type: 'use' | 'walk' | 'order', target, kid? },   // same targets as beats (beats.js mapBeatTargets)
  minutes: 10,                 // game minutes of work at the target (use/order)
  lines: [{ who, text }],      // optional, spoken (bubbles) when it completes
  log: '...',                  // optional narration on completion
  reveal: { item, into }       // optional (`into` must be a container target): put one item (data/items.js id) into a target's container,
                               //   e.g. the flashlight is now in the junk drawer; the player learned where it lives
}
```

New props are allowed in `mapBeatTargets` for chore targets (same `prop()` helper, walkable cell, home or yard).

Engine (Codex):
- Offered chores (window open, not done) appear under the story step in the Now line as `Also: <label> (<who>)`,
  at most two, earliest deadline first, and as dim optional items in the day's objective list.
- A smaller marker in the suggested person's colour over the chore target. The story marker stays the bright one.
- Clicking the target with a parent selected offers the chore action in the normal object menu.
- Completion: lines, log, reveal, done. A chore task can be interrupted by a beat that needs that person; it just
  stays offered.
- Skip ahead stays available while chores are offered (the player's call), and it stops hurrying when a chore
  window opens, so a new chore is never skipped past unseen.

Prologue rebalance (Codex, `data/beats.js` + engine). Goal: by 9 AM Thursday the player has directed both
parents, and nobody waits more than a minute of real time with nothing to do.
1. **Desk is set-and-forget.** `use desk` seats Marcus once; afterwards, during work hours (8:30 to 12:00, Friday 13:00 to 17:00),
   his routine returns him to the desk when he is free. P3 completes at noon as now, whether or not he left for
   a chore. Elena or a chore can pull him away; he goes back by himself.
2. **P2: Elena takes Theo.** Same opening lines (dentist at 9, call at 9, nobody moves), then Elena: "Fine. I'll drop
   him on the way." The player orders Theo to the car; Elena and Theo leave (trip, Elena back about 10:30).
   Who covers what stays the point: she covered.
3. **Elena's late morning.** When she returns, she has chores (see C). P4 (Jess, dishes) stays Marcus asking at
   Elena's request, but he does it from the desk break, not instead of it.
4. **Camp pickup at 3** goes to Elena (she's free; Marcus has the call), as an `away` pickup.
5. **Friday P13 (wait 45)** is the chores' slot, not a wait.
6. Keep all four decisions, the money rule (three places only), the aurora, the cut. No new arguments.

Tests: chore offered/expired/completed, reveal places the item, a chore never completes a beat, desk return after a
chore, P2 trip with Elena, and the existing 32 still pass. Update `tools/playthrough.mjs` checks if beat order changes.

## C. Chore content (MiniMax)

About 14 chores over the two days, two or three per stretch, spread so Elena and Jess have as many as Marcus.
Ordinary-life voice, nothing flagged as important. Each `reveal` ties to an outage need (light, water, heat,
cooking, medical, tools) without saying so. Suggested set (adjust to the map's real targets):
Thursday: pack Theo's lunch (Elena), get Jess up (Marcus, her door), take the bins to the curb (Marcus),
water the citrus (Elena, hose: reveals garden_hose in the garage), put the laundry in (Elena), find the
flashlight for the closet bulb (Jess by order: reveals flashlight in the kitchen drawer), put the camping cooler back
in the garage (Marcus: reveals cooler), change the AC filter (Marcus).
Friday: make breakfast (Marcus), put the groceries away (Elena), find the radio in the hall closet (Jess:
reveals radio_handcrank), fold the laundry (Elena), get the
camp lantern down for Saturday (Marcus: reveals camp_lantern).
One short exchange of lines on about half of them. Marriage rule: the strain is in who doesn't answer.

## 4c-B contracts

- `Prologue` accepts injectable `chores` (default `CHORES`); the content schema above is unchanged. `offeredChores()` returns unfinished chores in the half-open absolute window `[(day-1)*1440+from, (day-1)*1440+to)`, earliest deadline first (id breaks ties). `doneChores` is separate from story `completed`; expired unfinished chores disappear silently, including their active tasks and objectives. Completed chores remain checked in that day's list.
- `guidance().chores` contains at most two offered chore records. UI renders their `Also: label (suggested person)` hints and dim optional objectives; main renders smaller, translucent rings in the suggested person's colour. All offered chores, including those beyond the two hints, are available from their target's normal object menu. Existing beat target keys are unchanged.
- `interactChore(id, parents)` lets either available parent do `use`/`walk`; an `order` sends only `do.kid`, using the existing obedience check. Work uses existing Member `prologue` tasks with both `beatType` and `target` namespaced as `chore:<id>`; `notify` routes those directly to chore completion. Walks finish at arrival; use/order work takes `minutes ?? 10` game minutes. A story interaction/boarding can replace that task; unfinished chores stay offered and restart from zero when requested again. Optional arrival sets the same proximity-isolation flag as routines, so it cannot complete a story walk; a subsequent manual approach clears it. Namespaced targets also prevent chore work from counting as a partner on a together beat.
- Completion is guarded by the still-open window and done set. It queues optional speech, writes `log`, and adds one `makeEntry(reveal.item)` to `targets[reveal.into].items`. Chore speech uses independent queue/timing state and optional `game.bubbles.say(who, text)`; it waits for a gap in story speech but never delays a story completion or choice. `speak()` remains owned by 4c-A and is unchanged here.
- Hurry records the next unopened chore boundary. `limitStep(dtMin)` clamps a hurried frame to that boundary; main calls it before advancing the clock. `updateSkipping()` restores the exact prior speed, including pause, at the opening. Already offered chores do not suppress Skip ahead; explicit manual work retains 4b's hurry interruption rules. The seated desk beat uses a stable hurry context through seating and autonomous work, until noon or another interruption.
- Marcus's initial manual desk task takes two minutes and sets `deskStarted`; the desk beat finishes at noon independently of his current location/task. His autonomous `routine` returns to the desk during 08:30–12:00, plus Friday 13:00–17:00, after manual work ends. This work routine bypasses ordinary autonomy grace, respects disabled autonomy and urgent needs, never notifies a beat, and releases itself outside work hours.
- Trips may set `background: true`: boarding/departure completes the originating step; the off-map crew and car return independently without completing the current beat. The trip retains its originating day for camp absence scheduling. P2 uses this for Elena/Theo until 10:30, allowing Marcus's P3 desk start at 08:30. Elena's 15:00 pickup remains a scheduled absence. The former P3 doorway conversation moves to the noon desk break/P4, when Elena is home; Marcus asks Jess to do the dishes at Elena's request.
- P13 retains the thunderhead dialogue but uses a zero-minute wait, then leaves free time until the 17:00 gas decision for optional chores. All 18 beat ids, four decisions, aurora and outage cut are retained. No chore content is changed by 4c-B.

Validation: `node --test src/systems.test.js` on Node 22. All original 32 scenarios retained; nine fixture-based scenarios cover chore windows/deadlines/expiry, work duration, speech/log/reveal, use/walk/together isolation, parent and ordered-child access, interruption, desk return and Friday hours, Elena's background trip/pickup, and exact hurry boundaries. Existing full prologue playthroughs still exercise both decision paths. Browser playthrough remains a CT141 merge check; `tools/playthrough.mjs` now observes Elena's Thursday trip and the two-hint limit.

Open decisions: none for the engine. Merge 4c-A/C's bubbles and real chore content alongside this branch; the two sample chores alone do not provide all-day coverage. Content must use the existing mapped target keys (or coordinate new props in `mapBeatTargets`).

Doc gaps: the required knowledge search found no Dry Heat recipe, and this checkout has no `AGENTS.md`. Add a short project recipe/agent front page pointing to the wave specs, file ownership, Node 22 checks, and CT141 browser verification.
