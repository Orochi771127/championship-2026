# BM05–BM11 static Battle arena family

Status: **internal layered Pixi review candidates; not Owner-approved, runtime-promoted, or shipping-ready**

This bounded family contains the six evidence-safe static arenas that reuse BM00: South Pole, Desert, Hell, Colosseum, Stadium, and Dome Stadium. Each preserves the approved 1536×1024 camera and a quiet six-actor combat floor while changing only biome identity. The canonical boundary and six mathematically aligned standing rings remain one external dependency and one PNG.

BM03 Volcano and BM04 Island are excluded because their animated-layer placement and timing are `UNKNOWN_REQUIRES_TRACE`. BM07 Cyberspace is excluded because the verified catalog gives it no BM00 dependency; it requires a separate one-layer architecture decision rather than silently inheriting the shared frame.

The generated backgrounds are flattened visual-review candidates only. BM08 and BM11 have verified field-specific object-layer names, so final production masters must restore that separation before promotion. No gameplay, collision, animation timing, UI, actors, VFX, ROM pixels, palettes, tiles, cells, or direct geometry enter this batch.
