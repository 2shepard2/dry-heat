# Dry Heat: Opening and Story Arc

Working design doc. Status: proposal for Daniel. The story is taking care of your family. It is not a love story, and the marriage is a pressure the player manages, not a plot to resolve.

Cast and places already in the build: Marcus (41, Dad), Elena (38, Mom, takes blood-pressure meds), Jess (15), Theo (7). Neighbours from `map.js`: the Delgado house (NW, pool), the Pruitt house (NE), the Nguyen house (SW), the Okafor house (south, pool), the vacant rental (SE).

Two cast decisions made here so the rest of the doc can be concrete:

- **Mr. Pruitt** (60s, retired HVAC, widower) owns the generator. Gruff, decent, fair-minded, and he won't stay that way forever.
- **The Okafors** have the pool and two kids. They are the family you trade with, and the ones you may end up in conflict with.
- **Theo's vulnerability is asthma.** Heat, smoke and dust all trigger it, and the spare inhaler is the problem. The car has the rescue inhaler; the one at home is nearly empty. Elena's BP meds are the second clock (about nine days left).

---

## 1. Prologue: two normal days

Target 15 to 25 minutes of play. The clock runs faster than in the outage (speed 4 by default), the sim is gentle, nothing can kill anyone, and a **Skip to the outage** button sits on the intro card. Skipping drops you at 5:40 AM, day 1, with default stock (jugs in the garage, the pantry as it would have been).

The prologue is not a tutorial layer. Each beat is an ordinary task the game happens to need you to do, prompted by a person and not by a popup. Controls are introduced through the family's talk, one at a time.

### Day -1 (Thursday, July 9): about 10 minutes

Start 7:15 AM, AC running, 78 indoors, 94 outside.

| # | Beat | Player does | Teaches | Sets up |
|---|---|---|---|---|
| P1 | Kitchen. Elena is packing a lunch for Theo's day camp while Marcus makes coffee. Prices are mentioned in passing. | Click Marcus (select), then right-click to walk to the coffee maker, click the maker. | Select, move, click furniture | Money talk |
| P2 | Theo is on the couch and doesn't want to go. Elena says, "Can you take him? I have the dentist at 9." Marcus: "I've got a call at 9." Neither moves for a second. | Click Theo, choose "Get in the car." Marcus drives off-screen. | Order a kid | Who covers what |
| P3 | Marcus returns at 8:30, sits at the desk in the spare room. Calls and email are an abstract bar that fills. Elena comes in, looks at his screen, says nothing, then: "Is that the Hendricks thing again?" "It's fine." | Work the desk until noon (speed 4). | Time controls | The job (see section 3) |
| P4 | Jess is in her room with the door shut. Elena asks Marcus to ask her to do the dishes because "she doesn't listen to me." Marcus asks. Jess does them badly. | Give Jess "wash dishes." | Kids carry out tasks on their own timing | Jess's competence |
| P5 | Garage chores. Elena wants the gallon jugs moved off the high shelf so she can park the second car. They stay in the garage, in a row against the wall, 14 of them (about 10 full, 4 half). She says, "Why do we have so many of these?" Marcus: "Because of the monsoon thing in '19." | Pick up jugs, put them on the shelf by the door. | Carry and containers | **The jugs.** Location is learned by hand. |
| P6 | Pantry check, 5 PM. The pantry is half empty; the list on the fridge has things crossed out. Elena: "I'm not going until Saturday." Marcus: "Then we'll eat pasta." She doesn't answer. | Open the pantry, read the stock. | Inventory | **The half-full pantry** |
| P7 | Evening. Mr. Pruitt is hosing his driveway in the heat, the generator is visible under a tarp in his side yard, and he grumbles about the HOA. | Walk to the gate, talk. | Talk to neighbours | **The generator** |
| P8 | Night. Elena goes to bed first. Marcus stays up on the couch with his phone. The log gives us the first "unspoken" line: "The bedroom door is closed. It was open on Tuesday." | Pause. Z to sleep. | Sleep, day rollover | The distance |

### Day 0 (Friday, July 10): about 10 minutes

