# Hunt 3D art release scope — 2026-10-23

## Selected presentation

HM01, HM02, HM03, HM04, HM05, HM06, HM09, HM15, HM16, HM17 and HM18 use 2880 x 2880 world dimensions (180 x 180 tiles). HM08 remains 2048 x 2048 (128 x 128 tiles); it is not an enlarged-map completion.

The bounded shared Three/Pixi pass loads the existing authored material GLBs or existing HM01/HM08 baked GLBs. The original fixed projection, existing sprite actors, native simulation and one Pixi ticker remain. The supplied enlarged layout arrays retain their values; the adapter adds the existing expansion authorization tag where absent. Authored support tables are consumed as supplied. Missing support or renderer/asset failure retains the existing 2D fallback behavior. No capture, TTL, QA-save or functional regression was performed; functional acceptance remains with the Owner.

Every newly selected field has a matching 2880 x 2880 fallback raster rendered from the same imported model, camera and lighting. HM15 uses its supplied two lava textures and 835.7556556544072 ms phase durations. Other authored material maps currently retain their supplied static water appearance; original water animation parity is not claimed. HM01 retains its supplied day/night two-phase frames. Nighttime support fallback remains conservative and is not expanded in this task.

Appearance review used source reimport views and isolated fixed-camera WebGL views. The WebGL review exposed overbright lighting and shadow acne; lighting and shadow bias were corrected before final fallback export. These isolated art views do not establish gameplay or physical-device acceptance. Blender masters, downloaded ZIPs, source/reference phase crops and high-resolution review PNGs are excluded from the public payload.

## Incomplete maps

- HM10 / HM11: missing original 180 x 180 configuration was recovered and archived with matching SHA256. The adapter was prepared locally, but the narrow drain-water strip/splash joins still need art repair. Exact reference-pixel drain overlays are not published. Existing published presentation stays selected.
- HM13: dark tiled water patch remains visible in both source and WebGL view; not selected for publication in this batch.
- HM14 v9: original-to-extension ground texture/detail transition remains visibly abrupt; not selected for publication in this batch.

The remaining maps are art work, not missing downloads or an added functional test gate. No assertion that every hunt map is finished is made.

## Publication evidence

Local normal build and validate:playtest passed. Build ID: e145de39ab2c1456ec3cb0497d72a98451c5c2efd7b7a2ec93de06088018ddce; 8266 public files. Exact owner-playtest approval audit: ok=true, issues=[]. Required remote CI and Pages evidence will be attached to the release PR. Base main: a104acba (CM07 PR74). Existing swipe, character and database changes preserved.

The initial CI run identified stale Gate preview selection and art-contract inventory expectations. Gate previews now use the selected 3D fallback artwork, and the existing art checks cover the sixth map descriptor and its 19 fields. A reference URL in a runtime comment was removed to satisfy the existing source boundary. All five affected art/source checks passed after correction; no gameplay checks were run locally.
