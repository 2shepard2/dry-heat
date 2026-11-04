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
  {
    id: 'eas-heat-advisory', day: 1, from: 360, until: 3, source: 'eas', log: 'warn',
    text: 'This is an emergency alert for Maricopa County. The high today is 115 degrees with no wind after six. Stay inside, keep the shades down, and do not travel unless you have to.',
  },
  {
    id: 'aurora-named', day: 1, from: 390, until: 3, source: 'station', log: 'warn',
    text: 'The lights over Phoenix last night were the aurora, and they are not supposed to happen here. The National Weather Service says a severe geomagnetic storm hit overnight, the kind that also moves satellites out of their orbits.',
  },
  {
    id: 'transformers-damaged', day: 1, from: 540, until: 3, source: 'station', log: 'bad',
    text: 'The damage is to the large high-voltage transformers at the substations. They are custom-built, there are not any spares in the country, and the lead time on one is months.',
  },
  {
    id: 'roads-deaths', day: 1, from: 660, until: 2, source: 'station', log: 'bad',
    text: 'Maricopa County says four people are dead in stopped cars on the 10, the 101 and US-60, and the cars are still sitting there. Officers are telling drivers to stay in the vehicle with the engine off.',
  },
  {
    id: 'weeks-to-months', day: 2, from: 400, until: 5, source: 'station', log: 'bad',
    text: 'Utility officials say it will be weeks to months before power is restored in some areas, and that some of it will not be fixed until the hardware can be built. Nobody will put a date on it.',
  },
  {
    id: 'outage-national', day: 2, from: 480, until: 4, source: 'station', log: 'bad',
    text: 'The outage is not local. The same storm has taken down power from Ontario to Texas, and the towers are down in every state we have heard from. Nobody is driving in to help.',
  },
  {
    id: 'ham-fuel-low', day: 3, from: 360, until: 5, source: 'ham', needs: { flag: { gas: 'quarter' } },
    text: 'A note for anybody running a car for air conditioning out here: an idling engine with the air on burns most of a gallon an hour. Drive into the shade, shut it off, and do not idle in the sun. If you are taking gas out of somebody else\'s vehicle, remember that somebody may still want to start it.',
  },
  {
    id: 'eas-water-advisory', day: 3, from: 420, until: 6, source: 'eas', log: 'warn',
    text: 'This is an emergency alert for the City of Phoenix. There is a boil water advisory: bring water to a full boil for one minute before you drink it. The cooling centres at the Civic Center and the branch libraries are full and cannot take anybody else today.',
  },
  {
    id: 'dj-fuel-currency', day: 3, from: 720, until: 5, source: 'dj', needs: { flag: { gas: 'full' } },
    text: 'We hear that a gallon of water is going for a gallon of gas, and that people are paying in jerry cans. If you are sitting on a full tank, you are not just lucky, you are the bank. Please do not sell to anybody with kids in the car and no water.',
  },
  {
    id: 'hospitals-overwhelmed', day: 4, from: 480, until: 7, source: 'station', log: 'bad',
    text: 'Banner Health says every emergency department in the system is full, and ambulances are being turned away at the doors. The hospitals are running on generators, and the generators are running out of fuel.',
  },
  {
    id: 'station-pharmacy', day: 4, from: 780, until: 7, source: 'station', log: 'bad', needs: { flag: { cart: 'pharmacy' } },
    text: 'A pharmacist on 44th Street says there is no blood pressure medication left in the county and no way to order more. There are no inhalers either, and she has stopped counting the people who come in for one.',
  },
  {
    id: 'palo-verde', day: 5, from: 540, until: 8, source: 'station',
    text: 'Palo Verde Generating Station shut down safely yesterday afternoon. The company says both reactors are stable and there is no radiation release. The steam coming off the cooling towers is not a leak.',
  },
  {
    id: 'downtown-unrest', day: 6, from: 360, until: 8, source: 'station', log: 'bad',
    text: 'There is looting downtown. Stores along Washington and Central have been broken into, and there are fires near Roosevelt Row. Police are asking everybody to stay out of that area entirely.',
  },
  {
    id: 'guard-checkpoints', day: 6, from: 600, until: 8, source: 'dj', log: 'bad',
    text: 'The Guard has set up checkpoints at 27th Avenue and at the airport entrance. They want a name and an address, and if you cannot give them one they turn you around and send you back the way you came.',
  },
  {
    id: 'fairgrounds-camp', day: 6, from: 720, until: 9, source: 'station', log: 'warn',
    text: 'The state is running a relief camp at the Arizona State Fairgrounds. There is water, medical care and shade there. The Guard is turning people back at the checkpoints who did not come up through 27th Avenue, and the freeways are still stopped.',
  },
  {
    id: 'relief-as-roads-allow', day: 7, from: 420, until: 10, source: 'station', log: 'warn',
    text: 'Relief crews are working outward from the fairgrounds, reaching neighborhoods as roads allow. The east valley is still cut off, and the crew on the 101 has turned around twice.',
  },
  {
    id: 'dj-last-broadcasts', day: 8, from: 480, until: 11, source: 'dj',
    text: 'We have the generator for about two more hours of broadcast and then we are off the air. We are not playing music today. If you need to reach somebody, this is the time to do it.',
  },
  {
    id: 'ham-class-roll', day: 9, from: 600, until: 11, source: 'ham',
    text: 'A teacher at Roosevelt Elementary is reading the names of her class into a radio somebody in the neighborhood carried up to her. She is doing it so the families can hear that the children are all right. She says she will keep reading until somebody calls in.',
  },
  {
    id: 'static-quiet', day: 10, from: 300, until: 11, source: 'static',
    text: 'A weather recording starts on a loop: "High of 119, winds from the west at five miles an hour." It runs four times and then the loop breaks.',
  },
  {
    id: 'ham-signoff', day: 11, from: 420, until: 11, source: 'ham',
    text: 'This is the repeater on the south mountain, and this is the last time I will be on. The battery is finished and I am taking the radio down to the street. If you are where I am, stay in the shade, keep the little ones in the coolest room you have, and drink a little every hour.',
  },
];
