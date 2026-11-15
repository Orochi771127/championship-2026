"""Make one arena's wide battle canvas: paint the ground, render the props, join with the play area.

    python -X utf8 scripts/battle-canvas/make.py --field field_bm02_01 --work <work dir> [--samples 96]
        [--steps ground,props,join] [--out <field dir>] [--evidence <dir>] [--blender <blender.exe>]

Steps:
  ground  arenas/<field>.paint(Ground) -> <work>/ground.png (+ water.png, detail maps)   (plain Python)
  props   props_blender.py in Blender  -> <work>/props.png and master-canvas.blend
  join    ring = ground + props, tone match, weld, centre = the live picture -> frame-00.webp, canvas.json

Outputs go to assets/production/battle/original-opus-canvas-r1/fields/<field>/ unless --out is given
(a preview run should pass --out so it does not touch the delivered files).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import canvaslib as C  # noqa: E402
import joinlib as J  # noqa: E402
from groundlib import Ground  # noqa: E402

BLENDER = r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
SIZE_BUDGET = 500_000      # bytes wanted for frame-00.webp
HERE = 'scripts/battle-canvas'


def save_rgb(array, path):
    Image.fromarray(np.clip(array + .5, 0, 255).astype(np.uint8)).save(path)


def step_ground(arena, work):
    ground = Ground(arena.FIELD_ID)
    painted = arena.paint(ground, work)
    save_rgb(painted['ground'], work / 'ground.png')
    # A half-size copy for the .blend to carry (the full picture would make the file ten times larger).
    view = Image.fromarray(np.clip(painted['ground'] + .5, 0, 255).astype(np.uint8))
    view.resize((C.CANVAS_W // 2, C.CANVAS_H // 2), Image.LANCZOS).save(work / 'ground-view.jpg', quality=86)
    save_rgb(ground.reference, work / 'reference.png')
    (work / 'notes.json').write_text(json.dumps(ground.notes, indent=1) + '\n', encoding='utf8')
    water = painted.get('water')
    if water is not None:
        Image.fromarray(np.clip(water * 255 + .5, 0, 255).astype(np.uint8)).save(work / 'water.png')
    elif (work / 'water.png').exists():
        (work / 'water.png').unlink()
    print('CANVAS_GROUND_PAINTED', work / 'ground.png')


def step_props(arena, work, blend, samples, blender):
    command = [blender, '-b', '--factory-startup', '--python', str(C.ROOT / HERE / 'props_blender.py'), '--',
               '--field', arena.FIELD_ID, '--work', str(work), '--blend', str(blend), '--samples', str(samples)]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf8', errors='replace')
    lines = [line for line in (result.stdout + result.stderr).splitlines()
             if any(tag in line for tag in ('CAMERA_', 'CANVAS_', 'Error', 'Traceback', 'File "', 'OPTIX_'))]
    print('\n'.join(lines))
    if result.returncode != 0 or not (work / 'props.png').exists() or 'Traceback' in result.stdout + result.stderr:
        print((result.stdout + result.stderr)[-3000:])
        raise SystemExit('PROPS_STEP_FAILED')
    backup = Path(str(blend) + '1')
    if backup.exists():
        backup.unlink()


def step_join(arena, work, out, blend_rel, evidence, quality):
    record = C.field_record(arena.FIELD_ID)
    base_rel = record['frames'][0]['src']
    base = np.array(Image.open(C.ROOT / base_rel).convert('RGB'))
    reference = np.array(Image.open(work / 'reference.png').convert('RGB')).astype(np.float32)
    ground = np.array(Image.open(work / 'ground.png').convert('RGB')).astype(np.float32)
    props = np.array(Image.open(work / 'props.png').convert('RGBA'))
    ring, covered = J.lay_props(ground, props)
    cx, cy, dist = J.seam_fields()
    edge = reference[cy - C.OY, cx - C.OX]
    options = getattr(arena, 'JOIN', {})
    classes = options.get('classes') or [(lambda rgb: np.ones(rgb.shape[:2], dtype=bool), options.get('tone_cap', J.TONE_CAP))]
    toned = ring + J.tone_offset(ring, edge, dist, classes)
    joined = J.weld(toned, reference, dist, options.get('weld', J.WELD), options.get('clash', 118.0))
    # Away from the seam the ring is a backdrop: a touch softer than the play area, which also
    # keeps the file small.
    soften = options.get('soften', .8)
    if soften:
        import cv2
        far = np.clip((dist - 24.0) / 80.0, 0, 1)[..., None]
        joined = joined * (1 - far) + cv2.GaussianBlur(joined, (0, 0), soften) * far
    canvas = np.clip(joined + .5, 0, 255).astype(np.uint8)
    centre = (slice(C.OY, C.OY + C.BASE_H), slice(C.OX, C.OX + C.BASE_W))
    canvas[centre] = base
    Image.fromarray(canvas).save(work / 'canvas.png')
    out.mkdir(parents=True, exist_ok=True)
    frame = out / 'frame-00.webp'
    # Quality 92 unless the picture is too busy for the size budget; then the highest step that fits.
    for quality in [q for q in (quality, 88, 84, 80, 76, 72) if q <= quality]:
        Image.fromarray(canvas).save(frame, 'WEBP', quality=quality, method=6)
        if frame.stat().st_size <= SIZE_BUDGET:
            break
    decoded = np.array(Image.open(frame).convert('RGB')).astype(np.int16)
    delta = np.abs(decoded[centre] - base.astype(np.int16))

    water = None
    if (work / 'water.png').exists():
        mask = np.array(Image.open(work / 'water.png').convert('L')).astype(np.float32) * (1 - covered)
        mask[centre] = 0                                  # the play area keeps its own water mask
        half = Image.fromarray(np.clip(mask + .5, 0, 255).astype(np.uint8)).resize((C.CANVAS_W // 2, C.CANVAS_H // 2), Image.LANCZOS)
        name = options.get('water_name', 'water-mask-canvas.webp')
        Image.merge('RGBA', [Image.new('L', half.size, 255)] * 3 + [half]).save(out / name, 'WEBP', lossless=True, method=6)
        water = {'src': name, 'sha256': J.sha(out / name), 'x': 0, 'y': 0, 'width': C.CANVAS_W, 'height': C.CANVAS_H,
                 'note': 'Half size, white with alpha = open water in the ring only; the play area is empty here and keeps its own mask.'}
    elif any(out.glob('*-mask-canvas.webp')):
        for stale in out.glob('*-mask-canvas.webp'):
            stale.unlink()

    producers = [f'{HERE}/{name}' for name in ('canvaslib.py', 'groundlib.py', 'kit.py', 'joinlib.py', 'props_blender.py', 'make.py',
                                                f'arenas/{arena.FIELD_ID}.py')]
    info = {
        'fieldId': arena.FIELD_ID,
        'canvasNativePx': list(C.NATIVE_CANVAS),
        'playOffsetNativePx': list(C.NATIVE_OFFSET),
        'worldScale': C.SCALE,
        'canvasWorldPx': [C.CANVAS_W, C.CANVAS_H],
        'playOffsetWorldPx': [C.OX, C.OY],
        'frame': {'src': 'frame-00.webp', 'sha256': J.sha(frame), 'bytes': frame.stat().st_size,
                  'encoding': f'WEBP lossy quality {quality}'},
        'centreSource': base_rel.replace('assets/production/battle/', ''),
        'centreSourceSha256': J.sha(C.ROOT / base_rel),
        'centreDiff': int(np.abs(canvas[centre].astype(np.int16) - base.astype(np.int16)).max()),
        'centreDiffNote': 'The lossless master (canvas.png, not committed) carries the live picture\'s pixels unchanged. '
                          'frame-00.webp is lossy, so re-encoding moves centre pixels slightly (centreDiffEncoded); '
                          'drawing the live picture over the centre at playOffsetWorldPx restores them exactly.',
        'centreDiffEncoded': {'mean': round(float(delta.mean()), 4), 'max': int(delta.max())},
        'camera': {'elevationDegrees': 52, 'nativePixelsPerUnit': C.UNIT, 'renderScale': C.SCALE,
                   'orthoScale': C.NATIVE_CANVAS[0] / C.UNIT, 'centreNative': [208, 136]},
        'waterMask': water,
        'sourceBlend': blend_rel,
        'sourceBlendSha256': J.sha(C.ROOT / blend_rel) if blend_rel and (C.ROOT / blend_rel).exists() else None,
        'producersLfSha256': {p: J.sha_text(C.ROOT / p) for p in producers},
        'groundTextures': 'Quilted or grid-continued from clean patches of the arena\'s own live picture and layers (project original).',
        'join': {'toneReachWorldPx': J.REACH * J.CELL, 'weldWorldPx': options.get('weld', J.WELD)},
        'rightsStatus': 'PROJECT_ORIGINAL',
        'romDerivedPixels': False,
        'generativeAi': None,
        'status': 'LOCAL_NOT_WIRED_NOT_PUBLISHED',
    }
    (out / 'canvas.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf8')
    print('CANVAS_JOINED', json.dumps({'field': arena.FIELD_ID, 'bytes': info['frame']['bytes'], 'centreDiff': info['centreDiff'],
                                       'centreDiffEncoded': info['centreDiffEncoded']}))
    if evidence:
        J.evidence(canvas, base, evidence)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--field', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--steps', default='ground,props,join')
    parser.add_argument('--out')
    parser.add_argument('--evidence')
    parser.add_argument('--blender', default=BLENDER)
    parser.add_argument('--quality', type=int, default=92)
    args = parser.parse_args()
    arena = C.arena_module(args.field)
    work = Path(args.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    delivered = C.ROOT / C.OUT_ROOT / args.field
    out = Path(args.out).resolve() if args.out else delivered
    blend = out / 'master-canvas.blend'
    blend_rel = f'{C.OUT_ROOT}/{args.field}/master-canvas.blend' if out == delivered else None
    steps = args.steps.split(',')
    if 'ground' in steps:
        step_ground(arena, work)
    if 'props' in steps:
        out.mkdir(parents=True, exist_ok=True)
        step_props(arena, work, blend, args.samples, args.blender)
    if 'join' in steps:
        step_join(arena, work, out, blend_rel, Path(args.evidence).resolve() if args.evidence else None, args.quality)


if __name__ == '__main__':
    main()
