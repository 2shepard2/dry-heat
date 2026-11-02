# Independent grey-box review, Codex 1

Reviewed base `482c2a9fb45e21c5ae24bb275d35638e62ddb1fe`, 2026-11-01. Scope: code and survival math only; no gameplay changes. P1 means resolve before extending the simulation; P2 means reproducible correctness or realism debt. This is a game-model review, not a clinical prediction.

## Ranked findings

1. **P1 — Sleeping in a bed applies outdoor sunlight and temperature.** `src/family.js:144`, `src/family.js:257`, `src/map.js:143`. `lieDown` moves the member onto a `T.FURN` cell, but `isIndoor` recognizes only floor/door/garage tiles; it ignores the object's existing `floor` property. Reproduce: sleep in any home bed at 3 PM. With indoor temperature 95.18°F, the sleeper receives 127.10°F felt exposure, exactly as outside. Node inspection confirms all three home beds return `isIndoor=false`. Floor sleeping avoids this penalty. Resolve exposure using the underlying room/floor, including occupied furniture.

2. **P1 — Walking and physiological time disagree by 60×.** `src/map.js:2`, `src/family.js:181`, `src/main.js:356`. The map states one cell is one meter; `walk=1.45` advances meters per real second, while that second advances one game minute. Marcus therefore travels 1.45 meters per game minute, rather than 87 meters at 1.45 m/s. Reproduce: give Marcus a long unobstructed route at 1× and advance one real second: 1.45 meters, one game minute. A hypothetical 100-meter trip costs ~69 game minutes instead of ~69 game seconds, distorting heat exposure and the water deadline. Decide whether physical units or a deliberately compressed spatial scale are intended; for literal units, movement distance needs `walk * dtMin * 60` (with speed modifiers).

3. **P1 — Hydration and heat injury have no consistent body-size/physical basis.** `src/family.js:261–283`, `src/inventory.js:6`. One liter restores 35 points to both an adult and a seven-year-old, so both share an implicit 2.86-liter full meter. The child loses *more liters* than the adult because of `vul=1.3`. Reproduce: hold exposure/activity equal; child water loss is exactly 1.3× adult loss. Sweat capacity drops abruptly at hydration 30 and 10; temperature approaches a bounded target even at zero water. In the indoor no-water runs below neither member reaches 104°F before death. At exactly 104°F, heat alone removes only 5 health/hour, leaving 20 hours from full health. These are structural limitations; increasing one damage/sweat coefficient cannot calibrate all scenarios. Use body mass, water deficit and net heat storage; see proposed numbers below.

4. **P2 — Spoiled bulk milk/juice bypasses all spoilage consequences.** `src/main.js:165–176`. The liquid branch returns before the spoiled check. Reproduce at 3 PM on day 1: `milk_gallon` is labeled spoiled (`spoilsH=6`), yet drinking one liter changes hydration 50→58 and food 50→55, leaving health 100 and morale 60 unchanged. Nonliquid spoiled food loses 12 health and 6 morale. Apply the spoilage policy to liquids as well; don't imply every spoiled dose causes deterministic immediate cramps in a future illness model.

5. **P2 — Multiple users multiply a single faucet's flow.** `src/family.js:216–223`, `src/family.js:116`. Each member's `fillTub` task independently adds `2.5 * pressure` L/min. Reproduce: assign all four members to fill the home tub at full pressure; one game minute yields 10 L instead of 2.5 L. Standing cells and beds also have no reservations. Own flow on the tub/world object, with users controlling the valve, rather than producing flow per person. Define occupancy before relationship/base tasks share objects.

6. **P2 — A half-full gallon jug permanently has half capacity.** `src/inventory.js:18–23`, `src/data/items.js:10`. `water_gallon_half.liters=1.9` is used for both initial content and maximum capacity. Reproduce: create that entry; it starts with 1.9 L and is considered nonrefillable. Empty it and refill from a plentiful tub: it can hold only 1.9 L, while the otherwise same gallon jug holds 3.8 L. Separate container capacity (3.8 L) from initial fill (1.9 L).

7. **P2 — Action menus validate proximity only when opened.** `src/main.js:140–148`, `src/main.js:154–156`, `src/main.js:207`. `useItem` and `give` do not recheck distance or a dead owner. Reproduce: open a give/drink menu near another member while that recipient is walking away; leave the menu open, then activate it after separation. Delivery still succeeds. Direct method reproduction at >2.6 meters raised Theo's hydration 74→91 from a remote bottle. Validate alive/proximity/capacity and the stable entry identity when committing an action, especially before autonomous relationship actions are added.

