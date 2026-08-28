# Championship 2026 — Licensed Remake Style Bible

Status: `A0 SPECIFICATION LOCK`
Owner direction: 2026-08-29
Applies to: A1 Golden Art Slice through A11 roster expansion

## 1. Art thesis

Championship 2026 is a bright, fresh, high-definition interpretation of the original game's readable silhouettes, hand-drawn charm, modular fields and dense technology UI. It is not a pixel enlargement, a generic dark dashboard, or an excessively smooth 3D cartoon.

The product assumes a fully licensed faithful-remake route. Every production asset still needs its own linked licence evidence before runtime or shipping promotion. Original ROM and decoded files remain reference records until that link exists.

## 2. Global visual language

- Default scenes are high-key and welcoming: clear sky blue, mint and leaf green, warm white, sunlit gold and clean cyan.
- Use dark treatment only where the location calls for it: Mine, Sewer, Volcano, Graveyard, Hell, deep night and comparable hazards.
- Dark fields retain readable midtones, illuminated paths, contact shadows and rim separation. Black crush and invisible collision edges fail review.
- Shapes read at a 390×844 phone viewport before secondary texture detail is considered.
- Materials combine clean cel blocks with restrained hand-painted texture. Preserve slight line-weight variation and intentional asymmetry.
- Foreground decoration may overlap the safe area; critical controls, actors and paths may not.

## 3. Character direction

### Species mix

The roster is cute and hand-drawn, with cats and dogs as the majority rather than the entire identity.

| Release | Cats | Dogs | Other species | Eggs | Total |
|---|---:|---:|---:|---:|---:|
| Launch | 32 | 28 | 32 | 4 | 96 |
| Full catalog | 72 | 64 | 80 | 8 | 224 |

The remaining species preserve the visual value of birds, fish, marine mammals, reptiles, insects, plants, machines, spirits, slimes and giant creatures. A source creature with a strong non-mammalian silhouette should remain recognizably non-mammalian unless the cat/dog adaptation creates a stronger and equally distinct design.

### Breed vocabulary

Use real global breeds as anatomical and personality references, not as costumes or stereotypes.

- Cat pool: Maine Coon, Siamese, Bengal, British Shorthair, Persian, Sphynx, Ragdoll, Abyssinian, Japanese Bobtail, Turkish Angora, Norwegian Forest Cat and mixed-breed street cats.
- Dog pool: Shiba Inu, Akita, Corgi, Husky, Samoyed, Border Collie, Dachshund, Poodle, Saluki, Chihuahua, Bulldog, Great Dane and mixed-breed village dogs.
- Vary muzzle length, ear set, tail carriage, coat density, body mass, paw size and movement rhythm. Recolouring one base body does not create a new species.

### Original hand-drawn character

- Keep the original's compact proportions, clear pose, large expressive features and economical shadow shapes.
- Use pressure-sensitive outlines: stronger on the shadow/contact side, finer around face and interior detail.
- Retain two-to-four major colour masses before markings and effects. Avoid noisy fur rendering at field-sprite scale.
- Preserve the source character's major palette family for the current pass. Remake distinction comes from changed anatomy, breed vocabulary, proportions, markings, materials and hand-drawn finish rather than global recolouring.
- Marking shapes and placement may change, but their hues remain inside the original palette family unless a later Owner colour pass says otherwise.
- Keep two-to-four clear colour masses, stable field-scale readability and colour-vision-safe value contrast. Avoid both noisy rainbow treatment and muddy over-neutralisation.
- Modernize with cleaner anatomy, controlled secondary fur motion, soft contact shadow, subtle rim response and higher-quality alpha.
- Do not turn the field roster into realistic pet portraits. Every creature still needs a readable fantasy power, growth stage and battle role.
- One approved seed frame controls the complete animation strip. Independent frame generation is rejected.

### A1 character pilot

The eight licensed reference slots test the complete range before roster scaling:

| Reference | Adaptation test |
|---|---|
| `E000` | egg surface, crack language and hatch motion |
| `M001` | smallest soft-bodied cat-like form |
| `M201` | compact dog-like heroic biped |
| `M222` | insect silhouette retained with feline facial accents |
| `M226` | mechanical dog form and hard-surface articulation |
| `M228` | plant-cat hybrid with leaf gesture language |
| `M352` | avian form retained; no forced mammal conversion |
| `M431` | giant aquatic form retained with friendly hand-drawn expression |

Pilot review locks anatomy, line, the source-palette-preserving colour system, ground anchors and animation treatment. It does not authorize the 96-character batch by itself.

## 4. Environment direction

### Gate Select

Faithfully rebuild the globe, Earth role, sixteen biome nodes, day/night pairing and rotation experience with clean modern topology, UVs, atmospheric layers and high-resolution licensed textures. Do not ship a raw NSBMD conversion. Three.js stays bounded to Gate Select and uses the existing application state and render authority.

### Hunt

Preserve each verified 128×128 topology, route, exit, collision relationship and important object anchor. Rebuild presentation as eight layers: ambience, terrain, transitions, macro clusters, paths/decals, grounded props, actors/effects and foreground/weather. The phone sees a camera window, never a compressed whole map or permanent logic grid.

HM01 Grass is the A1 bright-field standard. HM09 Mine is the A1 dark-field standard. Together they lock the light/dark rules for the remaining fourteen biomes.

### Cage and Training

Forty field references become forty presentation presets assembled from shared shape-aware modules. Art may replace floor, edge, connector, facility, prop, foreground, animation and audio, but never owns `shapeMask`, occupied cells, capacity or raising effects. CM12 and CM18 object conflicts remain visibly quarantined in reference mapping.

### Battle

Remake eleven 52×34 fields with shared and field-specific layers separated. Protect three-versus-three silhouettes and VFX contrast. BM03 and BM04 animated layers remain separate until placement and timing are traced.

## 5. UI and HUD direction

Retain the original gold frame, cyan information accent, compact gauges, slots and technical texture, but reduce the amount of full-screen navy.

- Bright screens use warm-white or pale-cyan translucent surfaces with navy title strips and restrained gold edges.
- Battle, danger and deep-space contexts may use navy as the dominant field.
- DOM/CSS owns text, panels, lists, controls and accessibility. PixiJS owns playfields, actors and 2D VFX.
- Text is never baked into shared UI art. Icons require label or shape support for critical states.
- All components support selected, focused, pressed, disabled, locked, new, warning, error and loading states.
- Minimum target is 44 CSS px; primary thumb actions target 48–56 CSS px.

## 6. VFX data-port direction

`hitspark_big`, `hypereffect`, `spark` and `rain` use a data-faithful port, not a newly invented visual system. Reuse the licensed source node structure, animation order, timing, transform curves, visibility changes, palette family and texture role where decoding supports them. Unsupported parameter meanings remain raw/unknown rather than guessed.

Raw Nitro containers do not ship directly. Convert 2D-compatible effects into Pixi sprite sheets, particles and deterministic timelines; retain bounded Three only where verified source structure materially requires 3D. The new capture tether/circle family follows the same cyan/blue/gold visual language. All five families require normal, reduced-flash and reduced-shake definitions.
- Required viewports: 360×800, 390×844, 393×852, 412×915 and 430×932.

## 6. Output rules

- Layered source masters remain outside runtime bundles; runtime receives normalized PNG/WebP/SVG/atlas/GLB outputs only.
- Character frame envelope defaults to 256×256 logical pixels; 512 is reserved for proven giant silhouettes or effects.
- Mobile atlas pages normally remain at or below 2048×2048.
- Every character uses a bottom-centre ground anchor and separate visible, selection and hit bounds.
- Every batch records memory estimate, bundle, rights evidence, human approval and runtime QA.
- `READY_FOR_RUNTIME` and `SHIPPING_READY` are separate states.

## 7. Rejection criteria

Reject work that is a filtered enlargement, loses the source silhouette, looks like one reused cat/dog base, drifts between animation frames, hides paths in darkness, bakes gameplay semantics into art, copies research files into production, or lacks a reduced-motion/readability variant where required.
