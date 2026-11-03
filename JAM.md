# Dry Heat × Game Off 2026

GitHub Game Off 2026, theme **SHIFT**. https://github.blog/open-source/gaming/game-off-2026-the-theme-is-shift/
Jam page: https://itch.io/jam/game-off-2026

## Hard dates (PST)

- **Submit on itch.io AND have final code pushed to the public GitHub repo by Dec 1, 2026, 13:37 PST.**
  Pushing to GitHub does not submit the entry.
- Voting runs until Jan 1, 2027, 13:37 PST. Categories: Overall, Gameplay, Graphics, Audio, Innovation, Theme.
- **itch page is staged as a draft (2026-11-02). Publish it and submit it to the jam by Sun Nov 22** with whatever build exists. Later builds are just uploads. itch requires the page to be published before it can be submitted.
- Our internal cutoff is **Nov 29**. That leaves two days for packaging, the itch page, and anything that breaks.

## Rules that matter to us

- The game must live in a public GitHub repo, and most of the work must happen during November.
  Our first commit was 2026-11-01 18:11 MST, after the jam opened.
- Any license. Any tools or assets we have rights to.
- AI-assisted development is allowed. **The itch submission asks how AI was used. Answer plainly:** Daniel
  designed and directed the game and playtested it. Claude (lead), Codex (reviews) and MiniMax (bulk content)
  wrote the code and content.

## Before the repo goes public

- [x] Placeholder Mixamo model replaced by our own figures (`src/figure.js`) and purged from history (2026-11-02).
- [x] Commit authors rewritten to `2shepard2` (GitHub noreply); repo-local git identity set to match.
- [x] Public at https://github.com/2shepard2/dry-heat via Gitea push mirror (hester-lab/dry-heat, sync on commit).
      Anything pushed to Gitea goes public within seconds; never push internal branches there.
- [x] Daniel joined the jam on itch.io (2026-11-02).
- [ ] LICENSE (Daniel's call). Until then the code is all rights reserved by default.

## Team and workflow (Daniel, 2026-11-02)

- **Claude conducts.** Claude designs and writes briefs, reviews, merges, publishes, and talks with Daniel.
  Claude writes code only for glue, shared data formats, and fixes too small to delegate.
- **Codex builds systems** (simulation, AI, mechanics, UI logic), using model `sol`.
  **MiniMax does bulk work:** content data, writing, asset sourcing with licence records, and map lots.
- Workers push `mission/<id>` branches to **private `hester-lab/dry-heat-work`**. Under Daniel's standing grant
  this is scope `own`, so no approval is needed (Mission Room README "Approvals"). Workers never push to
  `hester-lab/dry-heat`. It mirrors to public GitHub.
- **Review is light by design.** Claude reads the worker's report and diff stat, skims the risky parts, runs
  `node tools/smoke.mjs` once (workers have no browser), and looks at one screenshot. Then Claude squash-merges
  under the `2shepard2` identity, pushes `main` to both remotes, and refreshes the preview. Claude doesn't read
  every line or rerun every test.
- **Two workers don't edit the same file in the same wave.** Shared data formats are agreed first, as a schema
  comment in the data file, so systems and content can be built at the same time.
- Daniel playtests on the LAN preview. His notes go into the next wave.

### Wave 1 (Nov 2-5)

| Who | Task | Files |
|---|---|---|
| Codex | Watch shifts and the night-event interpreter (SHIFT part 2) | `src/events.js` (new), `src/family.js`, `src/main.js`, `src/ui.js` |
| MiniMax | ~15 night events following the schema | `src/data/events.js` only |
| Claude | Briefs, the event schema, merging, Daniel's playtest | `JAM.md`, `src/data/events.js` schema header |

## Theme: SHIFT

The theme describes what you actually do to survive a Phoenix summer without power:

1. **Shift the day.** Daytime kills, so the family has to flip to nights: sleep through the afternoon,
   then search, haul and fetch water after dark. That is the core loop, not decoration.
2. **Shifts.** Someone has to stay awake while the others sleep. Parents trade watch shifts, and sleep
   becomes a resource you spend.
3. **Shift in the family.** Over the days, Jess goes from a kid you give orders to someone you can lean on
   and control directly. The story's arc happens in the controls.

## Jam scope (rough)

- Week 1 (Nov 2-8): day/night shift loop, watch shifts, water trips out at night.
- Week 2 (Nov 9-15): base building (shade, swamp cooler, water storage), more of the street.
- Week 3 (Nov 16-22): real characters and art pass, **audio** (heat drone, cicadas, night sounds),
  and Jess's arc.
- Week 4 (Nov 23-29): balance from Daniel's playtests, ending(s), itch page, screenshots, packaging
  (`jam-kit/tools/package.py`).