8. **P2 — Dry powders generate hydration without consuming water.** `src/data/items.js:43`, `src/data/items.js:74`, `src/main.js:175`. Reproduce with no water in inventory or tub: consume formula or an electrolyte packet. Each adds 8 hydration, equivalent to ~0.23 L under the existing water conversion; the electrolyte packet also adds 3 health. Add explicit preparation recipes consuming measured potable water; powder itself must add zero fluid.

9. **P2 — Condition-specific medicines function as instant universal healing.** `src/data/items.js:67–78`, `src/main.js:175–178`. Reproduce: use insulin, blood-pressure pills or fever reducer on a nondiabetic, dehydrated child/heat-injured adult: each applies its positive health delta without indication, dose, delay or cooldown, and consumes an entire bottle/vial entry. This is incompatible with the requested grounded model. Until conditions/doses exist, remove generic healing from these drugs and make their appropriate use condition-specific. Keep injury care, fever and environmental hyperthermia separate.

## Physiology: what the present numbers actually do

Executed the unchanged `Member.updateBody` and `Sim.step` source with rendering bypassed. Step = 0.1 game minute, no drinking/eating/sleeping, initial core 98.6°F and original Marcus/Theo needs (hydration 82/74, energy 55/62). Indoor: awake/idle on ordinary floor from 6 AM, indoor initially 79°F, normal evolving weather. Outside: continuous walking effort from 3 PM, weather evolves normally; initial needs are reset to their definitions at departure, not depleted by a prior nine-hour wait. Walking is held active independently of the tiny map. All times below are **elapsed game hours**, not real hours; one game hour takes one real minute at 1×.

Here “serious marker” means the earlier of the game's severe-dehydration label (hydration <20) or heat-stroke flag (core ≥104°F); it is not a validated clinical equivalence.

| Exposure | Member | Serious marker | First core >101.5°F | Health ≤50 | Death |
|---|---|---:|---:|---:|---:|
| Indoors, from 6 AM | Adult Marcus | 17.44 h, hydration | Never before death | 26.61 h | 33.75 h |
| Indoors, from 6 AM | Theo, age 7 | 14.14 h, hydration | 14.78 h | 23.09 h | 30.24 h |
| Walking outside, from 3 PM | Adult Marcus | 2.29 h, hydration; stroke 2.68 h | 0.75 h | 6.57 h | 14.33 h |
| Walking outside, from 3 PM | Theo, age 7 | 1.39 h, stroke; hydration 1.50 h | 0.53 h | 3.64 h | 5.94 h |

First indoor health loss occurs at 15.64 h for Marcus (energy exhaustion) and 14.81 h for Theo; indoor peak cores before death are only 100.68/102.10°F. The health/death totals include hunger and fatigue damage, not heat/dehydration alone. Outdoor adult death is delayed overnight by falling exposure; freezing weather at its 3 PM values instead gives stroke/death at 2.28/6.75 h for Marcus and 1.35/4.76 h for Theo. Holding peak heat indefinitely would misrepresent this daily curve.

At 3 PM air = 114.97°F and felt = 127.10°F. Current outdoor walking water equivalents are **0.81 L/h adult and 1.06 L/h child**. Indoor idle water equivalents: 79°F = 0.034/0.045 L/h; 95°F = 0.098/0.127; 100°F = 0.150/0.196. Both members receive the same +35 points/L despite different body sizes. If interpreted literally, the child must accumulate ~2.29 L deficit from full to reach the severe label: ~9.1% of a hypothetical 25 kg body, versus ~2.9% of an 80 kg adult. The initial meters already imply ~0.51/0.74 L deficit under this conversion.

## Rough real-world comparison, with uncertainty explicit

