// Ending cards (wave 5a schema, docs/wave-5a.md part B). Plain data.
// Each card: { id, ending, order, when?, text } or a title card { id, ending, title: true, when?, text }.
//   ending: 'held_out' | 'got_out' | 'any' | 'all_lost'
//   when keys: anyDead, noneDead, dead, alive, helper, solar, via, missed
//   placeholders: {dead} {deadList} {lastWords} {lastWordsDay} {missedDays} {helper} {youngest} {survivors} {days}
// For each order value the first matching card wins, so specific cards come before general ones.
export const ENDINGS = [
  // ---- Held out: a little hope and luck after the ordeal ----
  { id: 'ho-title-loss', ending: 'held_out', title: true, when: { anyDead: true }, text: 'They held out. Not all of them.' },
  { id: 'ho-title', ending: 'held_out', title: true, text: 'They held out.' },

  { id: 'ho-truck', ending: 'held_out', order: 10, text: 'The truck stayed until four in the afternoon. Everybody on the street got twenty litres, and the next day it came back.' },

  { id: 'ho-missed', ending: 'held_out', order: 20, when: { missed: true }, text: 'It came {missedDays} too late for {dead}.' },
  { id: 'ho-helper-walt', ending: 'held_out', order: 20, when: { helper: 'walt' }, text: 'Walt\'s daughter had driven down from Prescott on the fourth day and found her father alive. She went straight to the Guard post on Bell Road and gave them the name of the street.' },
  { id: 'ho-helper-cds', ending: 'held_out', order: 20, when: { helper: 'cul-de-sac' }, text: 'The woman with the baby carrier had walked to the fire station on the sixth day. She gave them the street, and the house with the water.' },
  { id: 'ho-helper-any', ending: 'held_out', order: 20, when: { helper: true }, text: 'Someone had given the Guard the name of the street. Nobody on it ever found out who.' },
  { id: 'ho-luck', ending: 'held_out', order: 20, text: 'The driver had been sent three streets over. He took a wrong turn.' },

  { id: 'ho-solar', ending: 'held_out', order: 30, when: { solar: true }, text: 'The fan Walt wired kept turning in the back bedroom, from ten in the morning until the sun went behind the Hendersons\' roof.' },
  { id: 'ho-house', ending: 'held_out', order: 30, text: 'The house was ninety-four degrees inside at noon. They lived in it anyway.' },

  { id: 'ho-lastwords', ending: 'held_out', order: 40, when: { anyDead: true }, text: '{dead}\'s last words to anyone were "{lastWords}" It was day {lastWordsDay}.' },

  { id: 'ho-family-whole', ending: 'held_out', order: 50, when: { noneDead: true }, text: 'All four of them sat on the kerb with the water between their feet and did not go back inside for a long time.' },
  { id: 'ho-family-loss', ending: 'held_out', order: 50, text: '{survivors} sat on the kerb with the water between their feet. Nobody said the name. Everybody was thinking it.' },

  { id: 'ho-end', ending: 'held_out', order: 90, text: 'The power did not come back that summer. The water trucks did.' },

  // ---- Got out: desperation, no choices left (wave 5b scene; cards ready now) ----
  { id: 'go-title-loss', ending: 'got_out', title: true, when: { anyDead: true }, text: 'They got out. Not all of them.' },
  { id: 'go-title', ending: 'got_out', title: true, text: 'They got out.' },

  { id: 'go-drive', ending: 'got_out', order: 10, when: { via: 'drive' }, text: 'The needle was on E for the last four miles. Nobody said anything about it, and nobody looked away from it either.' },
  { id: 'go-walk', ending: 'got_out', order: 10, when: { via: 'walk' }, text: 'They walked eleven miles in two nights and slept under an overpass in between. Marcus and Elena carried Theo in turns, and then Jess did.' },
  { id: 'go-walk-loss', ending: 'got_out', order: 10, text: 'They reached the fairgrounds on the second night.' },

  { id: 'go-camp', ending: 'got_out', order: 20, text: 'At the gate a woman with a clipboard put a paper band on each of their wrists. "You\'re 4,112," she said, and moved to the next family.' },
  { id: 'go-tent', ending: 'got_out', order: 30, text: 'The tent had forty cots and two fans on a generator. It was a hundred degrees inside. There was water.' },

  { id: 'go-lastwords', ending: 'got_out', order: 40, when: { anyDead: true }, text: '{dead}\'s last words to anyone were "{lastWords}" It was day {lastWordsDay}.' },
  { id: 'go-left-behind-loss', ending: 'got_out', order: 50, when: { anyDead: true }, text: 'They left {dead} at the house. There was no other way, and they will never stop knowing it.' },
  { id: 'go-left-behind', ending: 'got_out', order: 50, text: 'Everything they owned that would not fit in a backpack is still in the house on that street. Some of it may still be there.' },

  { id: 'go-key', ending: 'got_out', order: 90, text: 'Marcus still has the house key. He has never said why he keeps it.' },

  // ---- Total loss: the one failure ending ----
  { id: 'lost-title', ending: 'all_lost', title: true, text: 'Nobody is left in the house on this street.' },
  { id: 'lost-1', ending: 'all_lost', order: 10, text: 'On day {days} the house went quiet.' },
  { id: 'lost-2', ending: 'all_lost', order: 20, text: '{dead}\'s last words to anyone were "{lastWords}"' },
  { id: 'lost-3', ending: 'all_lost', order: 90, text: 'A water truck turned onto the street on the eleventh day. It did not stop at their house.' },
];
