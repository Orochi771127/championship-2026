# Raising Home native image scale correction — 2026-09-06

Owner request: check cage and character image dimensions against the ROM and preserve their proportions. Scope: current static Raising Home identity art and Cage image units. No art pixels, save schema, gameplay effects, actor positions, or scene authority changed.

## Evidence verified

- Characters: 224 entities, 17,235 Main/Sub cell slots freshly decoded from raw NCER/OAM with transfer handling. 17,182 visible crops match current atlas RGBA exactly; 53 matching blank cells. Actual packing multipliers are 4, 8, and 12, varying between frames for 171 entities. All 1,230 indexed production file hashes match. [Character report](character-evidence.md), [summary](character-native-scale-summary.json), [reproducible verifier](verify-character-native-scale.py).
- Cages: all 40 decoded NBS dimensions, native metadata, world dimensions, and PNG headers agree on 4 world pixels per native pixel. This map review checked provenance and decoded dimensions; it did not rerun complete ROM decoding. [Map report](map-evidence.md).
- The generated runtime sizing catalog covers the first Main frame of action 0 for all 224 entities. Its builder checks current runtime/atlas JSON/PNG SHA-256, first frame identity, and trim/native dimension ratios. It copies only numeric sizing and hash metadata. Other animation frames are not bound by this catalog.

| First Main identity frame | Native visible width × height | Atlas enlargement |
|---|---:|---:|
| Digitama e000 | 14 × 18 | 12× |
| Agumon m201 | 16 × 18 | 12× |
| Tentomon m222 | 24 × 23 | 8× |
| Hagurumon m226 | 19 × 16 | 8× |
| Whamon m431 | 73 × 34 | 4× |
| CM01 cage composite | 96 × 112 | 4× |
| CM02 cage composite | 192 × 200 | 4× |

Character sizes exclude transparent padding. Cage sizes describe native map composites. A character pose may have a different visible extent from the first identity frame.

## Runtime correction

The old Raising presenter applied `120 / 352` to every packed character and then a separate viewport clamp. Cage art used a fit calculated from the entire ranch. More cages therefore made the maps smaller while the character remained large; per-entity atlas normalization also erased original relative body size.

The presenter now uses:

```text
shared screen pixels per native pixel = cage nativePixelWorldScale × scene fit
sprite local scale = texture source resolution / verified packed pixels per native pixel
actor root scale = shared screen pixels per native pixel × facing
```

Egg visible width / CM01 image width remains `14 / 96` at every tested viewport and composite extent. Existing sprite anchors and lane-to-screen actor positions remain intact. Selection/shadow decoration follows the visible body; invisible touch bounds stay at least 44 CSS pixels in each dimension. Legacy art without verified sizing retains an explicitly unverified fallback. Accepted appearance geometry uses its guarded source scale. Hunt animation/frame handling is unchanged.

The Cage loader validates positive native dimensions and equal horizontal/vertical scales. A composite preserves its shared native unit and rejects mismatched tile units before texture loading.

## Validation completed

- Full regression: **1,104 passed, 0 failed** (`node --test --test-concurrency=2 tests/*.mjs`); [log](regression.log).
- Focused suites cover geometry for actual 4×/8×/12× frames, all 224 static bindings, stale hash/frame rejection, atlas resolution, single/multiple cage fit, hit area, actual scene resize/flip/input/disposal, Cage validation and existing roster/map/presenter behavior.
- `node scripts/build-character-native-sizing.mjs --check`: PASS, all 224 records deterministic and current hashes match.
- `git diff --check`: PASS. Existing unrelated CRLF normalization notices are not whitespace errors.
- Browser normal path on isolated local port 8737: New Game → select egg → MANAGE → Cage Edit → place the four initial owned cages in slots 1–4 → Confirm → Back → Save → SYSTEM → Save & Quit → reload → Continue. Four cage visuals and corrected egg size restored.
- Rendered viewport checks: **390×844**, **320×568**, **1440×900**. At 320×568, clicking `(176, 210)` outside the approximately 8-pixel-wide egg centered near `(160, 210)` selected `DIGITAMA_0`, demonstrating padded input without enlarging art. Browser warning/error log was empty at the check. No physical phone was used.

Screenshots:

- [Single CM01 visual at 390×844](home-single-390x844.png)
- [Four cages at 390×844](home-four-390x844.png)
- [Four cages restored at 320×568](home-four-restored-320x568.png)
- [Successful padded tap at 320×568](home-four-padded-touch-320x568.png)
- [Four cages at 1440×900](home-four-1440x900.png)

## Explicit remaining boundaries

Native image dimensions are verified and the shared native-pixel ratio is integrated. Exact live original Raising final OBJ/affine/camera transforms still need a live sample or renderer-call trace; static OAM affine flags alone do not prove every gameplay transform. Original cage-to-cage join coordinates, source-origin/feet alignment, and resident-to-placed-cage world mapping remain separate unverified work. This correction does not assert complete original Ranch geometry, Raising animation parity, physical-device acceptance, or shipping readiness.
