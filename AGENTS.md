# Dry Heat: agent front page

Game Off 2026 entry (theme SHIFT, submit by Dec 1 13:37 PST; our target is Nov 22). Isometric survival sim: a
family in a Phoenix suburb in July when the grid goes down. Three.js r187 vendored, plain ES modules, no build.
Story canon: `docs/STORY.md` section 0. Tone: grounded, sober, never gamey.

## Hard rules
- This repo is **public** (Gitea `hester-lab/dry-heat` mirrors to GitHub). No LAN addresses, hostnames or
  internal notes in commits. Worker branches live in the private `hester-lab/dry-heat-work`. Claude squash-merges
  them to `main` under the repo identity.
- Money appears in exactly three places (register, fridge list, solar lease). Don't add a fourth.
- Each wave has a spec, `docs/wave-<n>.md`, with an ownership table. Edit only the files your part owns.
  Engine contracts go at the end of that spec under "<part> contracts".
- Data files (`src/data/*.js`) are plain data with a schema header. Content and engine are separate owners.

## Health
- Tests: `node --test src/systems.test.js` (Node 22). They must stay green.
- Browser: `node tools/playthrough.mjs <outDir>` (real clicks, no jump hooks). It needs Playwright from
  `/opt/claude/tools/browser`, so only Claude on CT141 runs it, at merge.

## Map
- `src/main.js` boot, input, HUD wiring; `src/ui.js` HUD render (pure helpers are tested)
- `src/beats.js` prologue interpreter (beats, chores, trips); `src/data/beats.js`, `src/data/chores.js`
- `src/family.js` people, needs, tasks, autonomy; `src/systems.js` water, heat, solar, radio
- `src/map.js`, `src/build.js`, `src/path.js` the block, the house, pathing; `src/events.js` night events
- `src/bubbles.js` speech bubbles

## Where things are
- Playtest notes from Daniel: the Playtest Board, project `dry-heat` (ask Claude).
- Specs and contracts per wave: `docs/wave-4b.md`, `wave-4c.md`, `wave-4d.md`.
