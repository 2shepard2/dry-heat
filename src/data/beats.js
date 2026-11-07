// Dry Heat prologue beats: Thursday July 9 and Friday July 10, the two normal days before the outage.
// Plain data, no imports. Content: MiniMax (from docs/STORY.md section 1, beats P1-P15 + P4a, P13a, P14a).
// Interpreter: Codex (src/beats.js).
//
// Beats run in array order. A beat starts when the previous beat is done AND the clock has reached `at`.
// Between beats the clock runs normally; only an explicit sleep skips to the next morning.
// On start: `objectives` lead the day’s accumulated to-do list; `lines` are spoken in order,
// 2.5 real seconds apart, as Name: "text" in the log. `log` prints and `teach` shows its hint once.
// The beat is done when `do`, any `then` trip, and its spoken lines finish (or on an optional timeout).
// Nothing in a prologue beat can hurt anyone. The narration never says why something matters.
//
// Schema
//   id          'p1', 'p4a', ... (matches STORY.md section 1)
//   day         -1 = Thursday July 9, 0 = Friday July 10
//   at          earliest clock minute (0-1439) the beat may start
//   lines       [{ who: 'marcus'|'elena'|'jess'|'theo'|'walt'|'pruitt'|'okafor'|'radio', text }]
//   log         optional plain narration line (sober, present tense, one sentence)
//   objectives  array of short strings, added to the day’s persistent list. Ordinary life on
//               Thursday ("Make coffee", "Get Theo to day camp", "Finish the Hendricks deck"). This list is
//               where the theme lives: the outage later replaces it with survival, without comment.
//   covers      optional array parallel to objectives: beat id that completes each item;
//               'camp-pickup' / 'friday-camp-pickup' are completed by the scheduled return, not the order
//   activeObjective optional index of the current action in objectives (default 0); other items are dim
//   then        optional { type: 'trip', who: [ids], target, minutes?, until?, label, away? }
//               starts after do succeeds; everyone walks to the car before leaving; beat waits for return
//               until = local clock minute of return on this beat's day (otherwise minutes = trip length)
//               away: { who, until, pickup, minutes?, id? } keeps one traveller off map after driver returns;
//               pickup leaves minutes (default 20) before until, then both come home and id completes
//   teach       optional one-line control hint shown once, e.g. 'Right-click to walk. Click furniture for actions.'
//   do          what the player must do; one of:
//     { type: 'use', who?, target }               a family member (any, or `who`) uses the target
//     { type: 'order', kid: 'jess'|'theo', target }  give a kid an order at the target
//     { type: 'walk', who?, target }              someone reaches the target
//     { type: 'together', target }                both parents work the target together (help system)
//     { type: 'trip', who: [ids], target, minutes, label }  they leave by car (off map) and come back
//     { type: 'choice', flag, prompt, target?, who?: [ids], options: [{ value, label, lines?, log?, minutes? }] }
//                                                 a small card with 2-3 buttons; sets decisions[flag]=value;
//                                                 `minutes` = time the option costs; `lines` play after picking
//     { type: 'sleep' }                           everyone is put to bed (Z) and the day rolls over
//     { type: 'wait', minutes }                   nothing to do; the clock runs
//   optional    true = the beat is skippable; it ends itself after `timeout` minutes (default 30)
//   sets        optional array of flag names set true when done (touchedJugs, sawPruitt, inhalerChecked, ...)
//   outage      true on the last beat only (P15): when done, the game cuts to day 1, 5:40 AM, power out
//
// Targets (Codex maps these to map objects; use only these):
//   coffee, desk, sink, fridge, pantry, garage-jugs, garage-shelf, car, inhaler, couch, dinner-table,
//   beds, sprinkler, front-door, street, walt-mailbox, walt, pruitt-gate, okafor-wall, gas-station, store
//
// Decision options must use exactly these values (STORY.md section 0; cart = what is PUT BACK):
//   walt: 'walked' | 'wavedOff'     jugs: 'shelf' | 'recycled'
//   cart: 'water' | 'pharmacy' | 'birthday'     gas: 'full' | 'quarter'

