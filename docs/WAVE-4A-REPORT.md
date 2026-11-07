# Wave 4a partial implementation

Base: 8cd4a43. Branch: mission/MSG-435fda916146.

Implemented household routine tasks, adult self-care, bounded autonomous drinks,
per-person autonomy controls, compact need glyph chips, selection detail panels,
two-line expandable log, conditional Worn text, warm powered room lights and a
higher moonlight floor. Existing child follow/help/refusal behavior remains.
Autonomy consumes carried or discovered home supplies, never searches stock.

Engine contracts:
- Member.autonomy defaults true; setAutonomy(enabled) stops autonomous work when disabled.
- Autonomous goals/tasks carry autonomous:true. Household actions use type: routine
  with care/source/label/duration fields. They do not call beat notifications or
  survival system completion callbacks.
- Autonomous paths are restricted to home interior cells.
- Autonomous drink threshold: hydration <85%, at most 0.35 L from bulk/tap/tub,
  with at least 20 game minutes between drinks. Single sealed drinks consume one
  existing inventory serving. Supplies are rechecked at completion.
- Walk beat proximity ignores autonomous goals/tasks.
- game.detailMember provides inspection independently of parent selection so the
  child panel can be opened without enabling direct child movement.
- No new beat fields. src/data/beats.js and src/data/lines.js are unchanged.

Validation: all 21 existing tests pass after changes (`node --test
src/systems.test.js`). Required new autonomy regression tests have NOT been added.
Browser/visual validation and HUD coverage measurement are NOT complete; no
screenshots or click-only playthrough are attached.

Blocker: Playwright Chromium downloaded to /tmp, but launch fails because
libatk-bridge-2.0.so.0, libxkbcommon.so.0, and libatspi.so.0 are unavailable.
An attempt to download the packages into /tmp failed with Operation not permitted
(setgroups/setegid/seteuid). Stopped under the unattended worker's denied-action
rule. No live services or host configuration were changed.

Next: provide a worker browser runtime with those libraries, then add autonomy
regressions, inspect/fix the UI and lighting in Chromium, measure world coverage
at 1366x768, and capture baseline/after, Thursday steps 1–3 using clicks only,
Thursday 21:00 and outage day 1 22:00 evidence. Treat this branch as unvalidated
partial work until those checks pass.
