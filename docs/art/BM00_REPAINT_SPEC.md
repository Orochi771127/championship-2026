# BM00 shared layer — repaint specification

For the next battle field batch. Supersedes the R4 shared layer
(`field-bm00-00-shared-layer-human-paint.png`), which is frozen as "geometry
authority" and is the single cause of defects across all eleven fields.

Acceptance is mechanical: `npm run art:battle:integrity` must pass.

---

## 0. Read this before designing anything

**The original ROM has no stone arena ring.** This was checked against the binary,
not inferred:

| Original payload | What it actually is |
|---|---|
| `field_bm00_00` | a **grass/dirt ground tileset** — 110,592 px, 8bpp, 256 colours, saturation 83.3% |
| `field_bm00_00_common` | a **small shared sprite set** — 4,480 px, 4bpp, **14 colours**, five value levels |
| `field_bm01_01` (BATTLE_NORMAL) | brown dirt ground, vivid green grass patches, **light grey metal fence posts and a yellow-green rail**, small puddles |

The original arena boundary is light sport/industrial fencing over a dirt-and-grass
ground plane. The ornate stone ring with arches, buttresses and cyan gems is
entirely project-invented.

Two consequences:

1. **Rights-wise this is good.** The ring owes nothing to the original, so it is
   clean original-created work.
2. **Design-wise it is a free choice that is currently working against the game.**
   The ring is the brightest, highest-contrast, most detailed object in every
   frame — in BM08 it is the brightest thing in a scene lit by lava. It
   out-competes the characters who stand in the six slots, which is backwards for
   a battle screen.

**Owner decision needed before repainting:** keep the heavy stone ring as the
project's own art direction, or move toward the original's lighter fence-and-ground
reading. This spec covers the repaint either way; the sections below are about
execution, not about which of those two you pick.

---

## 1. Matte / 去背

### The defect

The current layer was cut out against a light backdrop and kept it. Measured on
the shipped file:

| Alpha band | Pixels | Mean RGB | Luma |
|---|---:|---|---:|
| 1–64 | 11,163 | 242, 238, 232 | **237.6** |
| 64–128 | 3,483 | 221, 206, 184 | 203.7 |
| 128–200 | 16,648 | 203, 166, 123 | 164.0 |
| solid body | 269,877 | 141, 121, 85 | **115.9** |

Edge pixels are up to 120 luma lighter than the body they belong to. Composited
over dark fields this haloes: BM08 +59.6, BM02 +37.6, BM11 +33.0, BM01 +28.9. BM05
looks clean only because that background is white — the defect is hidden, not
absent.

### The fix: two-backdrop matting

Render the asset **twice, identical apart from the backdrop** — once on pure white,
once on pure black. Then solve exactly, per pixel:

```
C_black = α·F
C_white = α·F + (1−α)·255

α = 1 − (C_white − C_black) / 255      per channel, then take the max
F = C_black / α                         where α > 0
```

This recovers straight (non-premultiplied) alpha and **uncontaminated** foreground
colour. It is exact, not an approximation, and it is the only reliable way to get a
clean matte out of a generator that cannot render true transparency.

If only one render exists, decontaminate against the known backdrop `B`:

```
F = (C − (1−α)·B) / α        clamped to [0,255]
```

### Output requirements

- PNG, **straight alpha, not premultiplied**.
- No white, grey or coloured halo: every edge pixel's colour must lie between its
  local body colour and full transparency.
- Do not "fix" a halo by eroding the alpha — that thins the silhouette and leaves a
  hard aliased edge. Fix the colour, keep the coverage.

**Acceptance:** `MATTE` ≤ 12 and `HALO` ≤ 12 on all seven fields.

---

## 2. Style

### What actually reads as mechanical

Not the saturation. The measured problem is colour *count* and edge uniformity:

| | Original `bm01` field | Original shared sprite | **Current BM00 repaint** |
|---|---:|---:|---:|
| Distinct colours drawn | 256 | **14** | **81,989** |
| Distinct luma levels | 122 | 5 | 226 |
| Mean saturation | 71.4% | — | 44.6% |

The original is flat, hard-edged, limited-palette art. The repaint is a smooth
continuous-tone render — roughly 5,800× the colour count of the original shared
sprite. That smooth gradient shading is what reads as machine-made, and no amount
of desaturation fixes it. Desaturating only drained the colour while leaving the
mechanical shading in place.

