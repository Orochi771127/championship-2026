# Battle Production Hardening R2

## Scope

This internal-review batch separates field-specific object art for `field_bm04_01`, `field_bm08_01`, and `field_bm11_01`. It does not change gameplay, collision, UI, routing, save state, or shipping eligibility.

The reference boundary is strict: the external research archive supplies metadata evidence only. The production bundle preserves object counts, source anchors, cell envelopes, frame counts, raw ticks, and layer order. It does not copy reference pixels, palettes, tiles, Nitro payloads, or franchise marks.

## Approved layer orders

- BM04: animated terrain bed → static arena terrain → static field objects → canonical BM00 shared layer.
- BM08: arena background → static field objects → canonical BM00 shared layer.
- BM11: arena background → animated field objects → canonical BM00 shared layer.

The BM00 shared layer remains the sole owner of the six standing circles and arena border. Every hardened arena references the same asset ID and SHA-256, so circle and border alignment cannot drift per field.

## Original-created replacements

- BM04: two palms and five small energy-anchor pylons placed in the seven evidence envelopes.
- BM08: one twisted volcanic dead tree in the evidence envelope.
- BM11: one horizontal light ribbon with two presentation frames. Frame two is a deterministic color/brightness derivation of the same original-created source.

AI-generated cutouts are production inputs with transparent alpha. They are normalized, scaled, and placed by `scripts/build-battle-object-hardening-r2.py`.

## Review gate

Internal Pixi review requires one `Application`, one caller-owned ticker, one canvas, exact source unloads, contain-fit at all five contract viewports, and successful switching across all 11 arenas on the unified gallery page.

This batch remains `NOT_SHIPPING_READY`. Promotion still requires Owner visual approval and a linked license/terms record.
