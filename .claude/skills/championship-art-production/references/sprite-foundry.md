# Sprite foundry: native reference → generated keys → 60 fps events

Local, free toolchain in `scripts/championship-sprite-foundry/` for the
character-motion workflow: a native pixel snapshot is the pose reference, an
image generator (ChatGPT) draws HD keys A (event 1/6) and B (event 4/6) — one
frame or a 4×4 eight-direction sheet — and the tools turn those into clean,
root-locked frames and a six-event loop. Python 3.12 with Pillow, numpy, scipy,
opencv-python and onnxruntime; ffmpeg only for MP4 previews.

It builds on three installed upstream skills (read them for background, not as
project rules):

| Skill | Source | Used for |
|---|---|---|
| [sprite-pipeline](../../sprite-pipeline/SKILL.md) | openai/plugins `plugins/game-studio` | strip-first generation, one shared scale, integer nearest-neighbour seed canvas |
| [character-sprite-maker](../../character-sprite-maker/SKILL.md) | Clad3815/character-sprite-maker | border-sampled chroma key, spill cleanup, flat-background discipline |
| [character-animation](../../character-animation/SKILL.md) | karem505/character-animation-skill | U²-Net matte (`remove_bg_ml.py`), uneven holds from `references/animation-fluidity.md` |

Their own image-generation scripts (`generate_spritesheet.py`,
`generate_posed_frames.py`) call the paid Gemini API; the foundry never uses
them. ChatGPT stays the generator.

## Pipeline

1. **Prompt and plate (Tool D)** — `prompt_kit.py --native N.png --design D.png
   --role UL33 --action "normal hitback" --event "Native008, 7 ticks" --notes "..."`.
   Writes `PLATE_KEY.png` (attach to ChatGPT), `PLATE_GUIDES.png` (your
   overlay check only; generators copy guide lines), `analysis.json` and
   `PROMPT.md`. Geometry is measured (lean, mass centre, torso, extremities,
   detached pieces, palette). Expression and story beats come only from
   `--notes`. The chroma key is chosen farthest from the character's colours.
2. **Split and matte (Tool A)** — `split_sheet.py SHEET.png --out-dir RUN/split`
   (4×4 default: rows A S..NE, A N..SW, B S..NE, B N..SW; `--region` for one
   panel). Label bands are cut when short, at the cell edge and made of ≥4 glyph
   components (`--label-crop TOP,BOTTOM` to force). Cells keep full size: no
   per-frame crop or rescale.
3. **ROOT HOLD (Tool B)** — `root_lock.py --split-dir RUN/split --out-dir RUN/lock`.
   Translation only. Pass = independent ECC residual < 0.5 px and ≥ 30 % of the
   torso agreeing. On FAIL, give `--torso-box x0,y0,x1,y1`; never accept a FAIL
   by eye. `--art-kind pixel` (or `--integer`) for whole-pixel shifts.
   For rigid-torso actions (flight, idle, attack, hit). Walk, run and bound
   poses change the body's shape: there it reports low agreement (GR18 BOUND8:
   14–39 %) and the authored ground registration stays. A body that surges
   forward in the stretch phase of a bound (GR18 Right/DownRight B/C, 10–18 px
   on the 256 canvas) is authored motion, not a registration error; if it reads
   as sliding in game, that is stride versus Arena move speed (worldMotion),
   an evidence or Owner question, not an art fix.
4. **Events (Tool C)** — `tween_events.py --lock-dir RUN/lock --out-dir RUN/events --mp4`.
   Events 1 and 4 are the keys bit for bit; 2, 3, 5, 6 are pivot-warped tweens.
   Pass the source's authored ticks with `--ticks 6,4,6,6,4,6`: kept verbatim.
   Without it the 11/6/6/11/7/7 holds are a proposal (`timing_source:
   PROPOSED`) that the exporter refuses. `--bob` moves the root on purpose (off
   by default). Pixel art is refused unless `--allow-pixel-warp`.
