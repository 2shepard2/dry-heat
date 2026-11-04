// Dry Heat radio broadcasts. Plain data, no imports. Content: MiniMax. Player: Codex (hand-crank radio).
//
// The only news the family gets after the cell towers die (docs/STORY.md section 0). Cranking the radio
// plays the oldest broadcast not yet heard whose day and time have come. Fragments, not exposition: a
// station out of Tucson, an emergency loop, a DJ who stayed on, a ham operator, then static. Nobody
// knows the whole picture. Never mention "shift" or the theme.
//
// Schema
//   id      unique kebab-case
//   day     earliest day it can play (1 = Saturday, the first day of the outage)
//   from    earliest clock minute on that day (0-1439), default 0
//   until   optional last day it can still play (a stale broadcast is skipped, not queued forever)
//   needs   optional { flag: { name: value } } using game flags, e.g. { flag: { gas: 'full' } }
//   source  who is speaking: 'eas' (emergency alert loop), 'station' (news), 'dj', 'ham', 'static'
//   text    what the family hears, one to three sentences, plain. Static breaks may be shown as "...".
//   log     optional tone of the log line: 'warn' | 'bad'
//
// Story beats that must be covered (STORY.md section 0 and section 2):
//   day 1 morning: all roads out jammed (I-17, I-10, US-60), people dying in cars, DPS says stay off roads
//   day 1-2: the aurora / solar storm named; transformers; "weeks to months"; outages across the country
//   day 3-5: water advisories, cooling centres full, hospitals overwhelmed, Palo Verde safely shut down
//   day 6: unrest downtown: looting, fires, Guard checkpoints; the relief camp at the state fairgrounds
//   day 7-10: relief is coming "to neighbourhoods as roads allow"; more static; one human moment
//   never: the grid coming back, an all-clear, or a working escape route

export const RADIO = [
  {
    id: 'roads-jammed', day: 1, from: 6 * 60, until: 2, source: 'station', log: 'warn',
    text: 'Department of Public Safety is asking people to stay off the freeways. The I-17 is at a standstill north of Anthem, and the 10 is stopped both ways. If you are not already on the road, do not get on the road.',
  },
  {
    id: 'static-day-9', day: 9, source: 'static',
    text: 'Static on every station, then a man reading license plates and names, slowly, like a list. Then static again.',
  },
];