### Targets

- **Value ladder per material: 4–6 steps.** The original shared sprite uses four
  light values plus transparency. Block the form in flat steps first; add breakup
  after, not smooth ramps.
- **Total distinct colours in the ring: hundreds, not tens of thousands.**
- **Raise chroma.** Saturation ≥ 55% for the ring, against the original family
  average of 64.6%. Colour temperature should vary *within* a material — warm
  light face, cool shadow face — rather than one hue getting lighter and darker.

### Remove

These are the specific things producing the mechanical feel, all of them already
banned by the batch's own `ART_DIRECTION.md`:

- uniform outline weight tracing every edge — vary it, and let edges drop out
  entirely where forms turn away or meet similar values;
- the repeating stamped stone/cobble pattern tiled across every face;
- symmetrical faceted gems with centred specular highlights;
- smooth gradient bevels on every block;
- every edge terminating the same way.

### Value hierarchy

The ring must sit **inside** the scene's value structure, not on top of it. It is
scenery framing the combat floor, not the subject. In a dark field it should be
dark; the six characters standing in the slots are the subject.

---

## 3. Per-scene grading

A single bitmap alpha-pasted into seven scenes cannot be lit by any of them. The
current ring is byte-identical in all seven composites — `ADAPTATION` measures
exactly 0.00.

Ship the ring as a **neutral base plus a per-field grade**, applied at composite
time:

- ambient tint pulled from the field's own dominant light (BM08 red from below,
  BM05 cool blue from above, BM11 cool overhead);
- a bounce term from the arena floor colour on upward-facing surfaces;
- per-field exposure so the ring sits in the scene's value band.

**Acceptance:** `ADAPTATION` ≥ 3.

## 4. Contact shadow

Nothing is grounded — the luminance profile outward from the silhouette is flat in
five of seven fields, and pillars end in a flat cut with no occlusion.

A baked shadow will not work, because the shadow differs per scene. Emit a **third
layer**: a shadow/ambient-occlusion mask derived from the ring silhouette, which
the compositor multiplies over the background *before* drawing the ring. Direction
and length come from each field's light; contact darkening at the base is common to
all.

**Acceptance:** `GROUNDING` ≥ 4.

---

## 5. The six slot coordinates, as a generation constraint

This is the fix for the worst defect — BM10 painted two combat slots onto the
spectator tiers, BM09 one onto the terrace.

Generated by `scripts/build-battle-field-geometry-constraint.py` from the shared
layer itself, so it stays correct when BM00 changes:

- `docs/art/BATTLE_FIELD_GEOMETRY_CONSTRAINT.json`
- `docs/art/production/battle/field-floor-coverage-mask.png`

### The rule

> The background must paint continuous, walkable combat floor across the **whole
> arena interior**. Scenery, walls, seating, water and terrain edges stay outside
> it.

Arena interior: 586,250 px, 37.3% of the 1536×1024 frame, bbox x 55–1479,
y 301–835.

**`floorTopY = 301` (normalised 0.294).** The floor must reach at least this high.
A horizon, terrace edge or pitch boundary painted below that line leaves the back
of the arena unfloored — exactly the BM09 and BM10 failure.

### Slots

| Slot | x | y |
|---|---|---|
| 1 | 351–574 | 365–424 |
| 2 | 961–1184 | 365–424 |
| 3 | 291–555 | 450–535 |
| 4 | 980–1255 | 450–535 |
| 5 | 291–559 | 568–683 |
| 6 | 975–1289 | 568–683 |

Normalised coordinates are in the JSON, for any canvas size.

### How to feed it to generation

1. Pass `field-floor-coverage-mask.png` as a region/inpaint constraint so the
   generator treats the interior as one continuous ground material.
2. Put the rule in the prompt in scene terms, not coordinates — "the arena floor
   fills the lower two-thirds of the frame and its back edge sits above the
   mid-line; all spectator structure, walls and terrain sit behind and above the
   floor, never inside it."
3. Generate, then run the gate **before** building composites. `SLOTS` fails fast
   and names the offending slot.

Do not move the slots to fit a background. They are canonical geometry; the
background moves.
