# Wave 4d: Daniel's 4c playtest (HUD and bugs)

Source: Playtest Board cards #81, #85, #86 (2026-11-09) with screenshots. The verdict on 4c: bubbles and chores work.
The screen is still crowded, and five things are broken. Two owners, kept apart by file:

| Part | Owner | Files |
|---|---|---|
| A. HUD layout | MiniMax | `src/ui.js`, `index.html`, `style.css`, `src/main.js` (HUD markup, portrait/figure click handling only) |
| B. Bugs | Codex | `src/beats.js`, `src/data/beats.js`, `src/family.js`, `src/map.js`, `src/build.js`, `src/path.js`, `src/main.js` (outage objective setup around `outageObjectives` only), tests |

## A. HUD layout (MiniMax)

Goal: the world is the picture, and the HUD is a few small things at the edges.

1. **No top bar.** Remove the full-width black bar. Top left: a small **clock card** that looks like a wall
   calendar: weekday and date (`Thu · July 9`, `Day 1 · Sat · July 11` in the outage), the time large, and
   `96°F out · 78°F in`. About 200px wide.
2. **Speed controls** become a small row of icon buttons attached under the clock card: pause, 1x, fast, faster.
   The current speed is highlighted. Keyboard shortcuts stay as they are.
3. **House status.** In the prologue, show nothing: no Taps and no AC. With the power on they're implied, and
   their absence is a hint of what comes later. In the outage, a small **House** chip beside the clock shows the
   water days (`Water 16 days`). Clicking it expands water litres, taps, car fuel, window shade and solar. Taps show
   only when they're not normal (sputtering or dead). Drop the AC line; it's silent for the whole outage.
4. **Task panel, smaller.** It sits under the clock and shows the Now line, at most two Also lines and today's
   open items (4 at most). Completed items collapse into one `✓ 5 done` toggle. Chores appear only as Also
   lines, never in the list (part B removes them from the data). Use a smaller type size than now.
5. **Swap the log and the person panel.** The log moves top right (two lines, Expand as now). The person panel
   (needs, doing, carries) moves bottom left, just above the portraits.
6. **Two-click people.** The first click on a portrait or figure selects that person (parents) or focuses them
   (kids). A second click on the same person opens their panel, and a click again or ✕ closes it. The panel is
   closed by default.
7. Phone width doesn't matter here; the target is a laptop browser at 1366x768 and 1920x1080. Screenshot both.

Done when: the screenshots at both sizes show the clock card, the speed row, the smaller task panel, the log top right and
no person panel until a second click. Prologue screenshots show no Taps or AC. The existing tests pass.

## B. Bugs (Codex)

1. **The next marker shows too early.** While a beat is waiting for its clock time (`waiting`), the next beat's
   target must not be highlighted. Screenshot 61: the bed was marked from 8 PM for a 10 PM sleep. While waiting,
   `guidance()` gives no target or marker. The Now line may still say `Free time until 10:00 PM`.
2. **Some chores never surface.** "Get the mail" and "Set the table" were never hinted. Chores must offer their
   Also hints and markers during waiting beats and free time too, not only during an active step. Add a test
   proving that every chore in `data/chores.js` is offered at some point in a full 1x prologue run.
3. **Chores leave the objective list.** `refreshObjectives` no longer adds chores to the to-do list; they are
   only Also hints (card #81).
4. **Friday groceries happen at home.** Card #86: the cart choice (water, pharmacy or birthday things) plays
   in the house, and only then do they drive off. Fix the order: drive to Fry's (trip), then the register lines
   and the choice card play while they are away, then they drive home.
5. **The south bedroom window is unreachable.** Screenshot 64: "Marcus can't get to South bedroom window" even
   with every mattress moved to the living room. Find the cause. Every window-shade target must be reachable from the
   home interior with the default furniture and after the mattress move; add a test that walks every window.
6. **The task list is empty on Saturday.** Screenshot 63: the outage starts with a blank task bar. Outage objectives must
   show from the first frame of day 1 (see `outageObjectives` in `main.js`). Add a test.
7. **Drop the "(on his own)" / "(on her own)" callout** from `doing()`. Autonomy is unchanged; only the text
   goes.

Done when: each item has a test or a stated reason it can't be tested, and `node --test src/systems.test.js` passes.