// Who does what (wave 4a): the work is shared, and every step's actor is home at that hour.
//   Marcus  p1 coffee, p2 camp run, p3 desk, p7 Pruitt, p13 the sky, p13a the gas
//   Elena   p4a Walt, p6 pantry, p9 the meds and the camp run, p10 the register and the drive home,
//           p14 dinner, p14a the street
//   Jess    p4 the dishes, p5 the jugs, p11 the groceries in, p12 the sprinkler
//   Theo    p2 the car, p9 the inhaler, p13a the gas station; also in p12, p14 and p14a
// The four decisions: gas is Marcus (p13a), cart is Elena (p10), jugs is Jess (p5), walt is Elena (p4a).
// The checkout (p10) is the beat's own step and the drive home is its `then` trip, so the register
// comes before the return. p10 and p13a both decide first and then drive.
//
export const BEATS = [
  {
    id: 'p1', day: -1, at: 7 * 60 + 15,
    covers: ['p1', 'p2', 'p3'],
    objectives: ['Make coffee', 'Get Theo to day camp', 'Finish the Hendricks deck by noon'],
    lines: [
      { who: 'elena', text: 'Your lunch is in the blue bag. The ice pack is on the left.' },
      { who: 'elena', text: 'Eggs are four dollars now. Four.' },
      { who: 'marcus', text: 'We have the panels. Something has to be saving us money.' },
      { who: 'elena', text: 'A hundred and forty a month says it isn\'t.' },
    ],
    log: 'The coffee maker gurgles and gives up. The kitchen is the cool part of the house.',
    teach: 'Click Marcus to select him. Right-click to walk. Click furniture for actions.',
    do: { type: 'use', who: 'marcus', target: 'coffee' },
    sets: ['leaseTalk'],
  },

  {
    id: 'p2', day: -1, at: 7 * 60 + 30,
    covers: ['p2', 'p3', 'p3'],
    then: { type: 'trip', who: ['marcus', 'theo'], target: 'car', until: 8 * 60 + 25, label: 'Marcus drives Theo to day camp', away: { who: 'theo', until: 15 * 60, pickup: 'elena', minutes: 20, id: 'camp-pickup' } },
    objectives: ['Get Theo to day camp', 'Take the nine o\'clock call', 'Finish the Hendricks deck by noon'],
    lines: [
      { who: 'theo', text: 'I have a stomachache.' },
      { who: 'elena', text: 'You have a stomachache that starts on Wednesdays.' },
      { who: 'elena', text: 'Can you take him? I have the dentist at nine.' },
      { who: 'marcus', text: 'I have got a call at nine.' },
      { who: 'elena', text: 'You had the nine o\'clock last week.' },
    ],
    log: 'Nobody moves for a second. Marcus looks at the clock. Then Theo puts his shoes on without being told.',
    teach: 'Click Theo, then choose "Get in the car."',
    do: { type: 'order', kid: 'theo', target: 'car' },
    sets: ['theoToCamp'],
  },

  {
    id: 'p3', day: -1, at: 8 * 60 + 30,
    covers: ['p3', 'p4a', 'camp-pickup'],
    objectives: ['Finish the Hendricks deck', 'Take the two o\'clock call', 'Get Theo from camp at three'],
    lines: [
      { who: 'elena', text: 'Is that the Hendricks thing again?' },
      { who: 'marcus', text: 'It is fine. It is just restructuring.' },
      { who: 'elena', text: 'You said that in April.' },
      { who: 'marcus', text: 'Then it is still fine.' },
    ],
    log: 'She stands in the doorway a while. Then she goes out and pulls the door to without letting it click.',
    teach: 'Click the desk to work. The clock moves on its own while you do.',
    do: { type: 'use', who: 'marcus', target: 'desk' },
    sets: ['hendricksDeck'],
  },

  {
    id: 'p4', day: -1, at: 12 * 60,
    covers: ['p4', 'camp-pickup', 'p3'],
    objectives: ['Ask Jess to do the dishes', 'Pick Theo up from camp at three', 'Finish the Hendricks deck'],
    lines: [
      { who: 'elena', text: 'Jess, the dishes. Both plates.' },
      { who: 'jess', text: 'Sure. I will do them now. I will do them great.' },
      { who: 'elena', text: 'She has been in that room all morning.' },
    ],
    log: 'There are two plates in the sink and they are not clean.',
    teach: 'Click Jess, then choose an order. She gets to it when she feels like it.',
    do: { type: 'order', kid: 'jess', target: 'sink' },
    sets: ['jessDidDishes'],
  },

  {
    id: 'p4a', day: -1, at: 13 * 60 + 50,
    covers: ['p4a', 'camp-pickup', 'p4a'],
    objectives: ['Take the two o\'clock call', 'Get Theo from camp at three', 'Get back in time for the pickup'],
    lines: [
      { who: 'walt', text: 'Which one is mine? They have moved them again.' },
      { who: 'elena', text: 'The blue one, Walt. Third from the corner.' },
      { who: 'walt', text: 'I have to get there before the mail comes.' },
      { who: 'elena', text: 'It is ten to two. My sister is calling at two.' },
    ],
    log: 'Walt is in his slippers in the middle of the street with a letter opener in his hand.',
    do: {
      type: 'choice', flag: 'walt', target: 'walt-mailbox', who: ['elena'],
      prompt: 'Walt is looking for his mailbox. It is ten to two.',
      options: [
        {
          value: 'walked', label: 'Walk him home', minutes: 20,
          lines: [
            { who: 'walt', text: 'That is all right. You did not have to.' },
            { who: 'elena', text: 'It is four doors.' },
          ],
          log: 'Twenty minutes. Her sister calls and it rings out in the kitchen.',
        },
        {
          value: 'wavedOff', label: 'You\'re fine, Walt', minutes: 5,
          lines: [
            { who: 'walt', text: 'I am fine. I am looking for my mailbox.' },
            { who: 'elena', text: 'Sure.' },
          ],
          log: 'He goes in. Walt is still at the curb when the door shuts.',
        },
      ],
    },
    sets: ['sawWalt'],
  },

  {
    id: 'p5', day: -1, at: 14 * 60 + 30,
    objectives: ['Move the jugs off the high shelf', 'Clear the garage floor for Saturday', 'Find out how many are full'],
    lines: [
      { who: 'elena', text: 'I want the garage floor for the second car.' },
      { who: 'jess', text: 'How many of them are full?' },
      { who: 'marcus', text: 'Ten.' },
      { who: 'jess', text: 'Then I will move them.' },
    ],
    log: 'Fourteen gallon jugs, ten full and four half, on the shelf above the tool chest.',
    do: {
      type: 'choice', flag: 'jugs', target: 'garage-jugs', who: ['jess'],
      prompt: 'Elena wants the garage floor. The jugs have to go somewhere.',
      options: [
        {
          value: 'shelf', label: 'Put them on the shelf by the door', minutes: 10,
          lines: [
            { who: 'jess', text: 'They fit under the shelf by the door.' },
            { who: 'elena', text: 'Good. Thank you.' },
          ],
          log: 'Two trips up and down the ladder. All fourteen end up by the door.',
        },
        {
          value: 'recycled', label: 'Recycle the jugs', minutes: 15,
          lines: [
            { who: 'elena', text: 'The truck comes Friday morning.' },
            { who: 'jess', text: 'Then they will be gone by nine.' },
          ],
          log: 'Two trips to the curb, and the garage floor is bare.',
        },
      ],
    },
    sets: ['touchedJugs'],
  },

  {
    id: 'p6', day: -1, at: 17 * 60,
    objectives: ['Check the pantry', 'Update the list on the fridge', 'Get dinner started'],
    lines: [
      { who: 'marcus', text: 'We are half out. The list on the fridge has most of it crossed off.' },
      { who: 'elena', text: 'I am not going until Saturday.' },
      { who: 'marcus', text: 'Then we will eat pasta.' },
      { who: 'elena', text: 'I am calling my sister instead.' },
    ],
    log: 'She writes on the list. The crossed-off lines have prices next to them.',
    teach: 'Click the pantry to see what is left in it.',
    do: { type: 'use', who: 'elena', target: 'pantry' },
    sets: ['checkedPantry'],
  },

  {
    id: 'p7', day: -1, at: 19 * 60 + 30,
    objectives: ['Say hello to Mr. Pruitt', 'Water the plants', 'Get the hose back'],
    lines: [
      { who: 'pruitt', text: 'Hosing the driveway. It does not help. It looks like it helps.' },
      { who: 'marcus', text: 'That tarp. Is that a generator?' },
      { who: 'pruitt', text: 'That is a generator. It has not run since May.' },
      { who: 'marcus', text: 'No gas in it?' },
      { who: 'pruitt', text: 'No gas. And the HOA wants to talk about the tarp.' },
    ],
    log: 'He hoses the same four feet of driveway over and over. The water is hot enough to steam.',
    teach: 'Walk to the gate and click the neighbour to talk.',
    do: { type: 'walk', who: 'marcus', target: 'pruitt-gate' },
    sets: ['sawPruitt'],
  },

  {
    id: 'p8', day: -1, at: 22 * 60,
    activeObjective: 2,
    objectives: ['Finish a chapter', 'Lock up', 'Go to bed'],
    lines: [
      { who: 'elena', text: 'I am going up.' },
      { who: 'marcus', text: 'Okay.' },
      { who: 'theo', text: 'Can the fan stay on?' },
      { who: 'marcus', text: 'The fan stays on.' },
    ],
    log: 'The bedroom door is closed. It was open on Tuesday.',
    teach: 'Press Z to send everyone to bed and turn the day over.',
    do: { type: 'sleep' },
    sets: ['bedroomDoorClosed'],
  },

  {
    id: 'p9', day: 0, at: 7 * 60 + 40,
    covers: ['p9', 'p9', 'p9'],
    then: { type: 'trip', who: ['elena', 'theo'], target: 'car', until: 9 * 60 + 15, label: 'Elena drives Theo to morning camp', away: { who: 'theo', until: 12 * 60, pickup: 'elena', minutes: 20, id: 'friday-camp-pickup' } },
    objectives: ['Check the inhaler', 'Make breakfast', 'Get Theo to camp'],
    lines: [
      { who: 'elena', text: 'It is almost empty. Did we refill this?' },
      { who: 'marcus', text: 'I thought you did.' },
      { who: 'elena', text: 'Well. I thought you did.' },
      { who: 'theo', text: 'I am fine. It only happens when I run.' },
      { who: 'elena', text: 'My blood pressure pills are down to nine days.' },
    ],
    log: 'The blue one in the kitchen drawer gives about one more puff. The other one is in the Camry, in the glove box.',
    teach: 'Click the inhaler, then choose who gives it to him.',
    do: { type: 'use', who: 'theo', target: 'inhaler' },
    sets: ['inhalerChecked'],
  },

  {
    id: 'p10', day: 0, at: 9 * 60 + 30,
    covers: ['p10', 'p10', 'p10'],
    activeObjective: 1,
    objectives: ['Get the groceries', 'Put one thing back on the belt', 'Get home before the heat'],
    lines: [
      { who: 'jess', text: 'So I am in charge of the house.' },
      { who: 'marcus', text: 'Until we get back.' },
      { who: 'jess', text: 'That is a lot of hours.' },
      { who: 'marcus', text: 'It was declined.' },
      { who: 'elena', text: 'Try it again.' },
      { who: 'marcus', text: 'It went through.' },
      { who: 'elena', text: 'Then one thing goes back.' },
    ],
    log: 'Fry\'s is a hundred and eleven degrees inside. They go through it fast and the cooler sits between them on the way back.',
    teach: 'One thing has to go back on the belt. Choose below.',
    do: {
      type: 'choice', flag: 'cart', target: 'store', who: ['marcus', 'elena'],
      prompt: 'One thing has to go back on the belt. The pharmacy order is forty-five dollars.',
      options: [
        {
          value: 'water', label: 'Put back the case of water',
          lines: [
            { who: 'elena', text: 'The case of water goes back.' },
            { who: 'marcus', text: 'Sure.' },
          ],
          log: 'The case of water goes back on the belt. Elena does not say anything else about it.',
        },
        {
          value: 'pharmacy', label: 'Put back the pharmacy pickup',
          lines: [
            { who: 'elena', text: 'That is my blood pressure and his inhaler.' },
            { who: 'marcus', text: 'I know what it is.' },
          ],
          log: 'The pharmacy bag goes back on the belt. Marcus keeps looking at it on the cart.',
        },
        {
          value: 'birthday', label: 'Put back Jess\'s birthday things',
          lines: [
            { who: 'elena', text: 'She has been talking about that cake since Tuesday.' },
            { who: 'marcus', text: 'She has.' },
          ],
          log: 'The birthday things go back on the belt. The cake is in a white box with a bow on it.',
        },
      ],
    },
    then: { type: 'trip', who: ['marcus', 'elena'], target: 'store', minutes: 35, label: 'Marcus and Elena drive home with the groceries' },
    sets: ['cardDeclined', 'shoppedTogether'],
  },

  {
    id: 'p11', day: 0, at: 10 * 60 + 15,
    objectives: ['Get the groceries in', 'Get the cold ones in the freezer', 'Take the trash out'],
    lines: [
      { who: 'elena', text: 'Jess, help me with the bags.' },
      { who: 'jess', text: 'Give me the cold ones first.' },
      { who: 'marcus', text: 'Cold ones first.' },
    ],
    log: 'Jess takes the cold ones straight to the freezer. The rest goes on the counter.',
    teach: 'Click Jess, then choose "Use Front door".',
    do: { type: 'use', who: 'jess', target: 'front-door' },
    sets: ['groceriesIn'],
  },

  {
    id: 'p12', day: 0, at: 13 * 60,
    objectives: ['Have something cold to drink', 'Watch Theo in the sprinkler', 'Bring the laundry in'],
    lines: [
      { who: 'jess', text: 'It is one hundred and eleven degrees.' },
      { who: 'theo', text: 'This is the best day of my life.' },
      { who: 'jess', text: 'It has been the best day of your life since Tuesday.' },
      { who: 'marcus', text: 'Both of you. Inside in ten minutes.' },
      { who: 'jess', text: 'Mara says there are kids down at the canal.' },
      { who: 'theo', text: 'Can I come?' },
      { who: 'jess', text: 'No.' },
    ],
    log: 'Over the wall, the Okafor pool has four people in it and no shade over it.',
    teach: 'Click Jess, then the sprinkler. You can let it run without you.',
    do: { type: 'use', who: 'jess', target: 'sprinkler' },
    optional: true,
    timeout: 30,
    sets: ['okaforPoolSeen'],
  },

  {
    id: 'p13', day: 0, at: 16 * 60,
    activeObjective: 2,
    covers: ['p3', 'p13', 'p14a'],
    objectives: ['Finish the Hendricks deck', 'Get the laundry off the line', 'Watch the sky'],
    lines: [
      { who: 'pruitt', text: 'They said the grid was strained. Said it on the radio.' },
      { who: 'marcus', text: 'Strained how?' },
      { who: 'pruitt', text: 'They did not say. It is not raining. That is what I would call strained.' },
      { who: 'marcus', text: 'It is not going to rain.' },
    ],
    log: 'There is a thunderhead sitting over the west end of the valley and it is not moving.',
    teach: 'There is nothing to do but wait. The sky is worth a look.',
    do: { type: 'wait', minutes: 45 },
    sets: ['gridStrained'],
  },

  {
    id: 'p13a', day: 0, at: 17 * 60,
    then: { type: 'trip', who: ['marcus', 'theo'], target: 'gas-station', minutes: 20, label: 'Marcus and Theo drive to the gas station' },
    objectives: ['Fill the tank', 'Get home before dark', 'Start dinner'],
    lines: [
      { who: 'theo', text: 'Are we going to the store?' },
      { who: 'marcus', text: 'No. Just the tank.' },
      { who: 'theo', text: 'You always say just the tank.' },
    ],
    log: 'The gauge is under a quarter of a tank. It is fifty-eight dollars to fill it.',
    do: {
      type: 'choice', flag: 'gas', target: 'gas-station', who: ['marcus', 'theo'],
      prompt: 'The gauge is low. It is fifty-eight dollars to fill the tank.',
      options: [
        {
          value: 'full', label: 'Fill it up', minutes: 15,
          lines: [
            { who: 'theo', text: 'Can I get a juice box?' },
            { who: 'marcus', text: 'No. Just the tank.' },
            { who: 'theo', text: 'You always say that.' },
          ],
          log: 'Eight gallons in, fifteen minutes at the pump. Theo falls asleep before it finishes.',
        },
        {
          value: 'quarter', label: 'I will do it Saturday', minutes: 3,
          lines: [
            { who: 'marcus', text: 'We will do it Saturday.' },
            { who: 'theo', text: 'Saturday?' },
            { who: 'marcus', text: 'Saturday.' },
          ],
          log: 'The whole way home Theo asks if they are going to the store.',
        },
      ],
    },
    sets: ['lowGauge'],
  },

  {
    id: 'p14', day: 0, at: 19 * 60,
    objectives: ['Get dinner on the table', 'Pick something to watch', 'Get everybody in their seat'],
    lines: [
      { who: 'theo', text: 'I want the one with the dog.' },
      { who: 'jess', text: 'There is no dog in it.' },
      { who: 'theo', text: 'There is a dog in every one of them.' },
      { who: 'elena', text: 'Tell your father what we agreed on.' },
      { who: 'marcus', text: 'We agreed on the one with the dog.' },
    ],
    log: 'Nobody finishes a sentence. Jess watches the two of them over the top of the table and does not say anything.',
    teach: 'Click the table to sit everybody down.',
    do: { type: 'use', who: 'elena', target: 'dinner-table' },
    sets: ['satDownTogether'],
  },

  {
    id: 'p14a', day: 0, at: 22 * 60,
    objectives: ['Go out into the street', 'Watch the sky', 'Find out what it is'],
    lines: [
      { who: 'theo', text: 'Is that the northern lights?' },
      { who: 'marcus', text: 'Not up here.' },
      { who: 'okafor', text: 'It is on the news. It is on the news right now!' },
      { who: 'jess', text: 'Nobody is going to believe us.' },
    ],
    log: 'Green over the whole street, and half the neighbours filming it from the middle of the road. Theo rides on Marcus\'s shoulders and Elena stands beside him. For about a minute none of them says anything.',
    teach: 'You can walk out into the street and watch it.',
    do: { type: 'walk', who: 'elena', target: 'street' },
    optional: true,
    timeout: 30,
    sets: ['sawAurora'],
  },

  {
    id: 'p15', day: 0, at: 23 * 60 + 30,
    objectives: ['Go to bed', 'Leave the porch light on', 'Close the blinds'],
    lines: [
      { who: 'marcus', text: 'Elena.' },
      { who: 'elena', text: 'Mm.' },
      { who: 'marcus', text: 'Nothing. Go to sleep.' },
    ],
    log: 'Everybody is asleep. The fan runs in the other room. Outside it is still July and the sky is clear.',
    teach: 'Nothing left to do tonight.',
    do: { type: 'wait', minutes: 30 },
    outage: true,
    sets: ['lastNormalNight'],
  },
];
