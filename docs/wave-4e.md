# Wave 4e: the night the power goes out, plus four 4d playtest bugs

Source: Playtest Board cards #79, #86 and #87 (2026-11-11/12), with screenshots. The verdict on 4d: the new HUD
is "SO much better", and the speech bubbles and chores work. One owner (Codex), because both parts touch the
beats.

| Part | Owner | Files |
|---|---|---|
| A. Bugs | Codex | `src/beats.js`, `src/data/beats.js`, `src/data/chores.js`, `src/family.js`, `src/map.js`, tests |
| B. The night | Codex | the above, plus `src/main.js` (the `cut()` presentation and the night visuals), `src/systems.js` if needed, `style.css` (cut styling only), `src/data/events.js` (Saturday opening only), `tools/playthrough.mjs` (budget only) |

## A. Bugs

1. **Theo's pickup is listed two or three times.** Screenshot 65, Thursday: "Get Theo from camp at three", "Get
   back in time for the pickup" and "Pick Theo up from camp at three" are all open at once. A beat's objectives must
   not repeat what an earlier, still-open objective already says. Merge them into one item and add a test: no two
   open objectives name the same errand at any point in a full 1x prologue run.
2. **The sprinkler is in the front yard, but the text says the back yard.** Screenshot 66. Change the text to the
   front yard (`beats.js` sprinkler label, and any line that says otherwise). Also: when you send Jess to join Theo
   at the sprinkler, only Jess goes out. Theo must actually be at the sprinkler (walk him there when the beat
   starts, or when he is sent there) and come back inside when the beat ends.
3. **"Wait until Saturday" for gas still sends Marcus and Theo to the gas station.** Card #86, screenshot 67: the
   player chose to wait, and Marcus and Theo still got into the car that evening and drove off. The gas trip must
   run only when the choice was to fill up. Test both answers.
4. **Jess stays out in the street after taking the bins out.** Screenshot 67. After a chore that ends outside
   the house (bins, mail and any others), the kid walks back to their routine spot. Test it for every chore whose
   target is outside the walls.

## B. The night the power goes out (card #87)

Today, `p15` waits 30 minutes and `cut()` shows a 2-second black fade with "5:40 AM" and two log lines. Daniel:
"nothing indicates that something has happened in the world. You wake up Saturday and Theo is outside crying and
suddenly it shows how much water you have and says to fill up the tub." This is the most important moment in the
game. Make it a short played-out sequence, about 30 seconds at the default speed. Any click or key skips straight
to the Saturday opening (the skip path must leave the same state as watching it).

1. **Asleep.** After `p15` the house is dark and everyone is in bed. Time runs quickly from 11:30 PM. Porch
   light on, street lights on, a faint aurora still in the sky.
