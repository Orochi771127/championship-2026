# BM02 grass Battle arena art direction

Status: **Internal Pixi review candidate; not Owner-approved, runtime-promoted, or shipping-ready**

BM02 is the lush grass/forest-edge biome. It preserves the BM01 camera, 1536×1024 canvas, quiet central combat floor, and bright daytime readability, but shifts the location identity from an open valley to a sheltered emerald meadow framed by trees, ferns, mossy stones, and restrained wildflowers.

The arena-specific file contains only the opaque environment. Its six aligned standing rings and boundary are not generated again: the isolated preview references the canonical `production:battle:shared:field-bm00-00` PNG from the BM00/BM01 package. This prevents geometry drift and avoids duplicate payload.

Explicit exclusions: ROM pixels, palettes, tiles, cells or geometry; field boundary; circles or rings; UI; text; logos; actors; VFX; recognisable franchise symbols; photorealism; 3D-render appearance; and invented animation.

Review contract: 360×800, 390×844, 393×852, 412×915, and 430×932 on the existing single PixiJS stage. Promotion remains blocked on Owner visual approval, browser QA, and linked generation licence evidence.
