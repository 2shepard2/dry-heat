// Household projects and finite resources. Rendering is injected by main; this
// module also runs under Node with lightweight family/scene fixtures.
import { ITEMS, makeEntry, addEntry, takeOne, isSpoiled, isLiquid, PER_L } from './inventory.js';
import { RADIO } from './data/radio.js';
import { LINES } from './data/lines.js';
import { needsMatch } from './conditions.js';

export const DEFAULT_DECISIONS = { gas: 'quarter', jugs: 'shelf', cart: 'water', walt: 'walked' };
export const CAR_L_PER_HOUR = 2.5;
export function circuitWatts(sim, built) {
  return built ? 220 * sim.sun() * Math.max(0.45, 1 - Math.max(0, sim.outdoor() - 105) * 0.025) : 0;
}
const clamp = (v) => Math.max(0, Math.min(100, v));
const cookable = (e) => ['chicken_raw', 'ground_beef', 'eggs_dozen', 'frozen_pizza', 'frozen_veg', 'hot_dogs', 'frozen_meat_pack'].includes(e.id);

export class SurvivalSystems {
  constructor(game) {
    this.g = game;
    game.decisions = { ...DEFAULT_DECISIONS, ...game.decisions };
    game.flags = game.flags || {};
    game.trust ??= 45;
    this.car = game.map.objects.find((o) => o.car && o.home);
    this.car.fuelL = game.decisions.gas === 'full' ? 55 : 14;
    this.car.garageOpen = false;
    this.car.running = false;
    this.shades = new Set();
    this.tarp = false;
    this.grill = { propaneMin: 0, charcoalMin: 0 };
    this.solar = { built: false, fan: false };
    this.walt = { trust: game.decisions.walt === 'walked' ? 2 : 0, visits: 0, daily: new Map(), instruction: null };
    this.heard = new Set();
    this.visual = () => {};
    game.line = (key, who) => this.line(key, who);
    // Public hooks take Member objects (or ids); each uses the normal task and
    // inventory requirements. Forced lucidity is only exposed on the visit hook.
    const member = (m) => typeof m === 'string' ? game.family.find((x) => x.id === m) : m;
    game.shadeWindow = (m, key) => this.buildShade(member(m), this.site(key));
    game.rigTarp = (m, crew) => this.buildTarp(member(m), (crew || game.selected).map(member));
    game.cookGrill = (m, fuel = 'propane') => this.cook(member(m), fuel);
    game.runCarAC = (m) => this.enterCar(member(m));
    game.stopCarAC = () => this.stopCar();
    game.chargeSolar = (m) => this.action(member(m), 'recharge', this.site('fan'), {}, 30);
    game.visitWalt = (m, lucid) => this.action(member(m), 'visitWalt', this.site('walt'), { lucid }, 4);
    game.giveWaltWater = (m) => this.action(member(m), 'waterWalt', this.site('walt'), {}, 2);
    game.buildCircuit = (m) => this.buildSolar(member(m));
    game.placeFan = (m) => this.action(member(m), 'placeFan', this.site('fan'), {}, 3);
    game.useNebulizer = (m) => this.nebulizer(member(m));
    game.playRadio = (m) => this.radio(member(m));
  }
  site(key) { return this.g.map.sites.find((s) => s.key === key); }
  near(m, o, r = 3) {
    return !!m && !!o && Math.hypot(m.pos.x - (o.x + o.w / 2), m.pos.z - (o.y + o.h / 2)) <= r;
  }
  fail(text) { this.g.log(text, 'warn'); return false; }
  line(key, who) {
    const variants = (LINES[key] || []).filter((v) => typeof v === 'string' || needsMatch(this.g, v.needs));
    if (!variants.length) return false;
    const v = variants[Math.floor(this.g.rng.next() * variants.length)];
    const id = typeof who === 'string' ? who : who?.id || key.split('.')[0];
    const name = this.g.family.find((m) => m.id === id)?.name || (id === 'walt' ? 'Walt' : id);
    this.g.log(`${name}: "${typeof v === 'string' ? v : v.text}"`);
    return true;
  }
  deadSolar() {
    const g = this.g;
    if (g.sim.day !== 1 || g.flags.solarSeen) return;
    g.flags.solarSeen = true;
    this.line('marcus.solar.dead');
    this.line('elena.solar.lease');
  }
  // Search bonuses are deterministic quest stock, revealed once, not rerolled.
  stock(o, found) {
    const g = this.g;
    if (o.home && ['S', 'f'].includes(o.ch)) {
      for (let i = found.length - 1; i >= 0; i--) if (['water_gallon', 'water_gallon_half'].includes(found[i].id)) found.splice(i, 1);
    }
    if (o.questStock) return;
    o.questStock = true;
    const add = (id, n = 1) => { for (let k = 0; k < n; k++) addEntry(found, makeEntry(id)); };
    if (o.home && o.ch === 'S' && o.x === 35) {
      if (g.decisions.jugs === 'shelf') { add('water_gallon', 10); add('water_gallon_half', 4); }
      add('tarp'); add('rope'); add('box_fan'); add('radio_handcrank'); found.push({ id: 'aa_rechargeable', n: 1, chargeMin: 0 });
    }
    if (o.home && o.ch === 'k' && o.x === 28) add('aluminum_foil', 3);
    if (o.home && o.ch === 'F') add('frozen_meat_pack', 3);
    if (o.home && o.ch === 'H') { add('propane_tank'); add('charcoal_bag'); }
    if (o.home && o.ch === 'T') add('nebulizer');
    if (o.ch === 'S' && g.map.lots[o.lot]?.id === 'ne' && o.x === 55) add('deep_cycle_battery');
    if (o.home && o.ch === 'S' && o.x === 35) this.line('marcus.jugs.remember');
  }
  supplies(m, o) {
    const g = this.g;
    // Materials must be on site, either carried by somebody nearby or in a
    // discovered container within reach. No spending supplies across the street.
    return [...g.family.filter((p) => p.canAct() && this.near(p, o, 4.5)).map((p) => p.inv),
      ...g.map.objects.filter((c) => c.searched && Math.hypot(c.x - o.x, c.y - o.y) <= 3).map((c) => c.items)];
  }
  find(invs, ids) {
    for (const inv of invs) { const e = inv.find((x) => ids.includes(x.id) && x.n > 0); if (e) return { inv, e }; }
    return null;
  }
  consume(ref) { return ref && takeOne(ref.inv, ref.e); }
  action(m, action, site, data = {}, duration = 3) {
    if (!m?.canAct() || !site) return false;
    return m.useObject(site, 'system', { action, data, duration });
  }
  busy(site) {
    return this.g.family.some((m) => (m.task?.job || m.goal?.job)?.site === site.key);
  }
  job(m, site, label, duration, action, crew = [m]) {
    if (!m?.canAct() || !site || this.busy(site)) return false;
    const job = { site: site.key, crew, steps: [{ label, dur: duration,
      cells: () => this.g.map.useCells(site), what: site.name,
      done: (lead) => this.complete(action, lead, { site }) }] };
    return this.g.startJob(m, job) !== false;
  }
  buildShade(m, site) {
    if (site?.kind !== 'window' || this.shades.has(site.key)) return false;
    if (!this.find([m?.inv || [], ...this.supplies(m, site)], ['aluminum_foil', 'windshield_shade'])) return this.fail('Carry foil or a windshield shade, then click a window.');
    return this.job(m, site, 'Fitting reflective window shade', 8, 'shade');
  }
  buildTarp(m, crew) {
    if (this.tarp || !m?.canAct()) return false;
    crew = [...new Set([m, ...crew])].filter((p) => p?.canAct() && !p.child).slice(0, 2);
    if (crew.length !== 2) return this.fail('Rigging yard shade takes two people. Select both parents, or ask Jess to help.');
    if (!this.find([...crew.map((p) => p.inv), ...this.supplies(m, this.site('tarp'))], ['tarp'])) return this.fail('Bring a tarp to the yard shade posts.');
    return this.job(m, this.site('tarp'), 'Rigging yard shade together', 20, 'tarp', crew);
  }
  buildSolar(m) {
    this.deadSolar();
    if (this.solar.built) return false;
    if (!this.walt.instruction) return this.fail('Visit Walt for wiring instructions, then bring a deep-cycle battery and charge controller to the garage panel. Pruitt has an RV battery.');
    const invs = [m?.inv || [], ...this.supplies(m, this.site('panel'))];
    if (!this.find(invs, ['deep_cycle_battery']) || !this.find(invs, ['charge_controller'])) return this.fail('Bring a deep-cycle battery and charge controller to the garage panel. Pruitt has an RV battery.');
    return this.job(m, this.site('panel'), 'Wiring the small solar circuit', 45, 'solar');
  }
  cook(m, fuel) {
    if (!['propane', 'charcoal'].includes(fuel)) return false;
    const invs = [m?.inv || [], ...this.supplies(m, this.site('grill'))];
    if (!invs.flat().some((e) => cookable(e) && !isSpoiled(e, this.g.sim))) return this.fail('Bring unspoiled raw or frozen food to the yard grill.');
    if (this.grill[`${fuel}Min`] < 20 && !this.find(invs, [fuel === 'charcoal' ? 'charcoal_bag' : 'propane_tank'])) return this.fail('Bring fuel to the yard grill.');
    return this.action(m, 'cook', this.site('grill'), { fuel }, 20);
  }
  occupants() { return this.g.family.filter((m) => !m.dead && m.task?.type === 'carAC' && this.near(m, this.car, 4)); }
  enterCar(m) { this.deadSolar(); return this.action(m, 'enterCar', this.car, {}, 1); }
  stopCar() {
    for (const m of this.occupants()) m.stopTask(true);
    this.car.running = false;
    this.g.log('The engine stops. The cabin begins warming again.');
    return true;
  }
  carCooling(m) { return this.car.running && this.car.fuelL > 0 && this.occupants().includes(m); }
  yardShade(x, y) { const s = this.site('tarp'); return this.tarp && x >= s.x - 1 && x <= s.x + 2 && y >= s.y - 1 && y <= s.y + 1; }
  fanCooling(m) {
    const [x, y] = m.cell();
    return this.g.map.isIndoor(x, y) && !this.g.map.isGarage(x, y) && this.solar.fan && this.watts() >= 60 && x >= 27 && x <= 33 && y >= 10 && y <= 14 ? 4 : 0;
  }
  watts() { return circuitWatts(this.g.sim, this.solar.built); }
  poweredTask(m, action) {
    const demand = action === 'nebulizer' ? 80 : action === 'recharge' ? 15 : 0;
    if (!demand) return true;
    const others = this.g.family.filter((p) => p !== m && p.task?.type === 'system' && ['nebulizer', 'recharge'].includes(p.task.action));
    const reserved = others.filter((p) => this.g.family.indexOf(p) < this.g.family.indexOf(m)).reduce((sum, p) => sum + (p.task.action === 'nebulizer' ? 80 : 15), 0);
    return this.availableWatts() - reserved >= demand;
  }
  availableWatts() { return this.watts() - (this.solar.fan && this.watts() >= 60 ? 60 : 0); }
  nebulizer(m) { this.deadSolar(); return this.action(m, 'nebulizer', this.site('fan'), {}, 10); }
  radio(m) {
    this.deadSolar();
    if (!m?.inv.some((e) => e.id === 'radio_handcrank')) return this.fail('Carry the hand-crank radio to listen. There is one on the garage shelf.');
    m.stopTask(true);
    const radio = m.inv.find((e) => e.id === 'radio_handcrank');
    const charged = (radio.chargeMin || 0) >= 2;
    if (charged) radio.chargeMin -= 2;
    m.task = { type: 'system', action: 'radio', data: {}, t: 0, dur: charged ? 0.5 : 2 };
    return true;
  }
  broadcast() {
    const g = this.g, now = g.sim;
    const due = RADIO.filter((r) => !this.heard.has(r.id) && now.day >= r.day
      && (now.day > r.day || now.min % 1440 >= (r.from || 0))
      && (r.until === undefined || now.day <= r.until) && needsMatch(g, r.needs))
      .sort((a, b) => a.day - b.day || (a.from || 0) - (b.from || 0));
    if (!due.length) { g.log('The crank turns. Static. Nothing new comes through.'); return false; }
    const r = due[0]; this.heard.add(r.id);
    g.log(`Radio (${r.source}): ${r.text}`, r.log);
    return r.id;
  }
  complete(action, m, data = {}) {
    const g = this.g, site = data.site || this.site({ shade: '', tarp: 'tarp', solar: 'panel', placeFan: 'fan', cook: 'grill', visitWalt: 'walt', waterWalt: 'walt', nebulizer: 'fan', recharge: 'fan' }[action]);
    if (!m.canAct()) return false;
    if (site && !this.near(m, site, 3)) return this.fail('Come closer to finish the task.');
    const invs = site ? this.supplies(m, site) : [m.inv];
    switch (action) {
      case 'shade': {
        if (this.shades.has(site.key)) return false;
        const material = this.find(invs, ['aluminum_foil', 'windshield_shade']);
        if (!material) return this.fail('Bring foil or a windshield shade to this window.');
        this.consume(material); this.shades.add(site.key);
        g.sim.shadedWindows = this.shades.size; g.flags.shadedWindows = this.shades.size;
        this.visual('shade', site); this.line('elena.shade.window');
        g.log('Silver covers the glass. Less afternoon heat will get through.', 'good');
        g.objective('shade');
        return true;
      }
      case 'tarp': {
        if (this.tarp) return false;
        const tarp = this.find(invs, ['tarp']);
        if (!tarp) return this.fail('Bring a tarp to the yard shade posts.');
        this.consume(tarp); this.tarp = true; g.flags.tarpShade = true;
        this.visual('tarp', site); this.line('jess.tarp');
        g.log('The tarp shades a four-by-three-meter patch of yard. The sun is weaker underneath.', 'good');
        return true;
      }
      case 'cook': {
        if (g.map.isIndoor(site.x, site.y)) return this.fail('The grill must be outdoors. Smoke and carbon monoxide can kill.');
        const raw = invs.flatMap((inv) => inv.filter((e) => cookable(e) && !isSpoiled(e, g.sim)).map((e) => ({ inv, e })))[0];
        if (!raw) return this.fail('Bring unspoiled raw or frozen food to the yard grill. Cooking cannot rescue spoiled food.');
        const fuel = data.fuel || 'propane', key = `${fuel}Min`;
        if (this.grill[key] < 20) {
          const ref = this.find(invs, [fuel === 'charcoal' ? 'charcoal_bag' : 'propane_tank']);
          if (!ref) return this.fail(`Bring ${fuel === 'charcoal' ? 'charcoal' : 'a propane tank'} to the grill.`);
          this.consume(ref); this.grill[key] += fuel === 'charcoal' ? 120 : 600;
        }
        // Keep the food where it was carried/stored: no surprise capacity gain.
        this.consume(raw); this.grill[key] -= 20;
        addEntry(raw.inv, { id: 'cooked_meal', n: 1, cookedAt: g.sim.min });
        this.visual('grill', site); this.line('marcus.grill');
        g.log(`A hot meal is ready. Eat within four hours. Grill: ${this.grill[key]} minutes of ${fuel} left.`, 'good');
        return true;
      }
      case 'openGarage':
        if (!this.near(m, this.car, 4)) return false;
        this.car.garageOpen = true; g.log('The garage door is open before the engine starts.'); return true;
      case 'enterCar': {
        const car = this.car;
        if (!this.near(m, car, 4)) return false;
        if (g.map.isGarage(car.x, car.y) && !car.garageOpen) return this.fail('Do not idle in a closed garage. Carbon monoxide can kill. Open the garage door first.');
        if (this.occupants().length >= 2) return this.fail('Only two people can cool down in the car at once.');
        if (car.fuelL <= 0) return this.fail('The tank is empty. The pumps have no power.');
        m.task = { type: 'carAC', t: 0, dur: Infinity };
        if (m.ai) m.mode = { type: 'stay' };
        car.running = true; this.line('marcus.car.ac'); this.line('elena.car.fuel');
        g.log(`${m.name} sits in the running car. AC cools the cabin to 78°F; fuel burns at 2.5 L/hour.`);
        return true;
      }
      case 'visitWalt': return this.visit(m, data.lucid);
      case 'waterWalt': {
        const ref = m.inv.find((e) => isLiquid(e) && PER_L[e.id]?.hydration >= 35 && e.left >= 1);
        const bottle = m.inv.find((e) => e.id === 'water_bottle' && e.n >= 2);
        if (!ref && !bottle) return this.fail('Bring Walt one liter of clean water.');
        if (ref) ref.left -= 1;
        else { this.consume({ inv: m.inv, e: bottle }); this.consume({ inv: m.inv, e: bottle }); }
        // One trust gain per day; repeat deliveries still consume real water.
        if (this.walt.waterDay !== g.sim.day) { this.walt.trust++; this.walt.waterDay = g.sim.day; }
        this.line('walt.water.thanks'); g.log('Walt sets the water beside his chair.'); return true;
      }
      case 'solar': {
        if (this.solar.built || !this.walt.instruction) return false;
        const battery = this.find(invs, ['deep_cycle_battery']), controller = this.find(invs, ['charge_controller']);
        if (!battery || !controller) return this.fail('Bring a deep-cycle battery and charge controller to the garage panel.');
        if (!this.walt.instruction.right) {
          if (g.rng.next() < 0.5) { m.needs.health = clamp(m.needs.health - 22); this.line('marcus.shock', m); g.log('The wrong connection arcs. A shock throws the builder back. The circuit is still off.', 'bad'); }
          else { this.consume(controller); for (const p of g.family) p.needs.morale = clamp(p.needs.morale - 8); g.log('Smoke curls from the controller. They smother the small fire, but the controller is ruined.', 'bad'); this.walt.controllerGiven = false; }
          this.walt.instruction = null; return false;
        }
        this.consume(battery); this.consume(controller); this.solar.built = true; g.flags.solarCircuit = true;
        this.visual('solar', site); this.line('walt.circuit.done');
        g.log('A small circuit is isolated from the dead grid. Daylight only: fan, chargers, nebulizer. Never the AC.', 'good');
        g.objective('solar'); return true;
      }
      case 'placeFan': {
        this.deadSolar();
        if (!this.solar.built) return this.fail('Build the daylight circuit at the garage panel first.');
        if (this.solar.fan) return false;
        const fan = this.find(invs, ['box_fan']);
        if (!fan) return this.fail('Bring the box fan to the living room.');
        this.consume(fan); this.solar.fan = true; this.visual('fan', site);
        g.log('The fan is wired to the daylight circuit. It makes this room feel 4°F cooler when there is enough sunlight.'); return true;
      }
      case 'nebulizer': {
        const theo = g.family.find((p) => p.id === 'theo');
        if (!theo || theo.dead || !this.near(theo, site, 3)) return this.fail('Bring Theo to the living room circuit for treatment.');
        if (this.availableWatts() < 80) return this.fail('The nebulizer needs 80 watts of daylight power. Try later in the morning.');
        if (!this.find(invs, ['nebulizer'])) return this.fail('Bring the nebulizer from the bathroom cabinet.');
        if (this.solar.treatedDay === g.sim.day) return this.fail('Theo has already had this treatment today.');
        theo.needs.health = clamp(theo.needs.health + 8); theo.needs.morale = clamp(theo.needs.morale + 6);
        this.solar.treatedDay = g.sim.day; this.line('theo.nebulizer');
        g.log('Theo finishes his nebulizer treatment. His breathing settles.', 'good'); return true;
      }
      case 'recharge': {
        if (this.availableWatts() < 15) return this.fail('Not enough daylight power to charge.');
        const ref = this.find(invs, ['aa_rechargeable', 'radio_handcrank']);
        if (!ref) return this.fail('Bring a rechargeable AA pack or the radio. Alkaline batteries cannot be recharged.');
        if (ref.e.id === 'aa_rechargeable') { const pack = this.consume(ref); pack.chargeMin = 480; addEntry(ref.inv, pack); }
        else ref.e.chargeMin = 480;
        g.log('The daylight charger finishes.'); return true;
      }
      case 'radio':
        if (!m.inv.some((e) => e.id === 'radio_handcrank')) return false;
        return this.broadcast();
      default: return false;
    }
  }
  visit(m, forced) {
    const g = this.g, w = this.walt;
    if (w.lastVisit !== undefined && g.sim.min - w.lastVisit < 60) return this.fail('Give Walt some time. Come back in an hour, or on another morning.');
    if (!w.daily.has(g.sim.day)) w.daily.set(g.sim.day, g.rng.next());
    const roll = w.daily.get(g.sim.day);
    const chance = g.sim.hour < 11 ? 0.88 : g.sim.hour < 16 ? 0.45 : 0.08;
    const penalty = g.decisions.walt === 'wavedOff' && w.visits < 2 ? 0.25 : 0;
    const lucid = typeof forced === 'boolean' ? forced : roll < chance - penalty;
    w.visits++; w.lastVisit = g.sim.min; w.lucid = lucid;
    if (w.trust < 2) {
      this.line('walt.greet.stranger'); this.line(lucid ? 'walt.greet.lucid' : 'walt.greet.confused');
      if (lucid && w.trustVisitDay !== g.sim.day) { w.trust++; w.trustVisitDay = g.sim.day; }
      g.log('Walt keeps a hand on the door. Bring water and come back on another morning.'); return true;
    }
    this.line(lucid ? 'walt.greet.lucid' : 'walt.greet.confused');
    this.line(lucid ? 'walt.instruct.right' : 'walt.instruct.wrong');
    this.line(g.rng.next() < 0.5 ? 'walt.memory' : 'walt.daughter');
    if (g.family.some((p) => p.id === 'jess' && this.near(p, this.site('walt'), 6))) this.line('jess.walt');
    w.instruction = { right: lucid, day: g.sim.day };
    if (!w.controllerGiven) {
      if (m.kg() + ITEMS.charge_controller.kg > m.cap) return this.fail('Make room to carry Walt’s charge controller, then visit again.');
      addEntry(m.inv, makeEntry('charge_controller')); w.controllerGiven = true;
      g.log('Walt hands over a spare charge controller. Pruitt has the deep-cycle battery.');
    }
    return true;
  }
  update(dtMin) {
    const occupants = this.occupants();
    this.car.running = occupants.length > 0 && this.car.fuelL > 0;
    if (this.car.running) {
      this.car.fuelL = Math.max(0, this.car.fuelL - CAR_L_PER_HOUR * dtMin / 60);
      if (this.car.fuelL === 0) { this.stopCar(); this.g.log('The engine sputters out. No fuel left.', 'bad'); }
    }
  }
  // Menu entries are supplied to main's existing context menu renderer.
  menu(site, lead, group) {
    const g = this.g, action = (label, fn, hint = '', disabled = false) => ({ label, fn, hint, disabled });
    switch (site.kind) {
      case 'window': return [action(this.shades.has(site.key) ? 'Window shaded' : 'Fit reflective shade', () => this.buildShade(lead, site), '8 min · bring foil or windshield shade · heat benefit capped at 3 windows', this.shades.has(site.key))];
      case 'tarp': return [action(this.tarp ? 'Yard shade is rigged' : 'Rig tarp shade together', () => this.buildTarp(lead, group), '20 min · two people · bring tarp', this.tarp),
        ...(this.tarp ? [action('Gather under the shade', () => {
          const cells = [];
          for (let y = site.y - 1; y <= site.y + 1; y++) for (let x = site.x - 1; x <= site.x + 2; x++) if (g.map.walkable(x, y)) cells.push([x, y]);
          group.forEach((m, i) => m.moveTo(...cells[i % cells.length]));
        }, 'cuts direct sun load by 75%')] : [])];
      case 'grill': return ['propane', 'charcoal'].map((fuel) => action(`Cook with ${fuel}`, () => this.cook(lead, fuel), `20 min · unspoiled food · ${this.grill[`${fuel}Min`]} fuel min loaded`));
      case 'panel': this.deadSolar(); return [action(this.solar.built ? `Circuit: ${Math.round(this.watts())} W now` : 'Build small daytime circuit', () => this.buildSolar(lead), '45 min · Walt’s instructions + battery + controller · no AC', this.solar.built)];
      case 'fan': this.deadSolar(); return [action(this.solar.fan ? 'Fan placed' : 'Place box fan', () => g.placeFan(lead), '3 min · needs completed circuit', this.solar.fan), action('Nebulizer treatment for Theo', () => this.nebulizer(lead), '10 min · bring Theo and nebulizer · 80 W'), action('Charge AA pack / radio', () => this.action(lead, 'recharge', site, {}, 30), '30 min · rechargeable packs only · 15 W')];
      case 'walt': return [action('Visit Walt', () => g.visitWalt(lead), '4 min · best in the morning'), action('Bring Walt a liter of water', () => g.giveWaltWater(lead), '2 min · carried clean water builds trust')];
      default: return [];
    }
  }
  carMenu(lead) {
    return [...this.g.family.filter((m) => m.canAct() && !this.occupants().includes(m)).map((m) => ({ label: `Run AC for ${m.name}`, hint: 'walk to car · 2 seats · 2.5 L/hour', fn: () => this.enterCar(m), disabled: this.occupants().length >= 2 || this.car.fuelL <= 0 })),
      { label: 'Stop engine / everyone out', fn: () => this.stopCar(), disabled: !this.car.running },
      ...(this.g.map.isGarage(this.car.x, this.car.y) ? [{ label: 'Open garage door before idling', fn: () => this.action(lead, 'openGarage', this.car, {}, 3) }] : [])];
  }
}
