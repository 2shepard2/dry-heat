# Dry Heat × Game Off 2026

GitHub Game Off 2026, theme **SHIFT**. https://github.blog/open-source/gaming/game-off-2026-the-theme-is-shift/
Jam page: https://itch.io/jam/game-off-2026

## Hard dates (PST)

- **Submit on itch.io AND have final code pushed to the public GitHub repo by Dec 1, 2026, 13:37 PST.**
  Pushing to GitHub does not submit the entry.
- Voting runs until Jan 1, 2027, 13:37 PST. Categories: Overall, Gameplay, Graphics, Audio, Innovation, Theme.
- Our internal cutoff is **Nov 29**. That leaves two days for packaging, the itch page, and anything that breaks.

## Rules that matter to us

- The game must live in a public GitHub repo, and most of the work must happen during November.
  Our first commit was 2026-11-01 18:11 MST, after the jam opened.
- Any license. Any tools or assets we have rights to.
- AI-assisted development is allowed. **The itch submission asks how AI was used. Answer plainly:** Daniel
  designed and directed the game and playtested it. Claude (lead), Codex (reviews) and MiniMax (bulk content)
  wrote the code and content.

## Before the repo goes public

- [ ] Replace `assets/models/Xbot.glb`. It is Mixamo-derived and must not be redistributed. Use CC0 rigged
      low-poly characters, or our own.
- [ ] Rewrite commit authors to a public identity. Current commits carry `@hester.local` addresses.
- [ ] Add a LICENSE and an itch-ready README, and scrub LAN addresses from docs.

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
