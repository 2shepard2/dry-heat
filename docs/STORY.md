# Dry Heat: Opening and Story Arc

Working design doc. Status: decided canon (section 0, Daniel, 2026-11-03) plus working detail that follows it. The story is taking care of your family. It is not a love story, and the marriage is a pressure the player manages, not a plot to resolve.

Cast and places already in the build: Marcus (41, Dad), Elena (38, Mom, takes blood-pressure meds), Jess (15), Theo (7). Neighbours from `map.js`: the Delgado house (NW, pool), the Pruitt house (NE), the Nguyen house (SW), the Okafor house (south, pool), the vacant rental (SE).

Two cast decisions made here so the rest of the doc can be concrete:

- **Mr. Pruitt** (60s, retired HVAC, widower) owns the generator. He has no gas for it, but he has an RV battery. Gruff, decent, fair-minded, and he won't stay that way forever.
- **Walt** (78, retired master electrician, three doors down) is the new cast member who can make the solar panels work. See section 0.
- **The Okafors** have the pool and two kids. They are the family you trade with, and the ones you may end up in conflict with.
- **Theo's vulnerability is asthma.** Heat, smoke and dust all trigger it, and the spare inhaler is the problem. The car has the rescue inhaler; the one at home is nearly empty. Elena's BP meds are the second clock (about nine days left).

---

## 0. Canon (Daniel, 2026-11-03): this overrides anything below that disagrees

### What happened
- **A severe solar storm.** On **Friday night (day 0)** an aurora shows over Phoenix, which never happens there. The neighbours are out in the street filming it on their phones, Theo is on Marcus's shoulders, and Marcus and Elena stand together for a minute. It is the last normal night, and the key art and screenshot moment.
- **Sat July 11, 5:40 AM:** ground currents from the storm burn out the large high-voltage transformers. They are custom-built and take months to replace, with no spares. The grid is down across most of North America, not just Phoenix. Cell towers run on battery for a few hours, then go silent. GPS is unreliable.
- **Why it's apocalyptic:** help isn't coming soon, because it happened everywhere. Nobody is to blame. The family learns only in fragments, from the hand-crank radio and the neighbours. The enemy is the heat.
- **The grid does not come back within the game.** No ending is "the power returns".

### Why nobody drives away
- **Saturday morning radio, before the cell towers die:** every road out is at a standstill. The I-17 north, the I-10 both ways and US-60 are all stopped. Cars overheat in the jam, people die in them, and DPS says to stay off the roads. By the time the family hears it, it is too late to run. **Flagstaff is mentioned in dialogue only**, as the road everyone else jammed.
- **Gas pumps need power.** Fuel is whatever is in the tank, plus siphoning and trading.
- **The car works, and becomes a resource.** It is cabin AC that costs fuel, a radio, and a phone charger. It is the clearest example of an item changing value: the commute car on Thursday, a quarter tank of cooling minutes by day 4.
- **No cars at night.** No one in the family or the street drives off at night. Jess slips out **on foot** (the canal where the street's kids gather after dark, or the Okafors' pool).

### The four ordinary decisions (prologue)
The game never flags these as important. Each is an ordinary household choice, and most come with a small argument between Marcus and Elena. They are stored as flags (`decisions.*`) and pay off from day 3 to day 8. Characters may refer back to them in a line ("Remember those jugs?"). The narration never comments.

| # | When | Choice | Pays off as |
|---|---|---|---|
| 1 `gas` | Fri after work | Fill up now ($58, the card might be declined again, Theo whining in the back), or "I'll do it Saturday." | Full tank vs a quarter. Sets car-AC minutes for Theo, whether outcome 2 can be a **drive**, and what you can trade to Pruitt (he has a generator but no gas). |
| 2 `jugs` | Thu chores | Elena wants the 14 water jugs out of the garage so the second car fits. Recycle them, or move them to the shelf. | About 40 L of water (roughly two days). |
| 3 `cart` | Fri grocery run | The card is declined, then goes through. One thing goes back: the case of water, the pharmacy pickup (Theo's spare inhaler and Elena's BP refill, $45), or Jess's birthday things. | Water, or Theo's and Elena's medication clocks, or Jess's trust. You protect two of the three. |
| 4 `walt` | Thu afternoon | Walt is in the street in his slippers looking for his mailbox, and Marcus has a call at 2. Walk him home, or say "you're fine, Walt" and go in. | Whether Walt trusts the family on day 3 (see Walt below). |

