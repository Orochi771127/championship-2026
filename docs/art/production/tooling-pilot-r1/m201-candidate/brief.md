# M201 A Blender offline pose-reference comparison brief

Date: 2026-09-06. Isolated Multi-Agent V2 research packet. Product root: `R:/Projects/Championship2026/championship-2026`, `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`; existing dirty work preserved. This packet adds research metadata and a brief only. Root owns installation, downloads, study renders and any later integration. No production pixels or runtime files are authored here.

The authorized experiment compares whether a downloaded model, posed offline in Blender, helps resolve difficult M201 pixel poses. Preserve M201 A and the current native-grid pixel delivery. A proxy is a study aid and is not an M201 replacement or evidence of original anatomy. Do not start by constructing a final character from primitives.

## Current authored baseline

The selected identity is the gold short-muzzle cat-like juvenile in `docs/art/production/characters/appearance-refresh-v1/m201-a/SETTING_SPEC.md`: triangular ears, cream muzzle/chest, warm gold body, simple silver wrist hints and short thick tail. Hidden features remain hidden; no added ornaments or motion.

The live bank is `docs/art/production/characters/appearance-refresh-v1/pixel-v2/m201-a/pixel-bank.json`, version `m201-a-pixel-v2-r02`. Its `build-r02/receipt.json` records 7/47 authored masters, 17/83 slots, 8/53 sequences with all frames present. These are authored candidate coverage, not full art or motion approval. Use `build-r02/masters/main/cell_000.png` for current standing identity and `build-r02/masters/main/cell_023.png` for the existing difficult-pose comparison. Do not use the older `main-000-first-review.png` as current canonical art. Main 056 and 062 have no authored pixel master in r02; show that gap explicitly instead of substituting source pixels into an authored column.

## Three study poses

All exact PNG paths, file hashes, native bounds, original sequence references and timing are in `candidates.jsonl`. The external guides were visually inspected. They are research-only and use the transfer-aware decoding path; the old m201-seed high-risk contact sheet and its semantic labels are not authoritative for these studies.

| Source cell | Visual study only | Native cell bounds, exclusive max | Raw Main sequence / frame / ticks / mode |
|---|---|---|---|
| 023 | Low horizontal silhouette; head left, rising middle-right component, pale right endpoint; avoid flattening into an ordinary prone cat | [-16,-11,16,5] | 13 / 0 / 37 / 1 |
| 056 | Forward-low torso; separated pale endpoints and raised right silhouette; preserve visible gaps and overlap | [-16,-19,16,5] | 32 / 0 / 7 / 1 |
| 062 | Strong rotated pose entirely on positive native X; preserve deliberate rightward displacement and separated pale endpoints | [0,-19,24,5] | 37 / 0 / 37 / 1 |

All three raw sequences use loopStartFrame 0. Do not label these poses sleep/train/knockout based on historical gallery names. The motion contract uses raw IDs. Do not retime a downloaded animation to infer original gameplay events.

The corrected research guide canvas is 464x368, common source origin (184,268), 12 pixels per native unit. Mapping is `guide = (184,268) + nativeCoordinate * 12`. This origin is not a verified ground contact. Export proposal status remains `GEOMETRIC_PROPOSAL_NOT_APPROVED_EXPORT`, requiring scene-scale/anchor QA before production. The three pose studies must use the same camera/scale and compare in this common coordinate frame; do not center each pose independently. OAM rectangles are storage/composition units, not anatomical bones.

For Main 023 the existing pixel review identifies candidate grid-local upper component endpoint (20,1) and right pale endpoint (25,11), zero-based, within its 32x16 grid. Preserve these documented landmarks while recording that the wrist interpretation is still an artistic reading. New ears may use bounded head space; moving limbs to display an identity feature is not allowed.

## Existing free model candidate

The publisher's [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html) currently lists 12 animated animals, FBX/OBJ/Blend/glTF and CC0. Its [original publisher release](https://www.patreon.com/quaternius/posts/ultimate-animals-53427821) links the [download folder](https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk?usp=sharing). License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No files were downloaded or uploaded by this packet.

If the Google Drive folder is inaccessible, the official [LowPoly Animated Monsters download page](https://quaternius.itch.io/lowpoly-animated-monsters) was opened successfully. It offers `Monster Pack Animated by Quaternius.zip` (1.3 MB), publisher-declared CC0, OBJ/FBX/Blend, with animated models; tags include Skeletons and Dragons. This is the preferred small archive to inspect for a biped/monster pose proxy. Exact meshes/rigs remain uninspected. The page's exclusive goblin is Patreon-only and is excluded. The official [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) is a larger fallback, but its rigged .blend files are explicitly in the paid Source tier; do not assume its free Standard archive contains them.

This pack is worth a bounded inspection for a compact dog/fox-like proportional proxy. Actual archive filenames, mesh, rig controls, neutral pose and usable actions remain uninspected; choose only after local inspection. The important limitation is topology: a quadruped model will not demonstrate the M201 A biped's hands, wrist markers, shortened muzzle or source exaggerations. Prefer an available compact mesh with separate head and limb controls; reject a model if adapting it requires a new final character build. Do not claim stock action names prove M201 animation semantics. The older publisher [Farm Animals download](https://quaternius.itch.io/lowpoly-animated-animals) is also CC0, but its pug is a lower-fit alternative with the same anatomy limitation.

## Reusable implementation and acceptance

Read `scripts/compile-pixel-character-bank.py` and `scripts/build-character-appearance-workflow.py`; keep source transfer metadata and reuse mapping. The compiler already accepts `--archive-root`, `--bank`, `--output`, and `--check`. Root should create isolated study outputs, not rerun into canonical r02.

Suggested comparison columns are external research guide, current authored master where present, offline Blender proxy, and documented observations. Blender outputs must be clearly identified as proxy reference. If making pixel candidates later, return to editable indexed masters with shared palette, 0/255 alpha and nearest filtering; do not count downsampled proxy renders as completed masters. Preserve raw Main/Sub keys, native origins, frame references, durations, modes and loop starts. No new FPS, animation frames, collision or gameplay ownership.

The study succeeds if it makes specific occlusion/volume questions easier to judge with a fixed origin while keeping the selected identity and source constraints. It fails if a proxy requires large anatomy changes, moves original action endpoints, or looks cleaner only by concealing difficult source structures. Compare 1x pixel readability separately from enlarged study images. Technical checks, delegated art review, full sequence review, normal-path acceptance and physical-device checks remain distinct. This packet claims only three source-pose briefs and two existing authored baseline pointers; no Blender, animation, runtime or shipping acceptance.

## Evidence and stale-source handling

Championship Evidence MCP was queried for `character_animation` before original-structure claims. `CODEX_DIGIMON_SPRITE_PIPELINE.md` lines 26 and 51-83 describe separate Main/Sub resources, common-origin cells and NANR frame references. The current generated `motion-contract.json`, `origin-audit.json`, r02 `source-evidence.json`, and external `guide-index.json` provide task-specific geometry/timing; file references and hashes are retained in the packet.

Latest Owner pixel plan supersedes historical HD instructions. Current user research-only instruction governs source pixels. The package does not broaden any older licensed-runtime statement or modify the production index. Normal Hunt animation ownership remains a separate gameplay dependency.
