// Dry Heat prologue beats: Thursday July 9 and Friday July 10, the two normal days before the outage.
// Plain data, no imports. Content: MiniMax (from docs/STORY.md section 1, beats P1-P15 + P4a, P13a, P14a).
// Interpreter: Codex (src/beats.js).
//
// Beats run in array order. A beat starts when the previous beat is done AND the clock has reached `at`.
// On start: the objective panel is replaced by `objectives`, `lines` are spoken in order (a second or two
// apart, as  Name: "text"  in the log), `log` is printed, and `teach` shows its control hint once.
// The beat is done when its `do` is satisfied (or after `timeout` game minutes if `optional`).
// Nothing in a prologue beat can hurt anyone. The narration never says why something matters.
//
// Schema
//   id          'p1', 'p4a', ... (matches STORY.md section 1)
//   day         -1 = Thursday July 9, 0 = Friday July 10
//   at          earliest clock minute (0-1439) the beat may start; the clock jumps forward to it if idle
//   lines       [{ who: 'marcus'|'elena'|'jess'|'theo'|'walt'|'pruitt'|'okafor'|'radio', text }]
//   log         optional plain narration line (sober, present tense, one sentence)
//   objectives  array of short strings: the WHOLE objective panel while this beat runs. Ordinary life on
//               Thursday ("Make coffee", "Get Theo to day camp", "Finish the Hendricks deck"). This list is
//               where the theme lives: the outage later replaces it with survival, without comment.
//   teach       optional one-line control hint shown once, e.g. 'Right-click to walk. Click furniture for actions.'
//   do          what the player must do; one of:
//     { type: 'use', who?, target }               a family member (any, or `who`) uses the target
//     { type: 'order', kid: 'jess'|'theo', target }  give a kid an order at the target
//     { type: 'walk', who?, target }              someone reaches the target
//     { type: 'together', target }                both parents work the target together (help system)
//     { type: 'trip', who: [ids], target, minutes, label }  they leave by car (off map) and come back
//     { type: 'choice', flag, prompt, options: [{ value, label, lines?, log?, minutes? }] }
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

export const BEATS = [
  {
    id: 'p1', day: -1, at: 7 * 60 + 15,
    objectives: ['Make coffee', 'Get Theo to day camp', 'Finish the Hendricks deck by noon'],
    lines: [
      { who: 'elena', text: 'Eggs are four dollars now. Four.' },
      { who: 'marcus', text: 'We have the panels. Something has to be saving us money.' },
      { who: 'elena', text: 'A hundred and forty a month says it isn\'t.' },
    ],
    teach: 'Click Marcus to select him. Right-click to walk. Click furniture for actions.',
    do: { type: 'use', who: 'marcus', target: 'coffee' },
  },
];