The cost of every choice is ordinary: money, time, a fight, a teenager's mood. That is the theme (JAM.md: what matters changes), shown and never said.

### Solar panels
- **Most of the street has rooftop solar, and it all shut off at 5:40.** Grid-tied inverters shut down in an outage by design, so line workers don't get shocked. This is a scene, not a hole. Day 1, Marcus: "We have solar, why is nothing on?" The family **leases** its panels, and the lease ($140 a month) is part of the money stress in the prologue.
- **Walt can make it work.** He can disconnect the system from the grid and wire the panels, through a charge controller and a deep-cycle battery (from Pruitt's RV, the Okafors' golf cart, or a car), into a **small daytime circuit**. It can run a fan, charge the radio and flashlights, and power **Theo's nebulizer**. That turns the asthma from a countdown into something you can manage.
- **Why it isn't a cheat code:** it works only in daylight, it is far too weak for the AC, the panels lose output in the heat, and it needs scavenged or traded parts plus a lucid Walt.

### Walt (new cast)
- About 78, a **retired master electrician** who lives alone three doors down. His wife is dead and his daughter is in Tucson. He has age-related decline: **sharp in the morning, confused by evening.** That forces morning visits in the building heat, against the family's night routine.
- **His instructions may be wrong.** On a confused day he may tell Marcus to make a connection that will hurt him (a shock, or a fire). The player has to judge whether today's Walt is clear. Waiting for a better morning costs a day without power.
- **He needs care.** Keeping him alive costs water. The question is whether he's a neighbour the family looks after or a tool they use. Jess can be the one who connects with him (her arc).
- Decision 4 decides how he starts: if you walked him home on Thursday, he trusts the family on day 3. If not, it takes more mornings and more water.
- Write him with dignity: he is an expert who is losing something, not a joke or a horror beat.

### Outcomes
1. **Held out.** The family has prepared the house (shade, water, solar circuit, rationing) well enough to last until about **day 11**, when help they weren't expecting arrives. **Kindness brings it:** someone the family helped (Walt's daughter, the Okafors' son, whoever they helped) reported the street, and a National Guard water convoy comes to that street specifically. The game never says so.
2. **Got out (the risky option).** About **day 6**, a radio report says there is unrest downtown: looting, fires, Guard checkpoints. The relief camp at the **state fairgrounds** is on the far side of it. The player chooses to leave: **drive** if fuel was saved (decision 1, siphoning, trades), or **walk at night** if not. It's riskier, and it may be faster.
3. **Didn't all make it.** Someone dies on either path. The survivors still reach outcome 1 or 2, and the ending text is quieter and names the loss. **If no one survives, that is the one failure ending.**

The ending text is still built from the axes in section 4: who is alive, who is well, the parents, Jess, and the neighbours.

---

## 1. Prologue: two normal days

Target 15 to 25 minutes of play. The clock runs faster than in the outage (speed 4 by default), the sim is gentle, nothing can kill anyone, and a **Skip to the outage** button sits on the intro card. Skipping drops you at 5:40 AM, day 1, with default stock (the pantry as it would have been) and default decisions: `jugs` kept on the shelf, `gas` not bought (a quarter tank), `cart` puts back the case of water, `walt` walked home.

The prologue is not a tutorial layer. Each beat is an ordinary task the game happens to need you to do, prompted by a person and not by a popup. Controls are introduced through the family's talk, one at a time.

### Day -1 (Thursday, July 9): about 10 minutes

Start 7:15 AM, AC running, 78 indoors, 94 outside.

