# Two-set character animation intake (2026-11-12)

Owner request 2026-11-12: inventory, archive and wire the delivered two-set character animations — set 1 drawn over the original game's cells (General / ranch, hunt, battle sequences), set 2 drawn over a reference 8-heading sprite set (Data Arena) — after a by-eye check that each set matches the character's Dex illustration. Owner choice in this session: roles whose records say "candidate, awaiting review" may be wired after that check; roles that already had older reviewed art are replaced, with the older files kept for rollback.

## What changed

- 67 roles gain a two-set runtime folder `assets/production/characters/<code>-two-set-20261112/` (public + authoring manifest, WebP atlases: colour quality 90, alpha lossless). `SELECTION.json` pins each selection entry.
- Replaced earlier reviewed sets (files kept): AW23, AW25, AW26, AW27, AW28, AW29, AW31, UL14. AW02 is wired from its own R1 release (docs/reports/aw02-release-20261110).
- Contracts: reviewed selection, public allowlist, web build inputs, external-character local paths, art production index, facing masks and reviewed facing exceptions.
- Tests: the accepted-four boundary pins the two-set releases; the general facing map drops AW27, AW28 and UL14 (their old single-frame mirror lists belong to the retired art); the moving-body check skips routes whose original cells are transparent (UL20 / UL30 bound walks stay transparent like the original).

## How the delivered pictures are placed

See `VALIDATION.json`. General drawings keep the original route, cell order and ticks of the entity's runtime; each drawing stands where the original cell stood (alpha-box bottom-centre to the runtime atlas anchor), one density per character, no per-frame size fitting. Data Arena keeps the reference sprite's route, frame order, ticks and rush displacement; walk is anchored per heading. Faint routes that only repeat the hurt pictures are not published as faint, so knock-out holds the last hurt key as before.

## Not in this batch

Held, with the reason recorded per role in the private archive index (workspace `CHARACTER_TWO_SET_ARCHIVE_20261112`):
AW01 (approved General R4 not delivered as cells), AW03 (approved registered set not in the delivery), AW06 (repair pack without base cells or event map), AW51 (producer holds), AW52, AW53, UL40–UL42 (art-only originals or older art kept), UL07 (General cell map missing), UL08 (Arena back headings 1.4–1.6x larger), UL09 (General poses and 83 Arena slots missing), UL17 (Arena slots marked missing), UL01, UL02, UL04–UL06, UL16, UL03 and UL34 (format adapters or alternate-form runtimes), and the instructed holds GR04, GR13, GR32, UL27, UL39. AW12, AW14 and AW32 stay as already released.

## Placement and facing checks (round 2)

- Arena ground: per heading the walk median foot is on the anchor line and standing idle shares it; other actions keep their height relative to the walk. Walk feet within 3 % of body height, idle within 0.5 % for all 67 roles. Larger walk bob/sway flags were checked on contact sheets: wings, fins, tails or a lifted foot leaving the box, not a body shift.
- Facing gate: 69 new Arena keys flagged by silhouette overlap were reviewed on contact sheets; 65 read toward their heading (wings, weapon or tail on the other side, or a source turn), 4 AW15 R shoot/special opening/closing keys turn toward the viewer and are reported as art issues.
- Arena knock-down: 61 of 67 roles have no authored faint; knock-down holds the last hurt key, as before.

Rights: delivered original artwork; the reference sprite sheets used for timing and placement stay research-only and are not shipped. No commercial-rights certification. Rollback: revert this batch.
