# Status-ailment loops r1 (STATUS_AILMENT_VFX_20261110)

The battle's negative-status slot (`battle/battleStatus.js`, runtime codes 1..14) now shows a pixel loop round the fighter and a tint or glow on its body. See the Owner Direction record `STATUS_AILMENT_VFX_20261110`.

## Source and rights

- Effect code: [pixelfx](https://github.com/patch-gg/pixelfx) v0.3.1, MIT License, Copyright (c) 2026 Patch and Copyright (c) 2026 Hugo Duprez. Parts adapt Sprite Fusion's open-source pixel art VFX (MIT, Hugo Duprez) and Hollow Crown (MIT, rehan-remade). Commercial use is allowed. The Patch Pixel font in pixelfx's gallery is not MIT and is not used here.
- Rights status: `LICENSED` (MIT). No ROM pixel, palette or layout is involved. Nothing is generated from an image.
- The generated module `src/championship/presentation/vfx/statusAilmentSprites.js` carries the MIT notice in a `/*!` legal comment, which the bundler keeps.

## Rebuild

```bash
git clone --depth 1 https://github.com/patch-gg/pixelfx <dir>
PIXELFX_HOME=<dir> node scripts/vfx/bake-status-ailment-vfx.mjs --sheet docs/art/production/status-ailment-vfx-r1/out
node --test tests/championship-status-ailment-vfx-cases.mjs
```

`--sheet` writes `status-ailment-sheet.png` (the first 12 frames of every look at 3x) to the ignored `out/` folder for review. After a rebuild, refresh the publication hashes of the generated module.

## Looks

| Runtime code | Look | Overlay source | Body |
|---|---|---|---|
| 1 | stunned | `status/stunned` (stars and birds) | – |
| 2 | charmed | `status/charmed` (hearts) | pink tint, soft glow |
| 3 | frozen | `status/frozen` (frost motes, rime ring) | ice tint, glow |
| 4 | rage | `status/rage` (steam, anger mark, hot ground) | red tint, glow |
| 5 | confused | `status/confused` (question marks, spiral) | – |
| 6, 11 | slowed | `status/slowed` (clock, behind) | teal tint |
| 7 | poisoned | `status/poisoned` (bubbles, ring) | green tint, glow |
| 8 | bleeding | `status/bleeding` (drops, pool) | red tint, glow |
| 9 | sleep | `status/sleep` (rising Zs) | lilac tint |
| 10 | electrified | `lightning/electrified` (arcs) | flicker glow |
| 12 | petrified | none | stone tint |
| 13 | cursed | `status/cursed` (smoke behind, skull, sigil) | violet tint, glow |
| 14 | burning | `status/burning` (flame tongues kept by colour, embers) | flicker glow |

The ROM evidence gives each code's mechanics, not its name. The mapping is a display choice, and `STATUS_AILMENT_BY_RUNTIME_CODE` records its basis row by row.

Data Arena relay conditions: root wears frozen, burn wears burning, slow wears slowed (`dataArenaStatusLook`).

## Move-hit bursts

The same bake writes `src/championship/presentation/vfx/pixelHitBurstSprites.js` (`PIXEL_HIT_BAKE`, 15 fps, burst only). `pixelHitBursts.js` plays one at every landed move in the AI battle and the Data Arena. `--sheet` also writes `pixel-hit-sheet.png`.

| Element | Burst | Anchor |
|---|---|---|
| FIRE | `explosions/small-explosion` 0–0.9 s, no smoke | contact |
| WATER | `water/splash` 0.25–1.0 s | ground |
| ICE | `ice/frost-nova` 0.45–1.2 s | ground |
| THUNDER | `lightning/zap-hit` 0–0.8 s | contact |
| WOOD | `nature/thorns` 0.2–1.2 s | ground |
| EARTH | `explosions/dirt-explosion` 0–0.75 s | ground |
| WIND | `arcane/mana-burst` 0.25–1.1 s, recoloured green | contact |
| SUN | `impacts/crit-hit` 0–0.7 s | contact |
| MOON | `shadow/dark-explosion` 0.55–1.35 s, no smoke | contact |
| METAL | `impacts/hit-spark` 0–0.5 s, recoloured steel | contact |
| NEUTRAL | `impacts/blunt-hit` 0–0.6 s | contact |
