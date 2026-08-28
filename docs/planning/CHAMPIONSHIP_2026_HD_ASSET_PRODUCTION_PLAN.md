# Championship 2026 — HD Asset Production Plan

Date: 2026-08-29  
Policy: original evidence informs production; it is never a shipping asset by default

Solo sequencing: complete the game first with IP-neutral original placeholders; choose and produce the final original IP/content only after the functional-completion gate. Art is a replaceable content layer, never gameplay authority.

## 1. Definition of HD remake

A valid HD remake asset is a clean, resolution-independent or genuinely redrawn/rebuilt master that preserves evidenced visual relationships while being authored as licensed or original-created production material.

Not accepted as HD production:

- nearest-neighbour enlargement;
- AI upscale or sharpening presented as a redraw;
- filtered ROM pixels;
- tracing that remains a direct derivative without licence clearance;
- independently generated animation frames with drifting identity;
- invented source semantics labeled as original behavior.

Every asset records source reference, observed design DNA, rights status, evidence status, production owner, human approval and runtime QA.

## 2. Production inventory

| Family | Evidence inventory | Production objective |
|---|---:|---|
| UI | 96 NXR / 1,369 nodes / 9 reference families | one responsive component system |
| Creatures | 216 regular + 8 eggs | schema capacity first; final original roster size decided after functional completion |
| Cage/Training | 40 field references | modular Raising environment family |
| Hunt | 16 biomes / 29 variants | 16 distinct layered biome kits |
| Battle | 11 static fields | 11 readable arena treatments |
| Gate 3D | globe, earth, 16 biome nodes, day/night evidence | original-created bounded 3D globe |
| VFX/3D pilot | Gate, hitspark, hypereffect, spark, rain | reusable modern VFX library |
| Audio | 151 extracted reference payloads | caller map plus licensed/original soundtrack and SFX |

## 3. Rights and promotion states

```text
ROM_COPYRIGHTED_REFERENCE / RESEARCH_ONLY
  -> design observation and production brief
  -> ORIGINAL_CREATED or LICENSED master
  -> technical QA
  -> human visual approval
  -> READY_FOR_RUNTIME
  -> runtime/device QA
  -> SHIPPING_READY
```

Technical loadability is not legal clearance. Human approval is not automatically shipping approval. The asset manifest must block `ROM_COPYRIGHTED_REFERENCE`, `UNKNOWN` rights and `humanApproved:false` from production bundles.

## 4. Visual bible

Preserve:

- clear creature silhouette at phone scale;
- strong outline/edge separation without forced pixel-art treatment;
- deep navy, gold and cyan information hierarchy for UI;
- compact gauges and slot grammar;
- modular terrain, object and occlusion relationships;
- readable selected, locked, new, disabled, danger and status states;
- original scene renderer type where verified.

Modernize:

- resolution, antialiasing, texture material detail and alpha quality;
- secondary motion, contact shadow, rim response and VFX timing;
- accessibility contrast and color-independent state;
- touch target spacing and responsive composition;
- atlas, compression, lazy-loading and quality tiers.

## 5. UI production pipeline

Starting authority: the accepted P1R component direction.

Families:

1. application frame and background surface;
2. title/header and compact status strip;
3. panel, modal, drawer and bottom sheet;
4. primary/secondary/icon buttons;
5. HP/TP/condition/progress gauges;
6. equipment, plugin and team slots;
7. creature card, portrait and database row;
8. result plate, reward card and progression node;
9. focus, selected, locked, new, disabled and error states.

Author vector/CSS geometry where possible. Raster texture accents use original-created seamless materials. Export icons as SVG or appropriately atlased raster assets. Text is never baked into shared UI art.

UI gate:

- 360×800 through 430×932 responsive screenshots;
- AA contrast and color-independent state checks;
- 44 CSS px targets and visible focus;
- 200% text-scale stress;
- reduced-motion version of every non-essential transition;
- no ROM pixel or research path in runtime manifest.

## 6. Character and sprite pipeline

### 6.1 Batch strategy

