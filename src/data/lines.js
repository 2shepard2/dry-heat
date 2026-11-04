// Dry Heat dialogue lines. Plain data, no imports. Content: MiniMax. Lookup: Codex (game.line(key)).
//
// Short spoken lines, logged as  Name: "line".  Code asks for a key; the lookup picks one variant at
// random from those whose `needs` hold, and says nothing if none do. Voices: docs/STORY.md section 3
// (Marcus deflects with jokes and lists, Elena is direct and tired, Jess is dry and fifteen, Theo is
// seven). Walt: docs/STORY.md section 0. Write him with dignity: an expert losing something, never a joke.
// Lines are one sentence, two at most. No narration, no stage directions, never the word "shift".
//
// Schema
//   key: 'speaker.situation'  -> array of variants (4 to 6 each)
//   variant: a string, or { text, needs } where needs is { flag: { name: value } } on game flags.
//   Flags available: gas ('full'|'quarter'), jugs ('shelf'|'recycled'), cart ('water'|'pharmacy'|'birthday'),
//   walt ('walked'|'wavedOff').
//
// Keys the code calls (write all of them):
//   marcus.solar.dead        day 1, finding the solar panels do nothing ("We have solar, why is nothing on?")
//   elena.solar.lease        her answer, the $140 a month lease
//   marcus.car.ac            running the car to cool someone down
//   elena.car.fuel           worrying about the gas left (variants for gas full / quarter)
//   marcus.jugs.remember     the jugs paying off, or missing (variants for shelf / recycled)
//   elena.shade.window       putting foil or the windshield shade on a west window
//   jess.tarp                rigging the tarp shade in the yard
//   marcus.grill             cooking on the grill at night
//   walt.greet.lucid         Walt on a clear morning
//   walt.greet.confused      Walt on a bad day (wrong name, looks for his wife, asks what year it is)
//   walt.greet.stranger      first visit when he doesn't trust them yet (needs walt: 'wavedOff')
//   walt.instruct.right      a correct, specific wiring instruction (charge controller, battery, breaker)
//   walt.instruct.wrong      a confident instruction that is wrong and dangerous (the player must catch it)
//   walt.memory              his trade, his wife, a job he's proud of
//   walt.daughter            his daughter in Tucson
//   walt.water.thanks        when the family brings him water
//   walt.circuit.done        the circuit works
//   jess.walt                Jess about Walt, or to him
//   theo.nebulizer           Theo on the nebulizer, or the fan running
//   marcus.shock             Marcus after a wrong connection hurts him
//
// More keys are welcome later (lines for decisions, trust, Jess); unknown keys are simply never called.

export const LINES = {
  'marcus.solar.dead': [
    'We have solar. Why is nothing on?',
  ],
  'walt.greet.lucid': [
    'You\'re the one with the little fella. Marcus. Come in out of that sun.',
  ],
};
