# BM03/BM04 Battle animation trace — 2026-09-02

## Result

The two remaining Battle animation bundles are closed far enough to produce original-created replacements without guessing their runtime shape:

- `field_bm03_01` (`BATTLE_VOLCANO`) is a full-field 52×34-cell, two-frame BSAR timeline at `(0,0)`, with raw durations `50,50` original field-update ticks.
- `field_bm04_01` (`BATTLE_ISLAND`) is a full-field 52×34-cell, two-frame BSAR timeline at `(0,0)`, with raw durations `20,20` original field-update ticks.
- ARM9 `0x02083D1C` calls the generic field animation update at `0x0204ED5C` with the update flag set. The existing platform-clock trace converts raw ticks using approximately `59.8260982881 Hz`.
- The full-field grid match, shared BSAR renderer, and original visual comparison support the composition order `animated terrain bed → static terrain/objects → BM00 common layer` at `HIGH_CONFIDENCE_CROSSCHECK`.

The trace does not assign collision, damage, walkability, battle-state, or other gameplay meaning to either animation.

## Rights boundary

The ROM, BSAR, NCGR, NCLR, decoded tiles, palette and reconstructed screenshots remain external research-only evidence. The production batch uses separately generated original-created pixels and stores only the trace metadata and source hashes in the repository.

## Reproduction

```powershell
python scripts/trace-battle-field-animation.py --field-root <external-unpacked-nitrofs-field-directory>
python scripts/trace-battle-field-animation.py --field-root <external-unpacked-nitrofs-field-directory> --check
```

Machine-readable evidence: `docs/research/BATTLE_BM03_BM04_ANIMATION_TRACE_2026-09-02.json`.
