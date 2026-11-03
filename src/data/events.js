// Dry Heat night events. Plain data, no imports. Content: MiniMax. Interpreter: src/events.js (Codex).
//
// SHIFT, part 2 (JAM.md): someone has to stay awake. Between 10 PM and 5 AM the game rolls for an event
// roughly every 90 game minutes. If a parent is on watch (awake, not working a task), the `watched` branch
// runs; otherwise `unwatched` runs. Unwatched is always worse. Nothing supernatural, nothing gamey:
// heat, thirst, a scared kid, a desperate neighbour, animals, the house itself.
//
// Schema
//   id        unique kebab-case
//   weight    relative odds (1 = normal, 0.3 = rare)
//   minDay    earliest day it can happen (day 1 = first day of the outage)
//   once      true = at most once per game
//   needs     optional conditions, all must hold:
//               { tubMinL: number }       tub has at least this many liters
//               { kidAwake: true }        Jess or Theo is awake
//               { carryingFood: true }    someone holds a food item
//   text      log line when it starts (present tense, plain, one or two sentences)
//   watched   { text, effects }   the watcher deals with it
//   unwatched { text, effects }   nobody was up
//
// Effects (all optional; the interpreter clamps):
//   tubL: -n            liters gone from the tub
//   morale: { all|parents|kids|jess|theo: delta }
//   energy: { all|parents|kids|watcher|jess|theo: delta }
//   wake: 'all' | 'kids' | 'parents'   wakes them (broken sleep)
//   loseFood: n         n random food items gone from the house
//   theoWanders: true   Theo leaves the house and stands in the yard until fetched
//   log: 'warn'|'bad'   tone of the result line (default plain)

export const NIGHT_EVENTS = [
  {
    id: 'tub-thief', weight: 1, minDay: 2, needs: { tubMinL: 20 },
    text: 'Something scrapes at the back slider. A shape on the patio, trying the handle.',
    watched: { text: 'The watcher says loudly that the house is awake. The shape goes over the wall. Footsteps, then nothing.', effects: { energy: { watcher: -4 } } },
    unwatched: { text: 'In the morning the slider is open a hand\'s width. Someone dipped a bucket in the tub.', effects: { tubL: -25, morale: { all: -10 }, log: 'bad' } },
  },
  {
    id: 'theo-nightmare', weight: 1.2, minDay: 1,
    text: 'Theo wakes up crying. He doesn\'t know where he is in the dark.',
    watched: { text: 'Someone holds him until his breathing slows. He sleeps.', effects: { morale: { theo: 5 }, energy: { watcher: -3 } } },
    unwatched: { text: 'Nobody hears him. He goes looking for the bathroom and ends up out the back door.', effects: { theoWanders: true, morale: { theo: -15 }, log: 'warn' } },
  },
];
