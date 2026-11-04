// World clock, weather, water pressure. Time is in game minutes since midnight of day 1.
export const POWER_OUT_MIN = 5 * 60 + 40; // 5:40 AM day 1: the grid goes down

export class Sim {
  constructor({ phase = 'outage' } = {}) {
    this.phase = phase;
    this.min = phase === 'prologue' ? -2880 + 435 : 6 * 60;      // Thursday 7:15 AM, or the legacy outage fixture
    this.speed = phase === 'prologue' ? 4 : 1;          // game minutes per real second
    this.shadedWindows = 0;
    this.indoor = phase === 'prologue' ? 78 : 79;        // the AC was running until 5:40
    this.tubL = 0;
    this.TUB_MAX = 160;
  }
  get day() { return Math.floor(this.min / 1440) + 1; }
  get hour() { return ((this.min / 60) % 24 + 24) % 24; }
  get power() { return this.phase === 'prologue'; }
  dateLabel() {
    if (this.phase === 'prologue') return this.day === -1 ? 'Thursday, July 9' : 'Friday, July 10';
    return `Day ${this.day} · ${['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][(this.day - 1) % 7]}, July ${10 + this.day}`;
  }

  clock() {
    const h = Math.floor(this.hour), m = Math.floor(((this.min % 60) + 60) % 60);
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
    if (this.power) return 1;
    const m = this.min;
    if (m < 7 * 60) return 1;
    if (m > 8.5 * 60) return 0;
    return 1 - (m - 7 * 60) / 90;
  }

  step(dtMin) {
    this.min += dtMin;
    if (this.power) {
      // Only a scripted sleep/day beat crosses midnight during ordinary days.
      this.min = Math.min(this.min, (this.prologueDay ?? -1) * 1440 - 1);
      this.indoor = 78;
      return;
    }
    // An unpowered stucco house drifts toward outdoor-4°F with a ~10 hour lag: it gets worse every day.
    const target = this.outdoor() - 4 - Math.min(3, this.shadedWindows) * 4 * this.sun();
    this.indoor += (target - this.indoor) * Math.min(1, dtMin / 600);
  }
}
