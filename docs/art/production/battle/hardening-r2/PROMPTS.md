# Generation prompts and provenance

All four source cutouts were generated with the built-in `imagegen` workflow on 2026-09-02. The original tool outputs remain in the Codex generated-image store; selected copies are pinned under `source/` and hashed in `receipt.json`.

## BM04 palm

Create one original tropical palm prop as a clean transparent cutout, hand-painted anime game background style, readable at small size, no franchise elements, text, logos, or characters, and no floor shadow.

## BM04 energy-anchor pylon

Create one original ivory, warm-gold, and cyan energy-anchor pylon as a transparent cutout, compact championship arena prop, hand-painted anime game style, no text, logos, franchise elements, characters, or floor shadow.

## BM08 dead tree

Create one original twisted black-violet dead tree with subtle ember cracks as a transparent cutout, volcanic fantasy arena prop, hand-painted anime game background style, no text, logos, franchise elements, characters, or floor shadow.

## BM11 light ribbon

Create one original futuristic indoor championship arena light-and-score ribbon prop as a clean horizontal cutout. Use an ivory structural frame, cool cyan illuminated segments, small warm-gold indicator lights, a readable near-future sports silhouette, no letters, numbers, logos, trademarked/franchise elements, or characters, and a truly transparent background.

## Deterministic post-processing

The builder crops only visible alpha, preserves aspect ratio for BM04/BM08 props, uses the evidence envelope for the thin BM11 ribbon, and generates BM11 frame two by deterministic color and brightness adjustment. No generative inpainting or reference-pixel compositing occurs after source selection.
