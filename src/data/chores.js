// Dry Heat prologue chores: optional, parallel, ordinary tasks with a time window (docs/wave-4c.md, part B).
// Plain data, no imports. Content: MiniMax. Engine: Codex (src/beats.js).
// A chore never blocks a beat and is never required. Missed chores expire without comment.
//
// Schema
//   id       unique 'c-...'
//   day      -1 = Thursday July 9, 0 = Friday July 10
//   from,to  clock-minute window (0-1439) the chore is offered in
//   who      suggested person: 'marcus'|'elena'|'jess'|'theo' (hint + marker colour)
//   label    objective text, ordinary-life voice
//   do       { type: 'use'|'walk', target } or { type: 'order', kid: 'jess'|'theo', target }
//   minutes  game minutes of work at the target (use/order), default 10
//   lines    optional [{ who, text }] spoken when it completes
//   log      optional narration on completion (sober, present tense, one sentence)
//   reveal   optional { item, into }: one data/items.js item placed in that target's container
//
// Content notes (wave 4c part C)
//   Fourteen chores: seven on Thursday and seven on Friday, two or three windows open in every
//   stretch of both days. Elena and Jess get as many as Marcus: Marcus 4, Elena 5, Jess 5.
//   No window falls inside a trip. Elena is out with Theo Thursday 7:30 to 10:30, both parents are
//   at the store Friday 9:30 to 1 PM, and Marcus is at the gas station Friday 5 PM.
//   Eight of them have a short exchange. The strain is in who does not answer.
//   A reveal points at a later need (light, water, heat, cooking, medical, tools) without saying so.
//   Targets are the keys of mapBeatTargets (src/beats.js); items are ids of src/data/items.js.

