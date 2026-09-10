# Battle pilot generation prompts

All three source images were generated on 2026-09-01 with the built-in OpenAI image generator. No ROM image or decoded production file was supplied to the generator. The two layer prompts used the first original-created image only as an in-session visual-direction reference.

## Visual target

Original modern 2D creature-battle arena; wide 3:2 elevated view; quiet oval three-versus-three playfield; bright temperate grassland; mint, leaf, sky blue, warm limestone, restrained gold and cyan; clean cel masses with restrained hand-painted texture; no characters, UI, text, logos, franchise symbols, or source-game geometry.

## BM00 canonical shared layer

Using only the original-created visual target, isolate the reusable warm limestone and brushed-gold boundary, cyan insets, foreground plinths, rear boundary, and six subtle standing rings on a transparent 3:2 canvas. Exclude grass, landscape, sky, banners, and field-specific scenery. After Owner feedback, a precise-object edit aligned the three mirrored ring pairs, followed by a second precise-object edit that removed the rings while preserving the frame. `scripts/build-battle-pilot-art.py` now recovers straight alpha from that frame-only white matte, zeroes transparent RGB, and draws the six rings from exact mirrored coordinates. The generated aligned-ring image remains in `source/bm00-shared-aligned-rings-v2.png` as a visual witness, not as the deterministic output.

## BM01 arena-specific background

Using only the original-created visual target, create the matching grass floor, distant valley, hills, shrubs, trees, sky, and clouds without the reusable boundary, plinths, rear wall, energy rim, banners, UI, actors, or VFX.