| # | Beat | Player does | Teaches | Sets up |
|---|---|---|---|---|
| P9 | Morning. Theo wheezes after running up the hall. Elena finds the inhaler in the kitchen drawer and shakes it. "It's almost empty. Did we refill this?" "I thought you did." | Give Theo the inhaler (use item on a person). | Use items on people | **The inhaler**; a spare is in the Camry |
| P10 | Grocery run. Marcus and Elena drive to Fry's together. Jess is left in charge of Theo, and she tells Marcus, "I'm not his babysitter." | Select both parents, "help together" on the cart (two carrying a heavy load). | Help together, shared tasks | Money, sacrifice |
| P11 | At the register the card is declined, then works on the second try. Elena looks at the screen and not at him. They buy fewer things than the list says, no case of water. Nothing is said about it in the car. | Choose what to put back. | Choice has a cost | **The thin stock** |
| P12 | Home by 1 PM. Heat is 111. Jess has let Theo play in the sprinkler, which she thinks is hilarious and he thinks is the best day of his life. | Optional: join them. | Morale | Okafor pool seen over the wall |
| P13 | Afternoon thunderhead on the horizon, no rain. Mr. Pruitt: "They said the grid was strained. Said it on the radio." | None. | Foreshadow | The grid |
| P14 | Evening. Family dinner, loud, kids bickering about what to watch. Elena and Marcus talk to each other through the kids ("Tell your father..."). Jess watches them. | Seat everyone. | Group dinner | Jess is paying attention |
| P15 | 9 PM. The game saves a snapshot, then jumps to 5:40 AM: the AC cuts out mid-sleep. | None. | Transition | The outage |

Prologue must-haves, in short:
- The player has touched the jugs, the pantry, Pruitt's yard and the inhaler.
- Money tension shows in exactly two places: the register and the fridge list. Do not add a third.
- Nobody argues loudly in the prologue. The strain is in who doesn't answer.

---

## 2. The outage and the escalation curve

The sim currently starts at 5:40 AM day 1 with outdoor temps creeping 0.6 F/day. The table below keeps that baseline and adds the social and supply curve. Day numbers count from the outage.

