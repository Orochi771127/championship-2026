# Completed original character runtime authority

2026-10-09 engineering clarification; local review acceptance and publication remain separate.

The existing `runtime.review.json` schemaVersion 1, renderer `PIXIJS_V8_SPRITESHEET`, is the runtime contract. `artProfile.scale` is the packed-to-native density authority. It must equal the selected entry in `completedOriginalCharacterCatalog.js`; logical canvas, anchor, source bank and every referenced `reviewGeometry.frames` scale/origin/sourceSize must agree. Main/Sub animation objects must retain the complete baseline sequence order, mode, alias and ticks.

The sidecar `manifest.json` records delivery identity/provenance and acceptance. Its historical `packedPixelsPerNativePixel` field is absent from the selected 38 growth deliveries and is not read by the loader. Do not invent another density authority in those sidecars. The loader and repository acceptance test must call the same runtime validator; missing or incorrect runtime scale/geometry must fail even if a sidecar says four.

Capacity diagnostics describe the atlas pages actually loaded by the bundle. Read physical pixel dimensions from the loaded Pixi TextureSource, not the replaced baseline roster record or logical sprite canvas. Count selected Main/Sub pages and deduplicate identical texture sources within a bundle. Missing dimensions produce an explicitly unknown estimate, not baseline fallback or zero.

`rgbaBytes` remains a compatibility alias for the base RGBA8 estimate: sum of unique source width × height × 4. Label it `BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE`. It excludes mipmaps, driver allocations, retained cache resources, decode copies and peak usage. Disposal clears this bundle's resource ownership; a zero owned estimate alone does not prove GPU memory reclamation. Browser checks must separately observe cache unload/source destruction and shared-owner retention.

No art resizing, origin/tick edits, branch invention, shipping permission or physical-device acceptance follows from this contract clarification.
