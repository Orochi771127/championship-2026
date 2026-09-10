# BM03 / BM04 animated Battle art direction

This internal-review batch closes the two remaining Battle arenas without
copying ROM pixels, palette, tiles, or geometry into production.

- BM03 preserves the functional read of a stable basalt combat surface
  surrounded by visibly moving lava.
- BM04 preserves the functional read of a tropical island arena whose shallow
  water visibly moves beneath static shoreline and vegetation.
- Both use the canonical BM00 shared foreground already owned by the Battle
  family. No second copy is placed in this bundle.
- Original evidence determines only the full-field placement, two-frame
  timeline, raw frame durations, and back-to-front composition order.
- All scene masters are original-created. Layer masks and the second visual
  frame are deterministic builder outputs.

The bundle is internal review only. It has no gameplay, collision, battle UI,
shipping, or owner-approval authority. BM04's catalog-proven object layer is
flattened for review and must be separated before promotion.