| Day | High (F) | Scarce | Street mood | New pressures | Player is learning |
|---|---|---|---|---|---|
| 1 | 115 | Nothing yet. Fridge food is fine, tub is filling. | Neighbours wander out at 6 AM, compare phones, trade rumours ("substation fire"). Cheerful, a little excited. | Taps sputter by 8:30. House passes 90 by afternoon. | Fill the tub, find the jugs, shade. Daytime is bad. |
| 2 | 116 | Ice. Fridge food has to be eaten or lost. | Block party feel. Pruitt runs an extension cord to the Nguyens' fridge. Okafors invite kids to the pool. | Cell service dead. Garage door stuck shut. First hot night with a stuck window. | First night shift. Someone should stay awake. |
| 3 | 116 | Fridge food gone. Canned goods start to matter. | Still friendly, but people ask what you have. Pruitt rations his gas. | Gas stations closed. The ATM is dead. First pharmacy rumour. | Sleep days, work nights. The first honest watch rotation. |
| 4 | 117 | Water. Tub is half. Store shelves bare. | The mood turns. A car leaves with a mattress on top. Someone is knocking on doors. | Theo's inhaler runs down. Elena feels dizzy (BP meds + dehydration). | Rationing as a decision, not a stat. |
| 5 | 118 | Medication, clean water. | Rumours (looting at the Safeway, a cooling centre at the church, then it's closed). Okafors stop inviting people to the pool. | First heat-illness cases on the street, an ambulance that doesn't come. | Who goes out? Who stays? |
| 6 to 7 | 118 | Everything. Pool water is green and Pruitt has a gate lock now. | Half the street has left. The ones who stayed watch the ones who did. | Break-ins, a dead neighbour (Mrs. Nguyen's husband). | The daytime is for hiding. All real work is at night. |
| 8 to 10 | 119 | Water, fuel, safe places. | A few doors are boarded. A few people are kind in ways you didn't expect. | Decision pressure: stay, walk, or accept a ride out. | The family has become a unit that works at night. The ending takes shape. |

Rules for the curve:
- Days 1 to 3 should be survivable by a distracted player. Death is nearly impossible if the tub is filled and the family sleeps through the afternoons.
- The turn on day 4 comes from supply, not scripts: the tub empties, the jugs thin out, the street's goodwill is a resource that the player has been spending.
- Escalation is mostly **pressure** (choices) rather than **damage** (stats).

---

## 3. The marriage as a relationship thread

No flirtation, no kiss, no speech. The thread is made of **who does what** under pressure, and the log tells it without explaining it.

**What is wrong (never stated).** Marcus was let go, or is about to be, from a job he tells Elena is "restructuring." He is working from the spare room, still, and she suspects (the card at the register, the "Hendricks thing"). Separately, something happened two years ago that neither names (a move they didn't take, money lent to his brother, a night she left for her mother's). The writing only ever alludes to it: "since Tucson," "like last time." The player never learns more than the family does.

**Mechanics: a hidden `trust` value between Marcus and Elena (0 to 100, starts ~45).**
- Rises when: they share a watch handover in the same room, when one takes the worse shift without being asked, when Elena is allowed to make the water decision, when Marcus tells the truth about what he did.
- Falls when: the player overrides a parent's refusal, hoards water for one kid, sends one out alone more than twice running, or leaves a decision unmade.
- Effects, deliberately light: above 60, the pair works "help together" tasks faster and morale recovery is better; below 30, one parent will refuse some orders ("I'm not doing that"), the same refusal system kids already use. Between, nothing visible.
- Jess reads trust. She is the one who comments on it.

**Choice points the game puts in front of the player.**
1. **Who takes the first watch** (day 2). Marcus offers; Elena says she'll do it because he "was up all night last night." Either is fine. The game notes who volunteered.
2. **Who goes out for water** (day 4). Marcus wants to; Elena says no, she is faster and he is tired. If the player sends Marcus without asking, trust drops.
3. **Who gives up their water** (day 5). Elena quietly gives her ration to Theo for two days. Marcus finds out from the container. He can say something or not.
4. **The confession** (day 6). He tells her about the job, at 3 AM, on the back step, in six lines. The game offers it only if trust is above 35. If it is not, he doesn't, and she finds out from a letter in his desk on day 8.
5. **The ride out** (day 8 and later). One of them may want to leave and the other to stay.

**Sample lines (log and dialogue).**
- "He holds the flashlight for her without being asked. She doesn't say anything about it."
- Elena: "You could have told me." Marcus: "I'm telling you now." Elena: "It's not the same."
- Jess, to nobody: "They're doing the thing where they're polite."
- "Elena takes the water from the lower shelf, the half-full one, and leaves the full one for the kids."

**Two directions, and both have to be playable.** They get closer in the way people do when work is shared: the log gets shorter, she hands him things without being asked. Or they split into two competent people running separate shifts who barely speak, and the kids carry the mood. Neither is punished. Both end differently (section 4).

---

## 4. Endings

The final state is judged on four axes: who is alive, who is well (water, medication, injuries), whether the parents are together, and how Jess ended (relied on or relied upon). The ending text is built from those, not just chosen.

**A. The grid comes back (day 9 or 10).** Trigger: survive to the morning of day 9 with the whole family alive, or day 11 regardless. At 4:12 AM the street light on the corner flickers on and every house hums at once. Nobody cheers. Text reflects who and what is left: the neighbours who are gone, Mr. Pruitt's gate, the AC coming back on at 79 and Theo asleep on the floor. Closes with a few quiet lines about the parents (together on the step, or in separate rooms, the same unit running). Deliberately anticlimactic. The lesson is that the city simply resumes.

**B. The cooling centre (day 7+).** Trigger: the player chooses "walk to the cooling centre at the high school" after the church one closes, with enough water to cross 2.5 miles at night. A short route sequence in which the player must carry Theo, ration water and avoid the day. Arrival: a gym with cots, volunteers, and a National Guard truck. The family is safe and the house is behind them. Bittersweet. Lose-condition is the route itself.

**C. Leaving for family (day 5 to 8).** Trigger: one parent proposes driving to Elena's mother in Flagstaff (140 miles, a tank of gas that the player has been siphoning or saving). The route is a night drive and a daytime hide. Arrival at 7,000 feet: cold at night. A short epilogue in which the family is split between those who wanted to go and those who did not. Highest risk, highest reward, and it ends the base game.

**D. Partial (any day).** Trigger: a death of a family member, or a collapse at the edge of the water supply, followed by a surviving household of three. The ending is quiet and untriumphant. Someone sits on the step with someone. Each of the survivors is described in a line. Not a fail screen: the game continues until A, B or C is reached with fewer people.

**Recommendation for the jam: build A as the baseline, B as the optional second, and fold D in as a variation of both.** Reasons:
- A needs only a trigger and a text builder. It is the cheapest path to a real ending and it honours Daniel's "I'm not sure what the end would be": the answer is that it is not an escape, only an interval.
- It fits the theme quietly: when the lights come back, what the family cares about is not what it was on Thursday.
- B adds a short interactive sequence and a new map region, which is two to three days of Codex time. Take it only if week 3 goes well.
- C needs a whole other map and travel loop. Cut it for the jam; mention Flagstaff in dialogue as the road not taken.

---

## 5. Implementation notes

No code here; shape of the data only. Each piece is independent so Codex and MiniMax can work at the same time.

**Scripted beats: `src/data/beats.js` (schema first, Claude; content: MiniMax; interpreter: Codex).**
Fields: `id`, `phase` (`prologue` | `outage`), `day`, `at` (clock minute), `trigger` (`time`, `enter: <room>`, `use: <item or furniture id>`, `after: <beat id>`), `who` (speaker ids), `lines` (array of `{ who, text }`), `log` (plain log text), `teach` (control hint id, shown once), `effects` (same vocabulary as night events: morale, items, flags), `sets` (flag names). The prologue is 15 beats from section 1 (P1 to P15), each with a `teach` or `sets` entry.

**Prologue flow (Codex).** A `phase` on `sim`: `prologue` runs fast with needs frozen at safe levels and no death. A Skip button jumps to `POWER_OUT_MIN` with default stock. New items: `inhaler_empty`, `inhaler_spare`, `fridge_list`. Prologue state stores flags (`touchedJugs`, `sawPruitt`, `inhalerChecked`) so later content can refer to them.

**Day-gated events: extend `src/data/events.js`.** The existing schema (`minDay`, `needs`, `watched` / `unwatched`) is enough. Add `maxDay`, `needs.flag`, and `needs.trustBelow` / `trustAbove`. MiniMax writes about 20 more events across days 3 to 10, matching the table in section 2. Suggested families: neighbour visits and requests (Pruitt, Okafor, Nguyen), heat illness in a family member, the inhaler running dry, a rumour that changes where the player might go, a night of someone leaving.

**Street state: `src/data/street.js`.** Per neighbour: id, attitude by day (`friendly`, `wary`, `hostile`, `gone`), what they offer or want, and conditions that shift them. Okafor and Pruitt are the two with real branches.

**Trust: `src/family.js` (Codex).** One scalar `trust` between Marcus and Elena, adjusted by event effects (`trust: +n`) and by a few hooks (watch handover, the refusal system). Display it nowhere. Jess's lines read it.

**Dialogue banks: `src/data/lines.js` (MiniMax).** Keyed by `speaker` and `situation` (e.g. `jess.noticesTrust.low`, `elena.givesWater`). Four to six variants each, very short, written in the voices of section 3.

**Endings: `src/data/endings.js`.** Each ending: `id`, `trigger` (day, state conditions), `title`, and text fragments keyed by axis (alive, well, parents, Jess, neighbours). An ending builder (Codex) stitches fragments. MiniMax writes the fragments; Claude reviews tone.

**Intro card (`index.html`).** The current text assumes the outage has begun. Replace it with a short note: "Thursday, July 9. A normal week." and Skip. After the cutover the existing text can play at 5:40 AM day 1.

---

## Decided (Daniel, 2026-11-02)

1. **Endings:** A (the grid returns) is the baseline. B (the cooling centre walk) is a stretch goal for week 3. C (Flagstaff) is mentioned in dialogue only. D (partial) is a variation of A and B.
2. **Marriage:** the confession is in: day 6, gated on trust, with the letter on day 8 as the fallback.
3. **Death is possible.** A death doesn't end the game. The survivors carry on to the ending, and its text reflects the loss.