- C0 — functional scaffold: keep the 224-slot research/schema capacity but expose only neutral product IDs;
- C1 — mechanics test set: create 16–24 simple original silhouettes/geometric creatures that cover egg, growth, evolution, status, size and animation cases;
- C2 — functional completion: finish every gameplay mode using the test set and replaceable manifests;
- C3 — final-IP gate: after New Game can reach Championship, choose title, world, launch roster and final visual brief;
- C4 — final pilot: produce 4–8 fully original final-quality entities covering diverse silhouettes;
- C5+: expand in 20–30 entity content packs only after each prior batch is approved;
- long term: 224 is an optional capacity target, not a first-release requirement.

Do not begin final mass art before the functional-completion and final-IP gates.

### 6.2 Per-entity production packet

- stable neutral product entity ID; any source-slot crosswalk remains research-only and outside the shipping manifest;
- evidence/rights record;
- approved neutral seed frame;
- silhouette, proportion, palette-role and key-feature sheet;
- main field sprite master;
- portrait/master illustration where required;
- approved animation strips;
- bottom-center ground anchor and contact shadow rules;
- hit/selection bounds distinct from visible alpha bounds;
- atlas manifest, memory estimate and test scene;
- brief-versus-production comparison for human review; research comparison stays outside the shipping tree.

### 6.3 Animation method

1. approve one in-game seed frame;
2. build a larger transparent edit canvas;
3. draw or generate the full strip in one pass;
4. normalize all frames with one scale and one bottom-center anchor;
5. optionally lock frame 01 to the approved seed;
6. render a preview sheet and inspect in the actual Pixi scene;
7. only then update the asset manifest.

Independent per-frame generation is rejected. Unresolved original slots remain `RAW_SLOT_XX` until trace or Owner-approved adaptation names them.

### 6.4 Runtime format and budget

- retain layered source masters outside runtime bundles;
- export transparent sprite atlases as WebP or PNG according to measured quality/support;
- mobile atlas pages normally max 2048×2048;
- prefer 256×256 logical frame envelopes; use 512 only for proven large silhouettes/effects;
- split roster bundles by progression/location so the full schema capacity is never resident at once;
- prewarm frequently used animation objects and reuse them.

Pixi asset rules:

- load textures and atlases through `Assets.load` and bundle manifests, never use `Texture.from(url)` as a fetch path;
- atlas aliases are stable product IDs and frame filenames are private implementation detail;
- background-load the next probable bundle, then use GPU preparation only where profiling proves a first-frame hitch;
- call `Assets.unloadBundle()` when a scene family is no longer needed and shared assets have been retained;
- provide retry and fallback behavior for failed bundles;
- select WebP/AVIF/PNG or compressed formats by measured quality, decode time, browser support and GPU memory, not by filename preference alone.

## 7. Environment pipeline

The original fields are modular constructions, not flattened screenshots. Preserve logical map, terrain, object placement, collision/attribute data and occlusion as separate concerns.

Recommended Pixi layer stack:

1. far background / ambience;
2. base terrain;
3. water, shore and terrain transitions;
4. macro terrain clusters;
5. paths, decals and ground variation;
6. grounded props and object layer;
7. actors, pickups and field effects;
8. foreground occlusion, weather and color grade.

### Hunt biomes

- one modular material kit for each of the 16 accepted biome identities;
- preserve the 128×128 logical field and verified object relationships;
- create 2×2, 3×3 and 4×4 macro clusters to break tile repetition;
- use irregular paths, decals and grounded props;
- make collision and ATR/COL classifications debug-only, never permanent visible grids;
- selected alternate variants remain a content backlog, not silent duplicates.

### Cage and Training

- preserve all 40 field references and the 40/36/35 crosswalk as data;
- CM12/CM18 conflicts remain quarantined until resolved;
- no invented facility effect is encoded in art;
- environment art responds to proven ownership/configuration state only.

### Battle fields

- remake 11 static fields with shared and field-specific layers preserved;
- BM03/BM04 animated-layer placement/timing remains blocked until trace;
- maintain clear silhouettes and effect contrast behind three-versus-three combat;
- keep arena art presentation-only; collision and result truth remain simulation data.

## 8. Bounded 3D pipeline

Allowed initial production target: Gate Select globe/earth and separately approved verified 3D VFX.

