# hm08 南橋峽谷 to 180x180 (2880), plan 2026-11-26

hm08 is the last hunt map still at 128x128 (2048). It is a pre-baked map like hm01: one
baked picture per field (day, night), a depth-only GLB (standable ground, foreground
structure, foreground vegetation), a mask and ground heights.

Steps (same route hm01 took to 2880):
1. Extend the authoring master (`hunt-masters-20261125`, the real hm08 authoring files) with
   original east/south terrain in the map's own kit: sand floor, raised mesas with dead
   trees and rocks, cacti, a cave mouth; nothing traced from reference art.
2. New 180x180 walkability: the original 128 grid unchanged at the origin; the extension
   designed to match the new terrain; no escape cells on the old 2048 edge.
3. Re-bake day and night at 2880; rebuild the depth GLB, mask and ground heights.
4. Bind at 2880, re-render nothing else, tests, browser check, report.

Heavy steps (Blender, bake, browser, test:ci, build) run only in agreed windows with
heavy.lock.