5. **Hit reaction (Tool C2)** — `hitback_props.py --frame HIT.png --ticks 7 --extend 11`.
   Whole-pixel knock-back shake on the body; detached props (crown) fly on a
   ballistic arc with damped spin. The drawing, face included, is never altered.
6. **Handoff export (Tool E)** — `export_handoff.py --timeline RUN/events/S/timeline.json
   --out-dir OUT --id-prefix ... --clip-id handoff:arena:S:flight --action flight
   --direction S --native-body-height H`. Atlas pages (8 px gutters, named by
   SHA-256) and `handoff.frames-clips.json`, whose frames carry only `id, image,
   sha256, frame, trim, sourceSize, origin, density, sampling`. Provenance goes
   to `handoff.sidecar.NOT_PUBLIC.json`. Then the handoff's own manifest build
   and the facing-mask gate (`python -I scripts/build-reviewed-action-masks.py`).
7. Review the QA images, then register and integrate through the normal
   Production → Integration → Acceptance modes of this skill.

## White-safe matte

- Background is removed only by a flood from the image border through pixels
  within `tol` of the border colour, so white or cream inside an outline is never
  reached.
- Enclosed backdrop-coloured pockets are removed only when U²-Net calls them
  background **and** they are flat (≥ 60 % within 2 levels of the backdrop;
  ≥ 90 % without U²-Net). Fur and armour have brush texture and are kept.
- U²-Net never sets the edge. The edge ring gets a colour-distance alpha and
  decontamination `C = (I − (1 − a)·bg) / a`, so no grey or key halo remains.
- `white_kept_ratio` in `split_manifest.json` counts body whites (2 px inside
  the outline) that became transparent; anything below 1.0 needs a look.
- Ask the generator for a chroma key (Tool D picks one). A white background
  works with U²-Net (`--u2net on`) but stays the riskier case.

## Rules

Handoff gates (agreed with the character-animation acceptance session, 2026-11-01):

- **Resolution and sampling.** Painted art keeps its source pixels: no 256 px
  thumbnails into the game. One scale per clip, stored at up to 2× the
  density-4 grid and never above the source, marked `sampling: 'smooth'`
  (linear + mipmaps). Nearest sampling is for pixel art only. GR18 went blurry
  and speckled on phones when 0.2× frames were drawn as pixel art.
- **No mirroring** of an asymmetric character to fill a direction unless the
  Owner approved that role and direction. The foundry never mirrors.
- **Motion acceptance is not style acceptance.** Each direction still needs its
  own style review.
- **Ticks** stay as authored, in order, repeats included; never averaged or
  turned into milliseconds at the source. No hitFrame, projectile origin or
  emission point without evidence.
- **origin** is the feet point in native px × density, one per clip: no
  per-frame grounding or rescaling.

- Everything the foundry writes is `RESEARCH_ONLY` until it has an allowed
  record in `assets/production/ART_PRODUCTION_INDEX.json` (hard rule 1). Native
  frames are pose and timing references: never trace, copy or ship them. Run
  outputs go to a scratch or intake folder, never straight into
  `assets/production/`.
- Tweens are drafts. Machine in-betweens of authored keys need the same review
  as any art; a tween that fails review is replaced by an authored frame.
- One shared scale per character: no tool resizes a frame to fit.
- After art changes, the facing gates in
  [characters-and-cameras.md](characters-and-cameras.md) still apply.

## Check the toolchain

```bash
python scripts/championship-sprite-foundry/selftest.py
```

Synthetic sheet with known answers (white armour, labels, a known
(+2.375, −1.625) px offset): 7 checks, about 15 s. The U²-Net check is skipped
until `~/.u2net/u2net.onnx` exists (one-time ~176 MB download:
`python -c "import foundry_matte as m; m.download_u2net()"` from the foundry
folder, or `split_sheet.py --u2net on`).
