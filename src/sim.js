// World clock, weather, water pressure. Time is in game minutes since midnight of day 1.
export const POWER_OUT_MIN = 5 * 60 + 40; // 5:40 AM day 1: the grid goes down

export class Sim {
  constructor() {
    this.min = 6 * 60;      // start 6:00 AM
    this.speed = 1;          // game minutes per real second
    this.shadedWindows = 0;
    this.indoor = 79;        // the AC was running until 5:40
    this.tubL = 0;
    this.TUB_MAX = 160;
  }
  get day() { return Math.floor(this.min / 1440) + 1; }
  get hour() { return (this.min / 60) % 24; }

  clock() {
    const h = Math.floor(this.hour), m = Math.floor(this.min % 60);
    const ap = h < 12 ? 'AM' : 'PM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
  }

  // Outdoor air: low ~89°F before dawn, high ~116°F at 4:30 PM, creeping up a little each day.
  outdoor() {
    const h = this.min / 60;
    const d = Math.floor(h / 24);
    return 102.5 + d * 0.6 + 13.5 * Math.cos((2 * Math.PI * (h - 16.5)) / 24);
  }

  // 0 at night, 1 at solar noon.
  sun() {
    const h = this.hour;
    if (h < 5.5 || h > 19.75) return 0;
    return Math.max(0, Math.sin((Math.PI * (h - 5.5)) / 14.25));
  }
  sunAngle() { return (Math.PI * (this.hour - 5.5)) / 14.25; }

  // City water: holds for a while on stored tower pressure, then falls to nothing by 8:30 AM.
  pressure() {
    const m = this.min;
    if (m < 7 * 60) return 1;
    if (m > 8.5 * 60) return 0;
    return 1 - (m - 7 * 60) / 90;
  }

  step(dtMin) {
    this.min += dtMin;
    // An unpowered stucco house drifts toward outdoor-4°F with a ~10 hour lag: it gets worse every day.
    const target = this.outdoor() - 4 - Math.min(3, this.shadedWindows) * 4 * this.sun();
    this.indoor += (target - this.indoor) * Math.min(1, dtMin / 600);
  }
}
