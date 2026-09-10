# Built-in image generation record

Generated with the built-in `imagegen` workflow on 2026-09-02. All generated
files are 1536×1024 original-created, AI-assisted candidates. Existing artwork
was used only as an edit/composition target; ROM pixels were not supplied.

## Shared style target

`../style-calibration-r3/candidates/bm06-human-paint-c-recommended.png`

All prompts requested a hand-authored animation-background treatment: broad
block-in shapes, visible brush overlap, broken/lost edges, three value bands,
quiet central playfields, varied material response, and restrained focal
accents. They excluded characters, UI, text, logos, signatures, watermarks,
uniform microtexture, glossy toy bevels and universal rim light.

## BM00

Image 1 was the canonical shared overlay; Image 2 was BM06-C. The request kept
the border silhouette and six standing zones while repainting stone, metal and
cyan inlays. The model returned RGB with a baked checkerboard, so the builder
reapplies the exact canonical alpha mask. The model never owns transparency or
standing-zone geometry.

## BM07

The accepted generation used the background-before-rings image as its edit
target and explicitly prohibited standing zones. The rejected first attempt
used a composite target and redrew the rings; it is quarantined under
`rejected/`. The builder adds all six accepted rings deterministically.

## BM03 and BM04

Each background-only source was repainted with BM06-C as the style reference.
BM03 preserved the volcanic horizon and open basalt playfield; BM04 preserved
the lagoon opening, shoreline, palms and water playfield. The builder derives
the verified two visual frames and composites canonical BM00 plus BM04 objects.
