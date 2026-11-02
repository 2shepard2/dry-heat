# Dry Season

Gritty, grounded isometric survival sim. Phoenix-area suburb, July, the grid is down.
You keep a family of four alive: personal care, inventory, relationships, base building.
No magic, no zombies.

**Status: grey box (build 0).** Tests the camera, heat/water/body sim, family control, and searching.

- Plain ES modules + Three.js r187 (vendored in `vendor/three`, MIT). No build step.
- Placeholder character: `assets/models/Xbot.glb` from the three.js examples (Mixamo-derived).
  Internal testing only; replace before anything public.
- Item and loot data: `src/data/items.js`.

## Run

    node tools/smoke.mjs <outDir>                                  # headless check + screenshots
    /opt/claude/projects/jam-kit/tools/preview.sh . 7923           # http://192.168.1.76:7923/

## Map of the code

| File | What |
|---|---|
| `src/map.js` | ASCII lot plan → 60×44 cell grid, furniture/containers, cars |
| `src/build.js` | Meshes: ground, walls (upper band + roof cut away when family is inside), furniture |
| `src/sim.js` | Clock (1 real s = 1 game min at 1x), outdoor/indoor temperature, sun, water pressure |
| `src/family.js` | Members: walking, tasks, body model (hydration, food, energy, core temp, health, morale) |
| `src/inventory.js` | Stacks, bulk liquids by the liter, spoilage since the power cut, loot rolls |
| `src/main.js` | Renderer, camera, input, game rules/objectives |
| `src/ui.js` | HUD |
