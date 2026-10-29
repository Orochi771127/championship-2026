---
name: championship-art-production
description: Art direction, rights, production and acceptance for Cyber Partner: Tournament — pixel characters, anchors and facing, ranch/hunt camera ratios, cage and hunt 3D scenes, UI art surfaces, mobile budget and Pages publication. Use for any art inventory, production, integration or acceptance work (new or changed sprites, portraits, items, cage/hunt/battle art, UI art, VFX). Not for gameplay rules or reverse engineering.
---

# Championship art production

Restored 2026-10-30 for the current product. The earlier Codex copy
(`C:\Users\USER\.agents\skills\championship-art-production`, September; a copy
survives at `R:\Projects\NexusLink\web\.agents\skills\championship-art-production`)
described the old rebuild phase: its ART-A stop gate, frozen programmes and
title wording are historical and do not apply. Current Owner direction and the
repository win over anything here; record a conflict instead of blending.

Act as art director, technical artist and asset-pipeline owner. Art never
changes gameplay authority, save truth, damage, capture, AI, progression or
rewards.

## Pick the mode

| Mode | Use when | Read |
|---|---|---|
| Inventory | "what art exists / is missing / is shippable" | [rights-and-evidence.md](references/rights-and-evidence.md), `docs/art/ART_MASTER_INVENTORY.md`, `assets/production/ART_PRODUCTION_INDEX.json` |
| Production | drawing, generating, modelling or converting art | rights-and-evidence, plus the area reference below |
| Integration | wiring art into runtime | the area reference, [mobile-and-release.md](references/mobile-and-release.md) |
| Acceptance | proving art is right in the running game | the area's gates, mobile-and-release |

Area references:

- Characters, anchors, facing, shadows, cameras: [characters-and-cameras.md](references/characters-and-cameras.md)
- Cage, hunt and battle scenes (Blender, GLB, walkability): [scenes.md](references/scenes.md), and the [hd2d-cage-world](../hd2d-cage-world/SKILL.md) skill for the ranch's 3D look
- UI art surfaces, themes, icons: [visual-language.md](references/visual-language.md), and the [juicy-monster-ui](../juicy-monster-ui/SKILL.md) skill for in-game HUD layout and motion

## Hard rules

1. **Rights first.** ROM-derived pixels, palettes, models, layouts and their
   direct derivatives are `RESEARCH_ONLY` and never ship. `ART_REFERENCE_LIBRARY`
   (workspace root) is research: never copy, trace or publish it. A runtime
   asset needs a record in `assets/production/ART_PRODUCTION_INDEX.json` with an
   allowed rights status before any code loads it.
2. **Runtime art lives under `assets/production/`.** `src/` never imports from
   `research/` or a Nexus Link path.
3. **One renderer authority each.** DOM = application UI; PixiJS (one
   Application, one ticker) = playable 2D; Three.js = approved bounded 3D
   scenes only. No second ticker, router, save or Pixi application.
4. **Walkability, collision and anchors are data, not pictures.** New art lines
   up with the data and its guide images; it never moves them.
5. **Measure, don't eyeball.** Every claim about size, anchor, facing, contrast
   or budget names the file, constant or gate that proves it. Unknown stays
   `UNKNOWN_REQUIRES_TRACE`.
6. **Title, logo, main menu and opening** stay exactly as live main shipped them
   unless the Owner names them in the request; verify with the title zero-diff
   check (juicy-monster-ui).
7. **Never use 8732** (the Owner's save) for QA. Use the isolated port 8761 or a
   worktree port.

## Finish

- Run the focused gates for the area you touched (listed in each reference),
  then `npm run test:ci`.
- For anything visible: browser check in portrait 390×844, landscape 844×390
  and desktop 1366×768, no console errors, screenshots as evidence.
- Commit, push, merge and publish need the Owner's authorization for this
  batch; a green build is not authorization.