| # | Beat | Player does | Teaches | Sets up |
|---|---|---|---|---|
| P1 | Kitchen. Elena is packing a lunch for Theo's day camp while Marcus makes coffee. Prices are mentioned in passing, and so is the solar lease ($140 a month, "for panels that save us nothing"). | Click Marcus (select), then right-click to walk to the coffee maker, click the maker. | Select, move, click furniture | Money talk, the lease |
| P2 | Theo is on the couch and doesn't want to go. Elena says, "Can you take him? I have the dentist at 9." Marcus: "I've got a call at 9." Neither moves for a second. | Click Theo, choose "Get in the car." Marcus drives off-screen. | Order a kid | Who covers what |
| P3 | Marcus returns at 8:30, sits at the desk in the spare room. Calls and email are an abstract bar that fills. Elena comes in, looks at his screen, says nothing, then: "Is that the Hendricks thing again?" "It's fine." | Work the desk until noon (speed 4). | Time controls | The job (see section 3) |
| P4 | Jess is in her room with the door shut. Elena asks Marcus to ask her to do the dishes because "she doesn't listen to me." Marcus asks. Jess does them badly. | Give Jess "wash dishes." | Kids carry out tasks on their own timing | Jess's competence |
| P4a | Thursday afternoon, 1:50 PM. Marcus has a 2 PM call. Out the window, Walt (78, three doors down) is in the street in his slippers, looking for his mailbox. | Choose: walk Walt home (costs the start of the call), or "you're fine, Walt" and go in. | Choice has a cost | **`decisions.walt`**. Walt is a neighbour, not yet a tool. |
| P5 | Garage chores. Elena wants the gallon jugs moved off the high shelf so she can park the second car. There are 14 of them (about 10 full, 4 half). She says, "Why do we have so many of these?" Marcus: "Because of the monsoon thing in '19." | Choose: recycle the jugs, or carry them to the shelf by the door. | Carry and containers, choice has a cost | **`decisions.jugs`** (about 40 L of water if kept). Location is learned by hand. |
| P6 | Pantry check, 5 PM. The pantry is half empty; the list on the fridge has things crossed out. Elena: "I'm not going until Saturday." Marcus: "Then we'll eat pasta." She doesn't answer. | Open the pantry, read the stock. | Inventory | **The half-full pantry** |
| P7 | Evening. Mr. Pruitt is hosing his driveway in the heat, the generator is visible under a tarp in his side yard, and he grumbles about the HOA. | Walk to the gate, talk. | Talk to neighbours | **The generator** |
| P8 | Night. Elena goes to bed first. Marcus stays up on the couch with his phone. The log gives us the first "unspoken" line: "The bedroom door is closed. It was open on Tuesday." | Pause. Z to sleep. | Sleep, day rollover | The distance |

### Day 0 (Friday, July 10): about 10 minutes

| # | Beat | Player does | Teaches | Sets up |
|---|---|---|---|---|
| P9 | Morning. Theo wheezes after running up the hall. Elena finds the inhaler in the kitchen drawer and shakes it. "It's almost empty. Did we refill this?" "I thought you did." | Give Theo the inhaler (use item on a person). | Use items on people | **The inhaler**; a spare is in the Camry |
| P10 | Grocery run. Marcus and Elena drive to Fry's together. Jess is left in charge of Theo, and she tells Marcus, "I'm not his babysitter." | Select both parents, "help together" on the cart (two carrying a heavy load). | Help together, shared tasks | Money, sacrifice |
| P11 | At the register the card is declined, then works on the second try. Elena looks at the screen and not at him. One thing has to go back, and they argue about which in low voices: the case of water, the pharmacy pickup (Theo's spare inhaler and Elena's BP refill, $45), or Jess's birthday things. Nothing more is said in the car. | Choose what to put back. | Choice has a cost | **`decisions.cart`**, the thin stock |
| P12 | Home by 1 PM. Heat is 111. Jess has let Theo play in the sprinkler, which she thinks is hilarious and he thinks is the best day of his life. | Optional: join them. | Morale | Okafor pool seen over the wall |
| P13 | Afternoon thunderhead on the horizon, no rain. Mr. Pruitt: "They said the grid was strained. Said it on the radio." | None. | Foreshadow | The grid |
| P13a | 5 PM. Marcus finishes work and the Camry's gauge is low. At the Circle K it is $58 to fill up, the card might be declined again, and Theo is whining in the back. | Choose: fill up now, or "I'll do it Saturday." | Choice has a cost | **`decisions.gas`** |
| P14 | Evening. Family dinner, loud, kids bickering about what to watch. Elena and Marcus talk to each other through the kids ("Tell your father..."). Jess watches them. | Seat everyone. | Group dinner | Jess is paying attention |
| P14a | 10 PM. Something is wrong with the sky. An aurora shows over Phoenix, which never happens. The neighbours are out in the street filming it on their phones, Theo is on Marcus's shoulders, and Marcus and Elena stand together for a minute without a kid between them. The last normal night. The log says nothing about why. | Optional: walk into the street and watch. | Mood, a held moment | The calm before the outage; key art |
| P15 | Late. The game saves a snapshot, then jumps to 5:40 AM: the AC cuts out mid-sleep. | None. | Transition | The outage |