2. **3:12 AM: the transformer.** The pole-top transformer in front of the house (the pole in the front yard;
   add a small can on it if there isn't one) pops: a blue-white flash that lights the whole block for a few
   frames, a few sparks falling, and a log line ("A bang outside, like a gunshot, and a blue flash through the
   blinds."). Then the porch light goes out, and the street lights go out down the block one by one over about
   two seconds, ending with every house dark. The ceiling fan line: "The fan in the other room slows down and stops."
3. **Marcus wakes.** Marcus gets up, walks to the front window (or the front door) and stands there. Bubbles:
   - Elena: "What was that?"
   - Marcus: "Transformer. The whole street's out."
   - Elena: "It'll come back on."
   - Marcus: "Yeah." (He stays at the window.)
   Theo gets up too and goes out onto the front step to look. **This is why Theo is outside on Saturday
   morning**, so the Saturday wander/crying must follow from it (him on the step, frightened, not a random night
   event). The random night-event roll must not fire during this sequence or the first hour of Saturday.
4. **Cards.** Fade to black with three short cards, a couple of seconds each, same style as the current cut:
   - "4:30 AM. 81°F inside."
   - "Nobody's phone has a signal."
   - "5:40 AM. The sun is up. Nothing came back on."
5. **Saturday opening.** Day 1 starts at 5:40 AM as now. Before the House chip and the water objectives appear,
   one short beat: Marcus flips the breaker in the garage and tries his phone (bubbles: "Breakers are fine. It's
   not us." / Elena: "No signal. Not even the emergency alerts."). Then the House chip appears and the log line
   about the taps and the tub runs. Keep the existing five outage objectives; they show after this beat.
6. **Canon check.** The radio already names the aurora on day 1 (`src/data/radio.js` `aurora-named`). Keep that,
   and make sure nothing says the power went out at 5:40 AM: it went out at 3:12 AM. Fix the log line in `cut()`.

Visual budget: reuse the existing lights (`porch`, street lights and the aurora in `main.js`); one point light plus
a few small emissive boxes for the flash and sparks is enough. No new assets or audio this wave.

Done when: each A item has a test; B has a Node test that runs the night via the beat interpreter both watched and
skipped and checks the same day-1 state (time, objectives, Theo's position on or near the front step, the lights
off, no night event fired), and `node --test src/systems.test.js` passes. Report any part of B you could only
check in the browser; Claude runs `tools/playthrough.mjs` at merge.

Also (tools): raise `tools/playthrough.mjs`'s budget so it reaches the Walt choice under swiftshader (it ran out at 9 minutes in 4d).

## 4e contracts

- Ordinary objectives continue to share identity by exact text in the interpreter's day ledger. Thursday's pickup now uses one canonical `Get Theo from camp at three` item throughout P3/P4/P4a, completed by `camp-pickup`; the extra pickup reminder is removed. Hendricks deck wording is canonical too. Both full 1x runs assert unique open errands on every frame.
- P12 names the front yard. On its actual start (not its waiting state), Theo walks to the sprinkler and stays there. Completing or timing out P12 sends both kids along real paths to their indoor routine spots.
- `then.when` optionally maps decision names to required values; all must match before boarding starts. P13a's trip requires `{ gas: 'full' }`. Choosing `quarter` completes its at-home reply without boarding, hiding the car, or sending either person away. Existing trip/checkout behavior and all 18 beat ids remain intact.
- Outdoor chore completion and expiry immediately request `Member.returnToRoutine()`, independently of the normal 45-minute order cooldown. It walks to an indoor personal spot. Only this explicit `returningHome` routine may traverse road cells that ordinary autonomous routines reject; its location remains autonomous so it cannot satisfy story walks. Regression coverage includes all six outside/threshold chores: bins in, tires, mail, trunk medkit, bins out, cooler.
- P15's old 30-game-minute wait is replaced by a 34-real-second interpreter interlude. `startNight(defaults = false)` puts everyone in bed at Friday 11:30 PM, saves speed/autonomy, holds survival simulation and chores, and clears ordinary objectives. The normal frame loop updates walking/animation with zero body/survival minutes and calls `Prologue.update(0, dtReal)`; it never steps the normal clock, systems, rules or event scheduler during the interlude.
- `nightView(state)` is presentation only. `game.outageNight` exposes stage, elapsed seconds, porch/street booleans, flash/sparks booleans and card text. At 5 real seconds the clock reaches 3:12 AM and the transformer pops; porch and street lamps extinguish in sequence over 1.6 seconds. Marcus and Theo then walk to the door/step; the four specified lines play at 9/12/15/18 seconds. Cards occupy 21–27 seconds, two seconds each. Marcus walks across to the existing garage panel under the cards; the breaker/phone opening occupies 27–34 seconds, with its lines at 30/32. Indoor temperature reaches 81°F for the first card and stays 81°F at dawn.
- `skipNight()` jumps to the Saturday opening and places Marcus by the panel and Theo on the step. It suppresses skipped night dialogue and still plays the breaker/phone beat. Another input during that opening completes it. Captured pointer/key input cannot also issue a world/HUD command; held-key repeats are consumed. The intro's Skip button takes this same opening with default decisions. The existing explicit `skipToOutage()` debug hook remains an immediate finalization.
- House visibility remains governed by the existing prologue power flag until the opening finishes; night lamp state is separate. The presentation corrects the calendar date across midnight. Finalization switches to outage, restores speed/autonomy, initializes fresh copies of all five outage objectives synchronously before `cut()`, applies decisions once, and converges all family positions. Theo is at `(27.5, 0, 16.5)`, marked frightened/wandered on the **front** step and available to fetch; this is scripted, not a nightmare event. The dawn log identifies 3:12 AM as the outage time.
- Because the event scheduler is created on Thursday, finalization discards its historical slots and sets `nextAt = 1410` (Saturday 11:30 PM, the first normal night slot). No random night event runs during the sequence or the first hour after the 5:40 AM opening. Node coverage compares watching with skips at five different points, including clock, temperature, all five objectives, positions, decisions, lights and event state, and checks no roll through 6:40 AM.
- Night visuals reuse four existing room lights while everyone sleeps, plus one new flash point light, six emissive sparks, a small transformer can on the existing front pole, lamp/window glows, a breaker handle and a phone rectangle. No audio or external assets. Cut/card CSS only; no HUD layout changes. Playthrough budget is now 20 minutes / 180 iterations, with the former post-skip iteration cap removed so it can reach Walt under software rendering.

Validation: Node 22, `node --test src/systems.test.js`: **64 tests, 64 pass, 0 fail**. Syntax checks and `git diff --check` pass. The two full no-jump 1x runs cover both gas answers and unique errands; targeted tests cover sprinkler travel, every outdoor chore, six night routes, and intro skip.

Browser checks still required at merge: flash exposure and spark legibility, the lamp cascade and aurora, sleeping figures and speech visibility at the window/step, card transitions, breaker/phone framing, and pointer/key skips with the House reveal. Local browser launch could not run: the installed Chromium runtime lacks `libatk-bridge-2.0.so.0`. No browser screenshots or visual verification are claimed.

Doc gaps: the required knowledge search found historical wave reports but no dedicated Dry Heat recipe. The repo now has its agent front page; a recipe should link that page, the current wave ownership/spec and the Node/browser verification commands.
