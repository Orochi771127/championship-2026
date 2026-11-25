# Hunt map seams, 2026-11-26 (next batch after #312)

Open art holds from the 2026-11-25 expansion (hm10/11/13/14 grew to 180x180):

1. hm13 (雪之國度): ice cliffs in the extension step along the tile grid; check against the core's
   cliff style and soften only where the extension differs.
2. hm10 (杜比工廠) / hm11 (下水道): water joins between the original area and the extension.
3. hm10 / hm11 drain-phase GLBs that were delivered but are not bound.

Each fix is a GLB-level edit (Blender's glTF exporter loses the byte vertex colours), re-rendered
fallbacks, tests, and a review sheet in this folder.