Prologue must-haves, in short:
- The player has made all four decisions (`jugs`, `walt`, `cart`, `gas`) and touched the pantry, Pruitt's yard and the inhaler. None of them is flagged as important.
- Money tension shows in exactly three places: the register, the fridge list and the lease line in P1. Do not add a fourth.
- Nobody argues loudly in the prologue. The strain is in who doesn't answer.

---

## 2. The outage and the escalation curve

The sim currently starts at 5:40 AM day 1 with outdoor temps creeping 0.6 F/day. The table below keeps that baseline and adds the social and supply curve. Day numbers count from the outage.

| Day | High (F) | Scarce | Street mood | New pressures | Player is learning |
|---|---|---|---|---|---|
| 1 | 115 | Nothing yet. Fridge food is fine, tub is filling. | Neighbours wander out at 6 AM, compare phones, trade rumours ("substation fire"). Cheerful, a little excited. | Taps sputter by 8:30. Saturday radio (hand-crank): I-17, I-10 and US-60 are all jammed and deadly, DPS says stay off the roads. Cell towers die within hours. The solar inverters are off: "We have solar, why is nothing on?" House passes 90 by afternoon. | Fill the tub, find the jugs, shade. Daytime is bad. Nobody is driving out. |
| 2 | 116 | Ice. Fridge food has to be eaten or lost. | Block party feel. Neighbours pool their ice chests on the Nguyens' porch. Okafors invite kids to the pool. | Garage door stuck shut. First hot night with a stuck window. | First night shift. Someone should stay awake. |
| 3 | 116 | Fridge food gone. Canned goods start to matter. | Still friendly, but people ask what you have. Pruitt has a generator and no gas, and asks what you can spare. | Pumps are dead (they need power). The ATM is dead. First pharmacy rumour. Walt, in the morning, looks at the panels. | Sleep days, work nights. The first honest watch rotation. Morning visits to Walt, in the heat. |
| 4 | 117 | Water. Tub is half. Store shelves bare. | The mood turns. A family on foot pulls a wagon toward the church. Someone is knocking on doors. | Theo's inhaler runs down. Elena feels dizzy (BP meds + dehydration). Walt is lucid one morning and confused the next. | Rationing as a decision, not a stat. Judge today's Walt. |
| 5 | 118 | Medication, clean water. | Rumours (looting at the Safeway, a cooling centre at the church, then it's closed). Okafors stop inviting people to the pool. | First heat-illness cases on the street, an ambulance that doesn't come. The solar circuit (battery, charge controller, a lucid Walt) can run a fan, the radio and Theo's nebulizer by day. | Who goes out? Who stays? Walt needs water too. |
| 6 to 7 | 118 | Everything. Pool water is green and Pruitt has a gate lock now. | Some have left on foot and their houses stand open. The ones who stayed watch the ones who did. | Break-ins, a dead neighbour (Mrs. Nguyen's husband). Day 6 radio: unrest downtown (looting, fires, Guard checkpoints) and a relief camp at the state fairgrounds, on the far side of it. | The daytime is for hiding. All real work is at night. There is a place to go, and it is far. |
| 8 to 11 | 119 | Water, fuel, safe places. | A few doors are boarded. A few people are kind in ways you didn't expect. | Decision pressure: hold out, or leave for the fairgrounds (drive if fuel was saved, walk at night if not). Around day 11, a Guard water convoy may turn onto the street. | The family has become a unit that works at night. The ending takes shape. |

Rules for the curve:
- Days 1 to 3 should be survivable by a distracted player. Death is nearly impossible if the tub is filled and the family sleeps through the afternoons.
- The turn on day 4 comes from supply, not scripts: the tub empties, the jugs thin out, the street's goodwill is a resource that the player has been spending.
- Nothing in the curve is an easy exit: the roads are stopped, the pumps are dead, and the grid does not return.
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
5. **Hold out or leave** (day 8 and later). One of them may want to go to the fairgrounds and the other to stay.

**Sample lines (log and dialogue).**
- "He holds the flashlight for her without being asked. She doesn't say anything about it."
- Elena: "You could have told me." Marcus: "I'm telling you now." Elena: "It's not the same."
- Jess, to nobody: "They're doing the thing where they're polite."
- "Elena takes the water from the lower shelf, the half-full one, and leaves the full one for the kids."

**Two directions, and both have to be playable.** They get closer in the way people do when work is shared: the log gets shorter, she hands him things without being asked. Or they split into two competent people running separate shifts who barely speak, and the kids carry the mood. Neither is punished. Both end differently (section 4).

---

## 4. Endings

Three outcomes, set in section 0. The final state is judged on four axes: who is alive, who is well (water, medication, injuries), whether the parents are together, and how Jess ended (relied on or relied upon), plus the neighbours. The ending text is built from those, not just chosen. The grid never returns, and Flagstaff is dialogue only.

**1. Held out (about day 11).** Trigger: the family is still in the house on day 11 with at least one member alive. A Guard water convoy turns onto the street, brought by kindness: someone the family helped (Walt's daughter, the Okafors' son, anyone) reported the street. The game never says so. Text reflects who and what is left: the neighbours who are gone, Pruitt's gate, the solar fan still turning, and the parents together on the step or in separate rooms, the same unit running. Deliberately quiet. The city has not come back; help has simply reached them.

**2. Got out (day 7 and later).** Trigger: the family leaves for the state fairgrounds relief camp after the day 6 radio report. By car if fuel was saved (`decisions.gas`, siphoning, trades), otherwise on foot at night, carrying Theo and rationing water through the downtown unrest and Guard checkpoints. Riskier, and maybe faster. Arrival: a camp of tents, water trucks and volunteers. The house is behind them. Bittersweet, and the text names what was left (Walt, if he was).

**3. Didn't all make it.** Trigger: a family member dies on either path. The survivors still reach outcome 1 or 2, and the text is quieter and names the loss. Each survivor gets a line. If no one survives, that is the one failure ending. A death never ends the game early.

### How the endings feel and play (Daniel, 2026-11-13)

Each ending is played in the world, like the outage night (wave 4e), then closes on short black cards.

- **Held out = a little hope and luck after the ordeal.** Day 11, early: a diesel engine and a backup beeper are heard before anything is seen, and Theo hears it first. The street fills again, as on the aurora night, but with empty jugs this time. The kindness shows and is never explained: the person the family helped climbs down from the cab, and a soldier says "Somebody called this street in." A soldier hands Theo a cold bottle of water, the first cold thing in eleven days (if Theo is alive; otherwise the youngest survivor). Last image: the solar fan still turning (if Walt wired it). Cards end on "The power did not come back that summer. The water trucks did."
- **Got out = desperation, no choices left.** It is never offered as a hopeful button. It opens only after the day 6 report, and only when something forces it: the tub is empty, Theo's inhaler is running out, or a break-in next door. Each person takes what they can carry from the house, and the rest is left. Marcus locks the door out of habit and stands there, while the neighbours who stayed watch. The trip is a short scripted drive (watching the fuel needle, a checkpoint) or a night walk (carrying Theo in turns) off the edge of the block. There is no new map region (Daniel accepted the cut for time). Arrival is not relief: a line, a wristband, a number ("You are 4,112"), and a cot in a hot tent. Last image: Marcus still has the house key in his pocket.
- **Didn't all make it = a punch in the gut.** Anyone can die, the kids included ("we hold no punches"). The death happens in the world, never off screen. Afterwards the routine runs around the gap: an empty place on the bed and at the table, and their portrait stays in the bar, greyed, for the rest of the game. The ending quotes their actual last spoken line from this playthrough ("Jess's last words to anyone were ..."). If the convoy comes after a death, the text says how many days it missed by, plainly.

**Recommendation for the jam: build 1 as the baseline, 2 as the second path, and fold 3 in as a variation of both.** Reasons:
- Outcome 1 needs only a trigger and a text builder, and it honours "I'm not sure what the end would be": the answer is an interval, not an escape.
- It fits the theme quietly: what the family cares about on day 11 is not what it was on Thursday.
- Outcome 2 adds a short interactive route sequence (drive or night walk) and a new map region, about two to three days of Codex time. Take it only if week 3 goes well; if cut, the day 6 report still plays as a rumour and the choice is a text beat.
- Flagstaff stays in dialogue as the road everyone else jammed.

---

## 5. Implementation notes

No code here; shape of the data only. Each piece is independent so Codex and MiniMax can work at the same time.

**Scripted beats: `src/data/beats.js` (schema first, Claude; content: MiniMax; interpreter: Codex).**
Fields: `id`, `phase` (`prologue` | `outage`), `day`, `at` (clock minute), `trigger` (`time`, `enter: <room>`, `use: <item or furniture id>`, `after: <beat id>`), `who` (speaker ids), `lines` (array of `{ who, text }`), `log` (plain log text), `teach` (control hint id, shown once), `effects` (same vocabulary as night events: morale, items, flags), `sets` (flag names). The prologue is 18 beats from section 1 (P1 to P15 plus P4a, P13a and P14a), each with a `teach` or `sets` entry. The four decision beats set `decisions.*`.

**Prologue flow (Codex).** A `phase` on `sim`: `prologue` runs fast with needs frozen at safe levels and no death. A Skip button jumps to `POWER_OUT_MIN` with default stock. New items: `inhaler_empty`, `inhaler_spare`, `fridge_list`. Prologue state stores flags (`touchedJugs`, `sawPruitt`, `inhalerChecked`) and a `decisions` object, `{ gas, jugs, cart, walt }` (`gas`: full or quarter; `jugs`: shelf or recycled; `cart`: water, pharmacy or birthday; `walt`: walked or waved off), set by the P4a, P5, P11 and P13a beats. Skip sets the defaults from section 1. Events, dialogue lines and endings read `decisions.*` through `needs.flag`; the narration never comments on them.

**Walt and the solar circuit (Codex).** Walt's lucidity is a per-visit value: a base by time of day (clear in the morning, confused by evening) plus a daily roll, shifted by `decisions.walt`. A lucid Walt gives correct instructions; a confused one can give a wrong connection (a shock or a fire), and the player has to read today's Walt from his lines. The solar circuit is a buildable that needs a deep-cycle battery (Pruitt's RV, the Okafors' golf cart or a car), a charge controller and a lucid Walt. It runs only in daylight, loses output in heat, and powers a fan, charging and Theo's nebulizer, never the AC. Keeping Walt alive draws on the water supply.

**Day-gated events: extend `src/data/events.js`.** The existing schema (`minDay`, `needs`, `watched` / `unwatched`) is enough. Add `maxDay`, `needs.flag`, and `needs.trustBelow` / `trustAbove`. MiniMax writes about 20 more events across days 3 to 10, matching the table in section 2. Suggested families: neighbour visits and requests (Pruitt, Okafor, Nguyen), heat illness in a family member, the inhaler running dry, a rumour that changes where the player might go, a night of someone leaving.

**Street state: `src/data/street.js`.** Per neighbour: id, attitude by day (`friendly`, `wary`, `hostile`, `gone`), what they offer or want, and conditions that shift them. Okafor and Pruitt are the two with real branches. Pruitt has a generator, no gas and an RV battery; Walt is a street entry with his own visit and lucidity data.

**Trust: `src/family.js` (Codex).** One scalar `trust` between Marcus and Elena, adjusted by event effects (`trust: +n`) and by a few hooks (watch handover, the refusal system). Display it nowhere. Jess's lines read it.

**Dialogue banks: `src/data/lines.js` (MiniMax).** Keyed by `speaker` and `situation` (e.g. `jess.noticesTrust.low`, `elena.givesWater`). Four to six variants each, very short, written in the voices of section 3.

**Endings: `src/data/endings.js`.** Three outcomes, `held_out`, `got_out` and `not_all_made_it`, each with `id`, `trigger`, `title`, and text fragments keyed by axis (alive, well, parents, Jess, neighbours). Triggers: `held_out` fires on day 11 with the family still at the house and at least one member alive (the convoy); `got_out` fires on arrival at the fairgrounds, by `drive` or `walk` depending on fuel (`decisions.gas`, siphoned and traded fuel); `not_all_made_it` is a modifier set when any member has died, swapping in the quieter fragments on top of either path, and total loss is the only failure ending. There is no grid-returns or Flagstaff ending. An ending builder (Codex) stitches fragments. MiniMax writes the fragments; Claude reviews tone.

**Intro card (`index.html`).** The current text assumes the outage has begun. Replace it with a short note: "Thursday, July 9. A normal week." and Skip. After the cutover the existing text can play at 5:40 AM day 1.

---

## Decided (Daniel, 2026-11-02)

1. **Endings:** superseded on 2026-11-03 by section 0 ("Outcomes"): held out, got out, and didn't all make it. The grid never returns. Flagstaff is mentioned in dialogue only.
2. **Marriage:** the confession is in: day 6, gated on trust, with the letter on day 8 as the fallback.
3. **Death is possible.** A death doesn't end the game. The survivors carry on to the ending, and its text reflects the loss.