- author original-created geometry and textures; decoded NSBMD data is a research reference only;
- ship GLB/glTF 2.0, with consistent units, origins, pivots and node names;
- use KTX2/Basis texture compression if measured browser/device support is acceptable;
- cap real-time lights, prefer baked/cheap lighting and share materials;
- lazy-load Three.js and Gate assets after the first usable screen;
- provide a fully functional 2D/list fallback;
- do not mount a second global render loop.

## 9. VFX and game-feel pipeline

Initial reusable VFX families:

- selection/focus spark;
- hit spark and large impact;
- status/buff/debuff indicators;
- capture tether, circle, tension and resolution;
- evolution and reward reveal;
- weather: rain, mist, wind and environment overlays.

Each event is assigned a feedback tier:

- small: UI click, focus, minor pickup;
- medium: care success, normal hit, item/equipment change;
- large: capture, evolution, critical event, Title/Championship win.

Feedback may combine audio, flash/tint, particles, eased scale, number pop, short camera trauma and brief presentation freeze. Strong feedback must remain short, return to rest and preserve input. Never shake the simulated entity transform.

VFX gate:

- no important effect depends on color alone;
- reduce-flashing and reduce-shake variants exist;
- particles and number popups are pooled;
- transparent overdraw and draw calls are measured;
- VFX never obscures capture paths or Battle status for longer than the approved duration.

## 10. Audio production pipeline

Research SDAT supplies timing/caller clues, not shipping audio by default.

Production families:

- UI navigation, confirm, cancel, error and reward;
- care, feeding, cleaning, treatment and training;
- field footsteps, ambience, weather and interaction;
- capture tether/tension/success/failure;
- Battle hits, skills, status, heal, defeat and result;
- creature vocal families;
- Raising, Gate, Hunt, Battle, Result and Championship music.

Use a Master/Music/SFX/Ambience/UI/Voice bus graph. Repeated SFX use small sample and pitch variation. Stream long music; keep short SFX in memory or a bounded pool. Adaptive music uses aligned stems or bar-quantized segments and must stay within mobile voice/memory budgets.

Audio gate:

- rights recorded for every file;
- loop points click-free;
- master leaves headroom and avoids clipping;
- key events read on phone speakers and headphones;
- music ducks under important result/capture/evolution stingers;
- sliders are tested perceptually, not assigned raw linear values as decibels.

## 11. Asset registry contract

Minimum record:

```json
{
  "assetId": "stable.product.asset.id",
  "family": "character|ui|hunt|cage|battle|vfx|audio|3d",
  "evidenceState": "VERIFIED_BINARY|HIGH_CONFIDENCE_STRUCTURE|OWNER_APPROVED_ADAPTATION",
  "rightsStatus": "ORIGINAL_CREATED|LICENSED|ROM_COPYRIGHTED_REFERENCE|UNKNOWN",
  "sourceReferenceIds": [],
  "productionFiles": [],
  "runtimeManifestKey": null,
  "humanApproved": false,
  "readyForRuntime": false,
  "shippingReady": false,
  "memoryBudgetBytes": 0,
  "ownerGate": "",
  "notes": ""
}
```

The production build reads only the production index. It never scans research directories.

## 12. Review gates

Each batch passes in order:

1. evidence and rights review;
2. approved visual/animation brief;
3. source master review;
4. normalized export and atlas review;
5. in-engine 390×844 review;
6. smallest/largest viewport review;
7. memory, draw-call and thermal measurement;
8. accessibility variant review;
9. human visual approval;
10. production index promotion.

Reject a batch if proportions drift, ground anchors jump, transparency breaks, scene readability drops, research pixels enter runtime, or measured budgets regress without an approved exception.

## 13. Recommended first replacement proof

Before functional completion, make one deliberately bounded original-neutral packet to prove that the game is skinnable:

- one simple temporary original creature with idle, move, care, capture and Battle coverage;
- one temporary original Hunt biome using the full modular layer stack;
- one related Capture VFX family;
- the Hunt HUD/loadout UI components needed for that path;
- temporary original ambience, movement, capture and result audio;
- High/Medium/Low quality measurements on a phone.

This proof validates content provider -> manifest -> asset bundle -> runtime -> device QA replacement. It is not the final visual identity and must not trigger mass art. After the game reaches `FUNCTIONALLY_COMPLETE`, run a separate 4–8 entity final-quality original-IP pilot before scaling public content.