[NIOSH hydration guidance](https://stacks.cdc.gov/view/cdc/45851) recommends roughly 0.7–0.95 L/h intake during hot work, frequent small drinks, and warns against excessive intake. This supports the order of magnitude of current adult outdoor replacement demand, not a universal sweat rate or safe exposure duration. The [NATA fluid-replacement statement](https://pmc.ncbi.nlm.nih.gov/articles/PMC5634236/) describes increased strain above ~2% body-mass fluid loss and lower absolute whole-body sweat losses in children. The game's larger absolute loss for Theo goes in the wrong direction.

For an explicit comparison envelope, assume **80 kg adult / 25 kg child**, initially hydrated, no water intake. Choose illustrative total fluid-loss rates below; these are proposed calibration scenarios, **not measured Phoenix-specific clinical survival times**. Compute time = deficit liters / loss L/h, taking 1 L water ≈1 kg. Use 2% loss as a strain warning and 5% as a serious-deficit design checkpoint, not a diagnostic cutoff.

| Scenario | Assumed adult/child fluid loss | Adult: 2% / 5% deficit | Child: 2% / 5% deficit |
|---|---|---|---|
| Resting in a house already at ~95–105°F | 0.15–0.40 / 0.08–0.20 L/h | 4–11 h / 10–27 h | 2.5–6 h / 6–16 h |
| Walking in ~115°F afternoon sun | 0.70–1.20 / 0.25–0.50 L/h | 1.3–2.3 h / 3.3–5.7 h | 1–2 h / 2.5–5 h |

The initially cooled 79°F house delays fluid loss relative to the first row. Existing initial deficits shorten these estimates. Heat illness can precede either fluid checkpoint: radiation, humidity, airflow, clothing, acclimatization, drugs and illness matter. Neither references nor current inputs justify one fixed time-to-stroke for either age. For game validation, expect potential serious thermal harm on a minutes-to-hours scale outside, and hours-to-day scale in a heating house, with broad variability; these are scenario envelopes, not guarantees.

[CDC/NIOSH](https://www.cdc.gov/niosh/heat-stress/about/illnesses.html) reports that **once heat stroke occurs**, temperature can rise to ≥106°F in 10–15 minutes; that is not the time from first stepping outside. Heat-stroke victims can sweat profusely, so the game's mandatory “hot and dry” description is misleading. [AAP's heat-illness handout](https://www.aap.org/globalassets/publications/coya/exercise_related_heat_illness_final_secured.1.0.pdf) distinguishes life-threatening heat stroke by high core temperature and neurologic dysfunction and emphasizes immediate cooling. A generic 5-health/hour tail at 104°F does not represent that urgency.

The weather is believable as an extreme July heat wave, rather than average July: [NOAA 1991–2020 Phoenix normals](https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-monthly-1991-2020&endDate=9996-12-31&format=pdf&startDate=0001-01-01&stations=USW00023183) put July daily high/low at 106.5/84.5°F. The game's 116/89°F is plausible heat-wave forcing. Indoor readings from the current curve are ~95.18°F at 3 PM, 102.60°F at 8 PM and 90.73°F next 6 AM. However, a permanent `outdoor-6°F` target grants passive cooling without an energy source. The [Phoenix blackout study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10249403/) uses building-specific thermal models and ventilation; it does not validate a universal six-degree offset or individual survival countdown.

## Suggested coefficients and contracts for the next pass

- **Mass and water:** add explicit mass (initial calibration examples 80/25 kg, not inferred from age alone), water deficit L and drinking/absorption. Define HUD hydration as `clamp(100 - 1000 * deficitL / massKg)`: 2/3/5/8% deficits map to 80/70/50/20. A liter then restores 12.5 adult points or 40 child points; remove universal +35/L. Choose intentional starting deficits or start fully hydrated. Allow 0.15–0.25 L drink actions; keep ingestion separate from delayed absorption/recovery.
- **Provisional fluid-loss curve:** replace point loss with adult L/h `q = (0.08 + 0.0022 * max(0, feltF-85)^1.5) * activity`. It gives ~0.15 L/h at 95°F idle, ~0.28 at 105°F idle and ~0.95 at 127°F walking (`activity=1.4`). As a first calibration approximation, multiply absolute child loss by `(mass/80)^0.67` (~0.46 at 25 kg), replacing `vul=1.3`; relative-to-mass loss remains greater. These are tuning seeds, not clinical equations. Separate baseline renal/respiratory loss and sweat in the next version so sleep and heat acclimatization can affect them correctly.
- **Heat:** replace bounded target `98.6 + load*0.11*(2-sweat)*vul` and the abrupt 30/10 cutoffs with heat storage. Start with heat capacity ≈3.5 kJ/(kg·°C), so `deltaCoreC = netHeatW * (60*dtMin) / (3500*massKg)`. Effective evaporation of 1 L/h removes roughly 675 W; multiply sweat loss by an evaporation efficiency depending on humidity, airflow and clothing. Include metabolic heat, absorbed sunlight/shade and dry/radiant exchange separately. If a target model is retained temporarily, vary dehydration continuously and calibrate each exposure independently; there is no defensible universal replacement for `0.11` from these four runs.
- **Harm and recovery:** express time above 40°C/104°F and neurologic impairment explicitly, trigger urgent loss of function, and calibrate injury on minutes of severe hyperthermia rather than a fixed many-hour health reserve. Do not equate any fever reducer or insulin with cooling. Drinking must not erase organ injury or instantly recover the water deficit. Treat the alert as suspected heat stroke, allowing sweating.
- **House:** retain a configurable ~6 h thermal time constant as a provisional building parameter, change permanent `-6°F` equilibrium offset toward 0°F, and add solar gain, insulation, nighttime ventilation and separate garage/room state. Compare simulated indoor trajectories with building data before claiming realism. Cap or scenario-drive the unbounded +0.6°F/day escalation.

## Architecture before relationships/base building

Keep changes incremental: establish one game-time unit, stable item/container identities, object-owned state/reservations, and one action-validation boundary. Separate terrain/exposure from furniture occupancy. Move body integration into a rendering-independent module accepting exposure/activity/fluids; `Member` can retain visual control. Currently importing `family.js` in Node needs the browser Three.js mapping, and `main.js` owns rules, DOM, inventory mutation and rendering together. These seams make deterministic survival tests and future autonomous actions harder; they do not require rewriting the renderer.

Seed simulation/loot explicitly for repeatable runs (`src/main.js:82` currently seeds from wall time). Future saved games will need serializable state; no persistence is currently implemented. These are extension risks, not claims of a current save-game defect.

## Verification and reproduction method

- Node v22.23.3; requested command `node --input-type=module -e "import('./src/map.js').then(m=>console.log(m.buildMap().objects.length))"` passed: **136** objects.
- A temporary Node VM harness evaluated the unchanged family source after removing imports/export keywords, provided the vendored `THREE` module, and created members with `Object.create(Member.prototype)`. It stubbed only visual/death/log effects; real `updateBody`, `updateTask`, `Sim.step`, inventory helpers and extracted `game.useItem` ran. It reproduced bed exposure, liters/temperature timelines, liquid spoilage bypass, tub flow, container capacity, remote consumption and powder hydration. The one-minute movement check called real `Member.update(1,1)` on a long path with visual/task/body methods stubbed: 1.45 m traveled.
- No Playwright/browser smoke run was performed. Findings involving menus include source-verified event paths plus direct-method reproduction; visual click behavior remains unverified. No changes to gameplay, dependencies, infrastructure or the default branch.

To reproduce the survival table from repo root without installing packages:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import vm from 'node:vm';
import { Sim } from './src/sim.js';
import { buildMap } from './src/map.js';
const c = {}; vm.createContext(c);
vm.runInContext(fs.readFileSync('src/family.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export /g,'')
  + '\nglobalThis.M=Member;globalThis.F=FAMILY;', c);
for (const outside of [false,true]) for (const d of [c.F[0],c.F[3]]) {
  const sim = new Sim(), map = buildMap();
  if (outside) while (sim.min < 900) sim.step(.1);
  const m = Object.create(c.M.prototype);
  Object.assign(m, {
    child:d.age<12, needs:{health:100,morale:60,...d.needs},
    bodyT:98.6, flags:{}, path:outside?[[0,0]]:[], task:null,
    asleep:false, dead:false, cell:()=>outside?[30,21]:[24,7],
    alerts(){}, die(){this.dead=true;}, game:{sim,map}
  });
  const start=sim.min, hit={};
  for (let i=0; i<43200 && !m.dead; i++) {
    sim.step(.1); m.updateBody(.1);
    for (const [key,cond] of Object.entries({
      dehyd:m.needs.hydration<20, hot:m.bodyT>101.5,
      stroke:m.bodyT>=104, half:m.needs.health<=50, dead:m.dead
    })) if(cond && !(key in hit)) hit[key]=((sim.min-start)/60).toFixed(3);
  }
  console.log(outside?'outside':'inside',d.name,hit);
}
JS
```
