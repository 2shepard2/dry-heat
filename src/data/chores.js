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

export const CHORES = [
  {
    id: 'c-lunch', day: -1, from: 435, to: 480, who: 'elena',
    label: "Pack Theo's lunch", do: { type: 'use', target: 'fridge' }, minutes: 10,
    lines: [{ who: 'elena', text: 'He says he hates turkey now.' }, { who: 'marcus', text: 'Since when?' }],
  },
  {
    id: 'c-flashlight', day: -1, from: 660, to: 840, who: 'jess',
    label: 'Find a flashlight for the closet bulb', do: { type: 'order', kid: 'jess', target: 'inhaler' }, minutes: 8,
    log: 'The flashlight was in the kitchen drawer, under the takeout menus.',
    reveal: { item: 'flashlight', into: 'inhaler' },
  },
];
