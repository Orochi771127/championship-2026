# Ten battle stage candidates — local intake and motion validation (2026-10-07)

Status: LOCAL_CANDIDATE_VALIDATED_WITH_LIMITS; no default promotion, commit, publication or live-save write.

## Evidence → contract → implementation

Owner downloaded four BATTLE_MAP_STAGE_PART1..4_OF4_20261007 ZIPs. Their original Downloads files are retained. Independent copies, extracted parts and six separate source folders are under `../handoff-review-20261007/map-stage-20261007`. Four outer SHA/CRC, four chunk SHA, identical reassembly manifest, full ZIP 60,690,778 bytes / SHA256 e763a0edf5b5d1fd8cde7241aa1039cad68cf92aa71ac95f6815499962265084, six inner SHA/CRC and 202 source-manifest entries pass. INTAKE_AUDIT.json and SOURCE_MANIFEST_CAMERA_RECEIVER_AUDIT.json contain exact records.

Ten supplied clean RGBA frames remain byte-identical at1664×1088 (416×272 native). Each camera is52°/ortho26, the same matrix; all60 ready feet max projection error0.000283 raster px and authored receiver sample255. Read-only Blender loading found no unresolved external image dependencies; no scene rendered or saved. EXR sample values agree with camera-ray distance to the Z0 surface; they are not world height values.

The loopback query `battleReview=stage-20261007` chooses `assets/production/battle/stage-review-20261007/manifest.json`. Fields BM01/02/04..11 are candidates; BM03 points to unchanged existing R2. Unqueried defaults, arena options, source rules, character images/origins, simulation, and save authority remain unchanged. Private build boundary excludes the new directory.

## Shadow contract

The existing bm03GroundShadows loader/cache is reused, with an allowlisted local batch/field resolver. Each field has its own actual source SUN direction/angle and original author receiver intersected with EXR-derived |surfaceZ|≤0.08 world units. This removes lower levels/scenery from the Z0 shadow plane, preserving all60 feet. BM04 Z0 shallow water receives shadows. No material-name blanket water/lava exclusion is used.

Source alpha and original geometry for m201-r04 and m454 are reused:256 pre-baked facing/pose entries per field, two cast/contact textures each. This is the existing silhouette-height approximation with one SUN, not a reconstruction of character meshes or every area light. Each frame uses native origin/facing/lift, contact vanishes on lift, and only one shadow strategy draws. Other species/unbaked rotations retain the existing cheap blob. There is no new per-tick CPU raster generation or second ticker.

CANDIDATE_ASSET_BUILD.json records frame/receiver/depth/stamp hashes and mask support. Original receiver/depth files are intact in intake. Runtime receiver is a derived presentation mask, not navigation/collision data.

## Validation boundaries

- Focused shadow/stage cases8/8; existing battle-scene/map-bundle cases20/20. No VFX1407 repeat.
- Chrome390×844, DPR2: existing Practice menu arenas0,1,3,4,5,7, using an explicitly isolated fixture party m201+m454, real menu entry, unmodified AI, movement, both native LAUNCHED events, impact, jump, result and home return. Not naturally-raised-party or physical-phone evidence.
- Arenas6,8,9,10: only a test response overrides presentation arena while unchanged arena0 Practice simulation runs. No product unlock edit. A failed attempt at selecting6 is retained: normal runtime correctly rejects it.
- Each of10 runs observes14 character frames and releases all512 texture views;0 page errors/warnings. This is not all256 poses or all characters visually accepted. First screenshot holds the first loaded pose and can already be moving;60 ready-foot geometry is separately camera/receiver checked.
- `normal-action.png` was captured on≥5 distinct frames, so that filename alone does not prove attack semantics. Native LAUNCHED records for slots0/3 and impact in `normal-jump.png` support the attack claim. BROWSER_VALIDATION_SUMMARY.json states this distinction.
- Whole-page shadow A/B also contains DOM transition pixels; the reported terrain ROI isolates the scene. Do not call the full screenshot difference pure shadow pixels.
- Actual ten scene screenshots and BM04 jump reviewed. BM04 normal Settings JA/reopen/Continue/Practice loads210 and JA text cache; held EN switch/dispose passes. Existing partial UI translation remains partial.
- All ten candidate maps remain static first frames. BM03/BM04 field animation, physical-device performance, other body species, full visual approval and commercial/publication acceptance remain open. BM09 grout contrast is a nonblocking polish note.

## Rollback and continuation

Omit the query for baseline. Existing BM03 and other candidate queries remain available. `before-integration/` and SCOPED_IMPLEMENTATION.diff retain this batch's four scoped source/test changes; never whole-file restore over concurrent edits. Source producers and Downloads remain intact.

Cloud grassland handoff is complete and separate: original-source Library libfile_a0523dd63410819187de95701ecf900c (22,778,450B; SHA9eabca038ecad106db24e7863026039ab24038bacf0d68f2ab51c3961d6bc460), research-only libfile_4140723ebf4481919930aa1bda2aad1a (1,066,635B; SHA17dc8afbdf44008096f2c2c0e5862edecfd86b75e6b76e02e12956fc8f457742). Exact r10 producer closure/import/camera checked, no redraw. Grassland h1 is still no-query default; v2+r10 remains caveReview=natural-r10.192² is a separate prototype/spec, no official terrain/spawn/time/radar change. Tree dither remains unimplemented pending the held footpoint/depth comparison; do not mark it done.