export const CHORES = [
  // ---------------------------------------------------------------- Thursday
  {
    id: 'c-bins', day: -1, from: 435, to: 660, who: 'marcus',
    label: 'Bring the bins in from the curb', do: { type: 'walk', target: 'street' },
    lines: [
      { who: 'marcus', text: 'They were out all night.' },
      { who: 'jess', text: 'Something got into the recycling.' },
      { who: 'marcus', text: 'What did you leave out?' },
    ],
    log: 'The recycling bin is in the garage with the lid off. It smells like rain that never came.',
  },
  {
    id: 'c-tires', day: -1, from: 435, to: 690, who: 'marcus',
    label: 'Check the tires on the Camry', do: { type: 'use', target: 'car' }, minutes: 8,
    log: 'The left rear is soft. The spare is under the trunk floor, under the ice packs.',
  },
  {
    id: 'c-hose', day: -1, from: 630, to: 870, who: 'elena',
    label: 'Water the citrus', do: { type: 'use', target: 'garage-shelf' }, minutes: 12,
    lines: [
      { who: 'elena', text: 'The lemon tree is done for the week.' },
      { who: 'marcus', text: "It's July." },
      { who: 'elena', text: "The tree doesn't know that." },
    ],
    log: 'The hose was coiled on the shelf by the door, under a box of picture frames.',
    reveal: { item: 'garden_hose', into: 'garage-shelf' },
  },
  {
    id: 'c-flashlight', day: -1, from: 660, to: 900, who: 'jess',
    label: 'Find a flashlight for the closet bulb', do: { type: 'order', kid: 'jess', target: 'inhaler' }, minutes: 8,
    log: 'The flashlight was in the kitchen drawer, under the takeout menus.',
    reveal: { item: 'flashlight', into: 'inhaler' },
  },
  {
    id: 'c-sheets', day: -1, from: 810, to: 1080, who: 'elena',
    label: 'Strip the beds', do: { type: 'use', target: 'beds' }, minutes: 12,
    lines: [
      { who: 'elena', text: 'The good sheets are in the hall closet.' },
      { who: 'marcus', text: 'Which closet?' },
      { who: 'elena', text: "There's one hall closet." },
    ],
    log: 'The good sheets are folded and back in the hall closet.',
  },
  {
    id: 'c-mail', day: -1, from: 900, to: 1320, who: 'jess',
    label: 'Get the mail off the porch', do: { type: 'order', kid: 'jess', target: 'front-door' }, minutes: 8,
    lines: [
      { who: 'jess', text: 'The mail is off the porch.' },
      { who: 'elena', text: 'Leave it on the table.' },
      { who: 'jess', text: "Half of it isn't ours." },
    ],
    log: 'The mail goes in the drawer by the door with the takeout menus and the rubber bands.',
  },
  {
    id: 'c-table', day: -1, from: 1080, to: 1320, who: 'elena',
    label: 'Set the table for dinner', do: { type: 'use', target: 'dinner-table' }, minutes: 12,
    lines: [
      { who: 'elena', text: 'Can you get the plates down?' },
      { who: 'marcus', text: "We're not eating till seven." },
      { who: 'elena', text: "I know when we're eating." },
    ],
    log: 'The table is set. The good plates stay in the cabinet for Saturday.',
  },

  // ----------------------------------------------------------------- Friday
  {
    id: 'c-breakfast', day: 0, from: 420, to: 570, who: 'marcus',
    label: 'Make breakfast', do: { type: 'use', target: 'fridge' }, minutes: 12,
    lines: [
      { who: 'theo', text: 'Waffles.' },
      { who: 'marcus', text: 'There are no waffles.' },
      { who: 'theo', text: 'There are waffles if you make them.' },
    ],
    log: 'Two bottles of water are in the fridge door, still cold.',
    reveal: { item: 'water_bottle', into: 'fridge' },
  },
  {
    id: 'c-drawer', day: 0, from: 420, to: 840, who: 'jess',
    label: 'Sort the junk drawer', do: { type: 'order', kid: 'jess', target: 'inhaler' }, minutes: 10,
    log: 'The drawer has takeout menus, rubber bands and the old can opener.',
    reveal: { item: 'can_opener', into: 'inhaler' },
  },
  {
    id: 'c-radio', day: 0, from: 570, to: 900, who: 'jess',
    label: 'Find the radio', do: { type: 'order', kid: 'jess', target: 'couch' }, minutes: 10,
    lines: [
      { who: 'jess', text: 'Where did the radio go?' },
      { who: 'elena', text: 'It was in here yesterday.' },
    ],
    log: 'The hand-crank radio is on the side table in the living room, under the mail.',
    reveal: { item: 'radio_handcrank', into: 'couch' },
  },
  {
    id: 'c-medkit', day: 0, from: 780, to: 1080, who: 'elena',
    label: 'Check the first aid kit in the trunk', do: { type: 'use', target: 'car' }, minutes: 12,
    log: 'The first aid kit is under the emergency flap in the trunk, behind the registration.',
    reveal: { item: 'first_aid_kit', into: 'car' },
  },
  {
    id: 'c-laundry', day: 0, from: 900, to: 1260, who: 'elena',
    label: 'Fold the laundry', do: { type: 'use', target: 'couch' }, minutes: 15,
    lines: [
      { who: 'elena', text: 'The towels are washed.' },
      { who: 'marcus', text: 'Leave them on the couch.' },
      { who: 'elena', text: "I'll do it, then." },
    ],
    log: 'The clean laundry is folded on the couch. The good sheets stay on top of the pile.',
    reveal: { item: 'bed_sheet', into: 'couch' },
  },
  {
    id: 'c-bins-out', day: 0, from: 1080, to: 1380, who: 'jess',
    label: 'Take the bins out', do: { type: 'order', kid: 'jess', target: 'street' }, minutes: 8,
    log: 'The bin goes to the curb with the lid down. The other one keeps until morning.',
  },
  {
    id: 'c-cooler', day: 0, from: 1140, to: 1380, who: 'marcus',
    label: 'Put the camping cooler back in the garage', do: { type: 'use', target: 'car' }, minutes: 15,
    log: 'The cooler is on the shelf by the door, next to the hose.',
    reveal: { item: 'cooler', into: 'garage-shelf' },
  },
];
