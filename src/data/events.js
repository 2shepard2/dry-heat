// Dry Heat night events. Plain data, no imports. Content: MiniMax. Interpreter: src/events.js (Codex).
//
// Someone has to stay awake (JAM.md, theme section). Between 10 PM and 5 AM the game rolls for an event
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
  {
    id: 'heat-will-not-break', weight: 1, minDay: 1,
    text: 'Two in the morning. The house has not come down past a hundred degrees and the walls are still warm to the touch.',
    watched: { text: 'The watcher moves everyone off the west wall onto the tile floor and opens the slider to the cooler air outside.', effects: { morale: { all: 3 }, energy: { watcher: -4 } } },
    unwatched: { text: 'Nobody gets up. The house swells around the family and nobody wakes until the light comes up gray and hot.', effects: { energy: { all: -8 }, morale: { all: -5 }, log: 'warn' } },
  },
  {
    id: 'thirst-in-the-night', weight: 1.1, minDay: 2, needs: { tubMinL: 8 },
    text: 'Theo is thirsty and awake, asking out loud. He says his tongue feels like sand.',
    watched: { text: 'The watcher fills cups at the tub and stays up until the kids drink and settle down again.', effects: { tubL: -3, morale: { kids: 4 }, energy: { watcher: -3 } } },
    unwatched: { text: 'He finds the tub on his own. He drinks and stays in the water until his skin goes wrinkled and soft.', effects: { tubL: -9, energy: { kids: -4 }, morale: { theo: -4 }, log: 'warn' } },
  },
  {
    id: 'theo-ill', weight: 0.8, minDay: 2, needs: { kidAwake: true },
    text: 'Theo is sick. He has been throwing up since ten and he cannot keep the water down.',
    watched: { text: 'Someone stays on the bathroom floor with him, wipes his face, and gets him into dry clothes.', effects: { morale: { theo: 6 }, energy: { watcher: -6 } } },
    unwatched: { text: 'He vomits in the dark and lies in it. By morning he is worse and the smell has settled into the sheets.', effects: { morale: { theo: -12, all: -3 }, energy: { theo: -6 }, log: 'bad' } },
  },
  {
    id: 'jess-slips-out', weight: 0.8, minDay: 3, once: true,
    text: 'Jess\'s sandals are gone from the step and the screen door by the laundry room is standing open. The kids from the street meet at the canal after dark now.',
    watched: { text: 'The watcher finds her on the canal bank with three other kids and walks her home. They argue about it in low voices for an hour.', effects: { energy: { watcher: -7 }, morale: { jess: -6, parents: -2 } } },
    unwatched: { text: 'She comes back past three, muddy to the knees and quiet. The screen door was propped open behind her all night.', effects: { energy: { jess: -12 }, morale: { jess: -10, all: -5 }, log: 'bad' } },
  },
  {
    id: 'neighbor-at-door', weight: 1, minDay: 2,
    text: 'The woman from across the cul-de-sac is on the step with a baby carrier. She says her taps stopped an hour ago.',
    watched: { text: 'The watcher fills a bottle and a jar and hands them over. She says she will remember it.', effects: { tubL: -5, morale: { all: 5 }, energy: { watcher: -3 } } },
    unwatched: { text: 'She knocks for twenty minutes and then walks the street trying doors. The shed stands open in the morning and the food is gone.', effects: { loseFood: 2, morale: { all: -8 }, energy: { all: -4 }, log: 'bad' } },
  },
  {
    id: 'stranger-at-the-gate', weight: 0.3, minDay: 3, once: true,
    text: 'There is someone at the side gate asking for water. They will not say where they came from.',
    watched: { text: 'The watcher hands over a bottle through the gate and stays by the door until they walk off up the street.', effects: { tubL: -4, morale: { parents: -2 }, energy: { watcher: -5 } } },
    unwatched: { text: 'Nobody answers. Later the carport door stands open and the food on the garage shelf is gone.', effects: { loseFood: 3, morale: { all: -10 }, energy: { all: -5 }, log: 'bad' } },
  },
  {
    id: 'loose-dog', weight: 1, minDay: 1,
    text: 'A dog is loose in the street and moving slow in the heat. It stops across from the yard and watches the house.',
    watched: { text: 'The watcher opens the gate and sits on the curb with it. It lets itself be touched, then follows them in and lies down under the car.', effects: { morale: { all: 4 }, energy: { watcher: -3 } } },
    unwatched: { text: 'The dog paces and howls at the door for hours, then pushes the screen open and comes in. It knocks a glass over and nobody finds it until morning.', effects: { energy: { all: -7 }, morale: { all: -6 }, log: 'warn' } },
  },
  {
    id: 'javelinas-at-trash', weight: 0.9, minDay: 2, needs: { carryingFood: true },
    text: 'Javelinas are at the trash cans working the lids off. Something with food on it was left out in the open.',
    watched: { text: 'The watcher bangs a pot lid against the gate and they scatter. The rest of the trash gets dragged inside.', effects: { morale: { all: 4 }, energy: { watcher: -3 } } },
    unwatched: { text: 'Nobody hears them. They tip the cans, find the way in under the garage door, and take everything they can carry.', effects: { loseFood: 3, morale: { all: -8 }, energy: { kids: -4 }, log: 'bad' } },
  },
  {
    id: 'house-creaks', weight: 1.1, minDay: 1,
    text: 'The house is making noise. Timber ticks and knocks in the walls as the heat works on the frame.',
    watched: { text: 'The watcher walks the house with a flashlight and finds the joist that shifted. It settles with one loud bang and then stops.', effects: { morale: { all: 4 }, energy: { watcher: -4 } } },
    unwatched: { text: 'The knocking goes on until three. Every sound in the house sounds like somebody standing outside the door.', effects: { energy: { all: -6 }, morale: { all: -9 }, log: 'warn' } },
  },
  {
    id: 'car-alarm', weight: 1, minDay: 2,
    text: 'A car alarm goes off down the block. It stops for a minute and then starts again.',
    watched: { text: 'The watcher walks over and finds the owner standing in the road with the doors open. They kill it with the panic button.', effects: { energy: { watcher: -6 }, morale: { all: 3 } } },
    unwatched: { text: 'It goes on for hours. Every time it stops, somebody lies awake waiting for it to start again.', effects: { energy: { all: -8 }, morale: { all: -5 }, wake: 'all', log: 'warn' } },
  },
  {
    id: 'sirens-west', weight: 0.3, minDay: 3, once: true,
    text: 'Sirens somewhere west of the subdivision, a long way off. They sound close for a while and then start to fade.',
    watched: { text: 'The watcher listens from the back window and counts the engines. Whatever it is, it is moving away from here.', effects: { morale: { all: 3 }, energy: { watcher: -3 } } },
    unwatched: { text: 'The sound comes closer and then stops somewhere past the school. The house stays up listening to nothing.', effects: { energy: { all: -6 }, morale: { all: -7 }, wake: 'parents', log: 'warn' } },
  },
  {
    id: 'gunshot-north', weight: 0.3, minDay: 4, once: true,
    text: 'A single gunshot to the north, close enough to hear the crack come off the walls. Then nothing.',
    watched: { text: 'The watcher stands still in the yard and listens. Dogs bark one street over and then stop, and nobody comes down the road.', effects: { morale: { all: -5 }, energy: { watcher: -4 } } },
    unwatched: { text: 'Nobody hears it over the heat and the sleeping. The house is loud enough to cover anything that happens outside.', effects: { morale: { all: -10 }, energy: { all: -4 }, log: 'bad' } },
  },
  {
    id: 'power-across-the-street', weight: 0.9, minDay: 3,
    text: 'There are lights on two houses down the street. Somebody has a generator running and the sound comes through the wall.',
    watched: { text: 'The watcher pulls the shade across the window and the house goes dark. The generator runs all night, but the house stays quiet.', effects: { morale: { all: -3 }, energy: { watcher: -2 } } },
    unwatched: { text: 'The generator runs until four and the hum sits in the walls. Nobody sleeps, and the light across the street stays on.', effects: { energy: { all: -7 }, morale: { all: -8 }, log: 'warn' } },
  },
  {
    id: 'argument-over-water', weight: 0.8, minDay: 3,
    text: 'Elena and Jess are arguing in the kitchen with their voices down. It is about how much water the rest of them get.',
    watched: { text: 'It is settled before it wakes Theo. Someone gives up their own cup of water and the kitchen goes quiet.', effects: { morale: { parents: 6 }, energy: { watcher: -6 } } },
    unwatched: { text: 'The argument runs until Theo is standing in the doorway with his blanket. The two of them stop talking and nobody sleeps after that.', effects: { morale: { all: -8 }, energy: { all: -5 }, wake: 'kids', log: 'bad' } },
  },
  {
    id: 'tap-runs-dry', weight: 0.9, minDay: 2, once: true,
    text: 'The tap that has been trickling since the power went out coughs twice and goes quiet.',
    watched: { text: 'The watcher gets up to catch the last of it in a jar before the pipe settles. Two cups, not more.', effects: { morale: { all: 4 }, energy: { watcher: -4 } } },
    unwatched: { text: 'Nobody hears it. The tub kept filling all night with nobody capping it, and most of it went down the drain.', effects: { tubL: -20, morale: { all: -7 }, log: 'warn' } },
  },
];
