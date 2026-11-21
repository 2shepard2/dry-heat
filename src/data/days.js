// Daily outage objectives, keyed by the day that begins at 6 AM.
// Schema: { id: unique string, text: imperative string, check?: predicate name,
// fail?: predicate name }. No check means an instruction that never ticks.
// Predicates are evaluated by days.js against existing game state. Walt and
// solar checks are omitted once the circuit is built. Content has no engine code.
export const DAYS = {
  2: [
    { id: 'd2-shade', text: 'Shade a west or south window', check: 'shadeBuilt' },
    { id: 'd2-water', text: 'Keep at least 80 liters of drinking water', check: 'waterAbove:80' },
    { id: 'd2-walt', text: 'Visit Walt in the morning', check: 'waltVisited' },
    { id: 'd2-watch', text: 'Keep someone awake to watch the house tonight' },
    { id: 'd2-alive', text: 'Keep everyone alive until nightfall (8 PM)', check: 'aliveAtNight', fail: 'anyDead' },
  ],
  3: [
    { id: 'd3-walt', text: 'Visit Walt in the morning', check: 'waltVisited' },
    { id: 'd3-solar', text: 'Build the small daytime circuit', check: 'solarBuilt' },
    { id: 'd3-water', text: 'Keep at least 60 liters of drinking water', check: 'waterAbove:60' },
    { id: 'd3-rest', text: 'Sleep through the afternoon heat' },
    { id: 'd3-watch', text: 'Keep someone awake to watch the house tonight' },
  ],
  4: [
    { id: 'd4-walt', text: 'Visit Walt in the morning', check: 'waltVisited' },
    { id: 'd4-solar', text: 'Build the small daytime circuit', check: 'solarBuilt' },
    { id: 'd4-water', text: 'Keep at least 40 liters of drinking water', check: 'waterAbove:40' },
    { id: 'd4-theo', text: 'Keep Theo close and watch his breathing' },
  ],
  5: [
    { id: 'd5-solar', text: 'Build the small daytime circuit', check: 'solarBuilt' },
    { id: 'd5-water', text: 'Keep at least 30 liters of drinking water', check: 'waterAbove:30' },
    { id: 'd5-theo', text: 'Keep Theo close and watch his breathing' },
  ],
  6: [
    { id: 'd6-radio', text: 'Listen to the noon radio report', check: 'heardRadio:fairgrounds-camp' },
    { id: 'd6-water', text: 'Keep at least 20 liters of drinking water', check: 'waterAbove:20' },
    { id: 'd6-watch', text: 'Keep someone awake to watch the house tonight' },
  ],
  7: [
    { id: 'd7-water', text: 'Keep at least 12 liters of drinking water', check: 'waterAbove:12' },
    { id: 'd7-rest', text: 'Rest together through the afternoon' },
    { id: 'd7-watch', text: 'Keep someone awake to watch the house tonight' },
  ],
  8: [
    { id: 'd8-water', text: 'Save drinking water for everyone' },
    { id: 'd8-alive', text: 'Keep everyone alive until nightfall (8 PM)', check: 'aliveAtNight', fail: 'anyDead' },
  ],
  9: [
    { id: 'd9-close', text: 'Keep the family close' },
    { id: 'd9-alive', text: 'Keep everyone alive until nightfall (8 PM)', check: 'aliveAtNight', fail: 'anyDead' },
  ],
  10: [
    { id: 'd10-alive', text: 'Keep everyone alive.' },
  ],
};
