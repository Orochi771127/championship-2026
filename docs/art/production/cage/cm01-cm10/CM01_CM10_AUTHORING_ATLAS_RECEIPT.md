# CM01–CM10 Cage authoring-atlas receipt

Date: 2026-08-29

Batch: `ART_A3_CAGE_CM01_CM10_AUTHORING_ATLAS_V1`

Status: `COMPLETE / OWNER VISUAL REVIEW PENDING / NOT RUNTIME`

## Delivered

- Ten 128×128 repeatable material swatches with pixel-equal opposite edges and ten 3×3 seam proofs.
- Ten nine-cell edge/centre/corner visual-sampling atlases. These cells document visual vocabulary only; they are not claimed as native runtime tile roles.
- Detected raw art groups from each separate object bundle, normalized into stable 128×128 bottom-centre cells and packed into per-field object atlases.
- Ten art-staging previews that check visual scale and overlap only. Their positions are deliberately non-authoritative and cannot become placement data.
- Five contact sheets, a source-hash-locked manifest and a byte-identical deterministic rebuild route.

The original field dimensions remain attached to every record. Original ATR,
COL, collision, Raising effects, exact object semantics and placement remain
external and un-inferred. A material swatch proves repeatability only; it does
not replace verified field topology or a gameplay shape mask.

## Source and palette policy

This pass is a deterministic technical derivation of the approved CM01–CM10
clean-room review pack. It introduces no ROM image input and no new generated
board. Original major palette families remain unchanged. The generated source
boards and exact built-in generation prompts used by the preceding visual pass
remain recorded in `GENERATION_PROMPTS.md`.

## Rebuild

Run with the bundled workspace Python image environment:

```powershell
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/build-cm01-cm10-cage-atlas.py --verify-determinism
```

The manifest is `atlas-pack/manifest.json`. Human visual approval, a verified
native tile/shape contract and runtime integration QA are still required before
any promotion beyond `OWNER_VISUAL_REVIEW_PENDING`.
