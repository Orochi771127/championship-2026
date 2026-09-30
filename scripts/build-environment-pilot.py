"""Assemble original ComfyUI candidates; never write runtime assets or gameplay.

Input art is generated, not drawn here. Numeric geometry and pure-color terrain
guides constrain compositions. This is an authoring pilot, not shipping art.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'docs/art/production/original-character-cage-r1/environment-pilot-20260919'
SPEC = ROOT.parent / 'ART_REFERENCE_LIBRARY/REPLACEMENT_SPEC'
EVIDENCE = ROOT / 'docs/art/production/cage/faithful-hd40/fields'
NEAREST = Image.Resampling.NEAREST


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save_png(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def grid_expand(values, width, height, tile):
    values = np.asarray(values)
    if values.size != width * height:
        raise ValueError('Grid length does not match geometry')
    return values.reshape(height, width).repeat(tile, 0).repeat(tile, 1)


def expand_ground(field):
    cells = [run[1:] for run in field['runs'] for _ in range(run[0])]
    if len(cells) != field['width'] * field['height']:
        raise ValueError('Bad ground RLE')
    return np.asarray(cells).reshape(field['height'], field['width'], 3)


def texture_fill(texture, size):
    a = np.asarray(texture.convert('RGBA'))
    w, h = size
    return Image.fromarray(np.tile(a, (h // a.shape[0] + 1, w // a.shape[1] + 1, 1))[:h, :w])


def masked(image, mask):
    a = np.array(image.convert('RGBA'))
    if mask.shape != a.shape[:2]:
        raise ValueError('Mask/image dimensions differ')
    a[:, :, 3] = np.where(mask, a[:, :, 3], 0)
    a[a[:, :, 3] == 0, :3] = 0
    return Image.fromarray(a)


def clean_prop(image, tolerance=27):
    """Remove this batch's observed dark background, not arbitrary dark objects.

    Use corner-color proximity and edge-connected flood only. Enclosed cabinet
    interiors and dark outlines are retained. No feathering or synthesized art.
    """
    rgb = np.asarray(image.convert('RGB'), dtype=np.int16)
    corners = np.array([rgb[12, 12], rgb[12, -13], rgb[-13, 12], rgb[-13, -13]])
    color = np.median(corners, axis=0)
    candidates = np.max(np.abs(rgb - color), axis=2) <= tolerance
    seed = np.zeros(candidates.shape, dtype=bool)
    seed[0] = candidates[0]
    seed[-1] = candidates[-1]
    seed[:, 0] = candidates[:, 0]
    seed[:, -1] = candidates[:, -1]
    background = ndimage.binary_propagation(seed, mask=candidates)
    alpha = ~background
    labels, _ = ndimage.label(alpha)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    if not counts.any():
        raise ValueError('No foreground remains')
    alpha = labels == counts.argmax()
    rgba = np.concatenate([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)[..., None]], 2)
    rgba[~alpha, :3] = 0
    out = Image.fromarray(rgba)
    box = out.getbbox()
    if box is None or min(box[:2]) == 0 or box[2] == out.width or box[3] == out.height:
        raise ValueError('Prop touches source border; inspect background removal')
    return out.crop(box), {'cornerColor': color.tolist(), 'tolerance': tolerance, 'crop': list(box)}


def fit_prop(image, size, bounds):
    left, top, right, bottom = bounds
    if not (0 <= left < right <= size[0] and 0 <= top < bottom <= size[1]):
        raise ValueError('Unsafe object bounds')
    scale = min((right - left) / image.width, (bottom - top) / image.height)
    target = (max(1, int(image.width * scale)), max(1, int(image.height * scale)))
    scaled = image.resize(target, NEAREST)
    # Fit only within the source cell. Placement anchor is NOT changed to center.
    dest = (left + (right - left - target[0]) // 2, bottom - target[1])
    out = Image.new('RGBA', size)
    out.alpha_composite(scaled, dest)
    return out


def pixel_report(image):
    a = np.asarray(image.convert('RGBA'))
    opaque = a[:, :, 3] == 255
    return {'size': list(image.size), 'partialAlphaPixels': int(((a[:, :, 3] > 0) & ~opaque).sum()),
            'opaquePixels': int(opaque.sum()), 'opaqueColors': int(len(np.unique(a[opaque, :3], axis=0)))}


def capture(recipe):
    """Save actual server history, plus immutable original generated PNGs."""
    records = []
    for job in recipe['jobs']:
        url = 'http://127.0.0.1:8000/history/' + job['promptId']
        with urllib.request.urlopen(url, timeout=15) as response:
            history = json.load(response)
        item = history.get(job['promptId'])
        if not item or not item.get('status', {}).get('completed'):
            raise RuntimeError('Generation not completed: ' + job['key'])
        outputs = [i for node in item['outputs'].values() for i in node.get('images', [])]
        if len(outputs) != 1:
            raise RuntimeError('Expected exactly one generated image')
        output = outputs[0]
        source = (Path(recipe['comfyOutput']) / output['subfolder'] / output['filename']).resolve()
        if not source.is_relative_to(Path(recipe['comfyOutput']).resolve()):
            raise ValueError('Output outside configured Comfy root')
        target = BATCH / 'raw' / (job['key'] + '.png')
        target.parent.mkdir(parents=True, exist_ok=True)
        # Exact byte import, preserving generation metadata embedded in PNG.
        target.write_bytes(source.read_bytes())
        save_json(BATCH / 'history' / (job['key'] + '.json'), item)
        records.append({**job, 'source': str(source), 'sha256': digest(target),
                        'raw': str(target.relative_to(BATCH))})
    checkpoints = {}
    for record in records:
        workflow = read_json(BATCH / 'history' / (record['key'] + '.json'))['prompt'][2]
        model = workflow['1']['inputs']['ckpt_name']
        if model not in checkpoints:
            path = Path(recipe['comfyModels']) / model
            checkpoints[model] = {'sha256': digest(path), 'path': str(path)}
    save_json(BATCH / 'generation-ledger.json', {
        'jobs': records, 'checkpointLocks': checkpoints,
        'generationCalls': len(records), 'externalApiCharge': 0,
        'currency': 'USD', 'electricityCost': None, 'hardwareCost': None,
        'costNote': 'Local inference only; power and equipment costs not measured. No commercial license determination.',
        'maxAttemptsPerPart': 2})


def build(recipe):
    locks = {}
    if (BATCH / 'source-locks.json').exists():
        for name, expected in read_json(BATCH / 'source-locks.json').items():
            path = Path(name) if Path(name).is_absolute() else ROOT / name
            if digest(path) != expected:
                raise ValueError('Geometry authority changed; review before rebuilding: ' + name)

    def locked(path):
        locks[str(Path(path).relative_to(ROOT)) if Path(path).is_relative_to(ROOT) else str(path)] = digest(path)
        return read_json(path)

    def specs(family):
        path = SPEC / ('SPEC_' + family.upper() + '.csv')
        locks[str(path)] = digest(path)
        with path.open(encoding='utf-8-sig', newline='') as stream:
            return list(csv.DictReader(stream))

    inventory = {family: specs(family) for family in ('cages', 'battle', 'hunt')}
    save_json(BATCH / 'inventory.json', inventory)
    manifest = {'schemaVersion': 1, 'status': 'AUTHORING_PILOT_NEEDS_ART_REVIEW',
                'runtimeEligible': False, 'shippingReady': False, 'ownerApproved': False,
                'sourcePolicy': 'GENERATED_PIXELS_ONLY; NUMERIC_GEOMETRY_AND_PURE_COLOR_GUIDES',
                'fields': []}
    textures, props, processing = {}, {}, {}
    ledger = read_json(BATCH / 'generation-ledger.json')
    for job in ledger['jobs']:
        if digest(BATCH / job['raw']) != job['sha256']:
            raise ValueError('Generated raw art changed: ' + job['key'])
    for key, spec in recipe['materials'].items():
        source = Image.open(BATCH / 'raw' / (spec['job'] + '.png')).convert('RGB')
        crop = source.crop(spec['crop'])
        small = crop.resize(tuple(spec['nativeSize']), NEAREST)
        small = small.quantize(colors=16, dither=Image.Dither.NONE).convert('RGB')
        # Compress contrast with an explicit material palette while retaining generated clusters.
        colors = np.asarray(spec['palette'], dtype=np.uint8)
        a = np.asarray(small).astype(float)
        luminance = a @ np.array([.299, .587, .114])
        low, high = np.percentile(luminance, [2, 98])
        index = np.clip((luminance - low) / max(1, high - low) * (len(colors) - 1), 0, len(colors) - 1).astype(int)
        small = Image.fromarray(colors[index]).convert('RGBA')
        textures[key] = small
        save_png(BATCH / 'parts/materials' / (key + '.png'), small)
        processing[key] = spec
    for key, spec in recipe['props'].items():
        source = Image.open(BATCH / 'raw' / (spec['job'] + '.png'))
        for repair in spec.get('clonePatches', []):
            # User-requested local correction from the same generated image.
            # No source-game pixels and no newly painted subject are introduced.
            x0, y0, x1, y1 = repair['destination']
            patch = source.crop(tuple(repair['source'])).resize((x1 - x0, y1 - y0), NEAREST)
            source.paste(patch, (x0, y0))
        prop, note = clean_prop(source, spec['backgroundTolerance'])
        # Quantize colors only; alpha stays binary and no antialiased resize is used.
        alpha = prop.getchannel('A')
        prop = prop.convert('RGB').quantize(colors=24, dither=Image.Dither.NONE).convert('RGBA')
        prop.putalpha(alpha)
        props[key] = prop
        save_png(BATCH / 'parts/props' / (key + '.png'), prop)
        processing[key] = {**spec, **note}
    save_json(BATCH / 'processing.json', processing)
    ground = locked(ROOT / 'src/data/championship/catalogs/raising-ground.r1.json')
    ground = {f['definitionIndex']: f for f in ground['fields']}
    runtime = {}
    for family in ('cage', 'battle', 'hunt'):
        m = locked(ROOT / f'assets/production/{family}/licensed-runtime-v1/manifest.json')
        runtime[family] = {f['fieldId']: f for f in m['fields']}
    cm01_contract = locked(ROOT / 'docs/art/contracts/cage/field_cm01_01.v1.json')
    field_images, checks = {}, []

    def export(family, field_id, frames, scale, extra):
        reference = runtime[family][field_id]
        if len(frames) != len(reference['frames']):
            raise ValueError('Frame count drift')
        out_frames = []
        for i, image in enumerate(frames):
            frame = f'fields/{field_id}/frame-{i:02}.png'
            enlarged = image.resize((image.width * scale, image.height * scale), NEAREST)
            if enlarged.size != (reference['worldWidthPx'], reference['worldHeightPx']):
                raise ValueError('World dimensions drift')
            save_png(BATCH / 'fields' / field_id / f'native-{i:02}.png', image)
            save_png(BATCH / frame, enlarged)
            timing = {k: v for k, v in reference['frames'][i].items() if k.startswith('duration')}
            out_frames.append({'src': frame, 'sha256': digest(BATCH / frame), **timing})
            checks.append({'fieldId': field_id, 'frameIndex': i, **pixel_report(image)})
        field_images[field_id] = frames[0].resize((frames[0].width * scale, frames[0].height * scale), NEAREST)
        manifest['fields'].append({'fieldId': field_id, 'family': family, 'frames': out_frames,
                                   'nativeSize': list(frames[0].size), 'pixelScale': scale,
                                   'worldWidthPx': reference['worldWidthPx'], 'worldHeightPx': reference['worldHeightPx'],
                                   'gameplayBinding': reference['gameplayBinding'], 'gateMapping': reference['gateMapping'],
                                   'collisionBinding': 'EXTERNAL_EXISTING_RUNTIME_UNMODIFIED', **extra})

    for spec in recipe['cages']:
        field_id = spec['fieldId']
        row = next(r for r in inventory['cages'] if r['fieldId'] == field_id)
        g = ground[int(row['cageDefinitionIndex'])]
        cells = expand_ground(g)
        owned = grid_expand(cells[:, :, 0], g['width'], g['height'], 8).astype(bool)
        walk = owned & (grid_expand(cells[:, :, 1], g['width'], g['height'], 8) != 1)
        core = locked(EVIDENCE / field_id / 'core-tilemap.json')
        footprint = grid_expand([c['tileIndex'] != 0 for c in core['cells']], core['width'], core['height'], 8)
        if footprint.shape != owned.shape:
            raise ValueError('Native core/ground geometry mismatch')
        # Non-owned guide cells are transparent. Structural filler is the one explicit exception.
        alpha = footprint if int(row['cageDefinitionIndex']) == 36 else owned
        size = (g['width'] * 8, g['height'] * 8)
        layer = masked(texture_fill(textures[spec['material']], size), alpha)
        save_png(BATCH / 'fields' / field_id / 'layers/ground.png', layer)
        save_png(BATCH / 'fields' / field_id / 'walk-mask.png', Image.fromarray(walk.astype('uint8') * 255))
        object_layer = Image.new('RGBA', size)
        placement_data = locked(EVIDENCE / field_id / 'object-placement.json')
        placements = placement_data['placements']
        object_meta = []
        if placements:
            bank = locked(EVIDENCE / field_id / 'object-cell-bank.json')
            rendered = {c['cellIndex']: c for c in bank['renderedCells']}
            if len(placements) != len(spec['objects']):
                raise ValueError('Object recipe does not cover exact source placements')
            for p, key in zip(placements, spec['objects']):
                if p['sequenceFrameCount'] != 1:
                    raise ValueError('Animated object needs explicit per-frame mapping')
                cell = rendered[p['resolvedFirstFrameCellId']]
                bounds = [1, 1, cell['width'] - 1, cell['height'] - 1]
                if field_id == 'field_cm01_01':
                    bounds = cm01_contract['objects'][p['ordinal']]['safeAlphaBounds']
                sprite = fit_prop(props[key], (cell['width'], cell['height']), bounds)
                if p['horizontalFlip']:
                    sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                if p['verticalFlip']:
                    sprite = sprite.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                dest = [p['sourceX'] - cell['anchorX'], p['sourceY'] - cell['anchorY']]
                filename = f'objects/obj-{p["ordinal"]:03}.png'
                save_png(BATCH / 'fields' / field_id / filename, sprite)
                object_layer.alpha_composite(sprite, tuple(dest))
                object_meta.append({'part': key, 'order': p['ordinal'], 'cellId': cell['cellIndex'],
                                    'placement': [p['sourceX'], p['sourceY']],
                                    'pivot': [cell['anchorX'], cell['anchorY']], 'destination': dest,
                                    'size': list(sprite.size), 'safeAlphaBounds': bounds, 'src': filename,
                                    'horizontalFlip': p['horizontalFlip'], 'verticalFlip': p['verticalFlip'],
                                    'bbox': list(sprite.getbbox())})
        save_png(BATCH / 'fields' / field_id / 'layers/objects.png', object_layer)
        save_json(BATCH / 'fields' / field_id / 'objects.json', object_meta)
        # Diagram only: field-specific production guide, not a runtime sprite.
        guide = Image.new('RGB', size, (45, 45, 45))
        pixels = np.array(guide)
        pixels[owned] = [110, 200, 110]
        guide = Image.fromarray(pixels).resize((size[0] * 4, size[1] * 4), NEAREST)
        gd = ImageDraw.Draw(guide)
        for x in range(0, guide.width, 32):
            gd.line((x, 0, x, guide.height), fill=(70, 80, 70))
        for y in range(0, guide.height, 32):
            gd.line((0, y, guide.width, y), fill=(70, 80, 70))
        gd.line((0, 96, guide.width, 96), fill=(255, 220, 40), width=2)
        for obj in object_meta:
            x, y = [v * 4 for v in obj['placement']]
            gd.line((x - 6, y, x + 6, y), fill=(255, 80, 220), width=2)
            gd.line((x, y - 6, x, y + 6), fill=(255, 80, 220), width=2)
        save_png(BATCH / 'fields' / field_id / 'work-guide.png', guide)
        composite = Image.alpha_composite(layer, object_layer)
        frames = [composite]
        if len(runtime['cage'][field_id]['frames']) == 2:
            # Local palette pulse only, fixed generated texture and fixed alpha.
            a = np.array(composite)
            pulse = ndimage.binary_erosion(alpha, iterations=8) & (a[:, :, 0] > 80)
            a[pulse, :3] = np.minimum(a[pulse, :3].astype(int) + [28, 12, 0], 255)
            frames.append(Image.fromarray(a))
            save_png(BATCH / 'fields' / field_id / 'animation-mask.png', Image.fromarray(pulse.astype('uint8') * 255))
        export('cage', field_id, frames, 4, {'definitionIndex': int(row['cageDefinitionIndex']),
               'objectCount': len(object_meta), 'walkPixels': int(walk.sum()),
               'uncoveredWalkPixels': int((walk & (np.asarray(composite)[:, :, 3] != 255)).sum()),
               'visualStage': 'GROUND_AND_OBJECT_PLACEMENT_STUDY; PERIMETER_ART_NOT_FINISHED'})

    # Battle: layout study only. Original seat/actor staging rectangles remain empty and opaque.
    row = next(r for r in inventory['battle'] if r['fieldId'] == 'field_bm01_01')
    battle = texture_fill(textures['slate'], (416, 272))
    rectangle = [int(x) for x in row['arenaInteriorPx'].split(',')]
    interior = [int(x / 4) for x in rectangle]
    floor = texture_fill(textures['clay'], (interior[2] - interior[0], interior[3] - interior[1]))
    battle.alpha_composite(floor, tuple(interior[:2]))
    export('battle', row['fieldId'], [battle], 4, {'standingSlotsPx': row['standingSlotsPx'],
           'arenaInteriorPx': rectangle, 'visualStage': 'MATERIAL_LAYOUT_ONLY; ARENA_SCENERY_NOT_FINISHED'})

    # Hunt: use only the pure-color terrain guide, never the original art overlay.
    row = next(r for r in inventory['hunt'] if r['fieldId'] == 'field_hm01_01')
    guide_path = Path(row['maskImage'])
    locks[str(guide_path)] = digest(guide_path)
    guide = Image.open(guide_path).convert('RGB')
    size = (1024, 1024)
    guide = np.asarray(guide.resize(size, NEAREST))
    green = np.all(guide == [110, 200, 110], 2)
    red = np.all(guide == [210, 60, 60], 2)
    blue = np.all(guide == [70, 130, 230], 2)
    if not (green | red | blue).all():
        raise ValueError('Unexpected guide colors: not a pure terrain mask')
    hunt = texture_fill(textures['grass'], size)
    hunt.alpha_composite(masked(texture_fill(textures['rock'], size), red))
    water = masked(texture_fill(textures['water'], size), blue)
    hunt.alpha_composite(water)
    save_png(BATCH / 'fields' / row['fieldId'] / 'layers/water.png', water)
    save_png(BATCH / 'fields' / row['fieldId'] / 'animation-mask.png', Image.fromarray(blue.astype('uint8') * 255))
    a = np.array(hunt)
    a[blue, :3] = np.minimum(a[blue, :3].astype(int) + [0, 7, 9], 255)
    export('hunt', row['fieldId'], [hunt, Image.fromarray(a)], 2,
           {'visualStage': 'TERRAIN_MATERIAL_LAYOUT_ONLY; BLOCKED_TERRAIN_NEEDS_READABLE_OBSTACLES',
            'authoringResolutionNote': '1024 authoring canvas; runtime contract is 2048. Not a native-ROM-resolution claim.',
            'walkGuidePixels': int(green.sum()), 'blockGuidePixels': int(red.sum()), 'waterGuidePixels': int(blue.sum())})

    geometry = json.loads(subprocess.check_output(['node', 'scripts/lib/cage-authoring-geometry.mjs'], cwd=ROOT, encoding='utf-8'))
    locks['scripts/lib/cage-authoring-geometry.mjs'] = digest(ROOT / 'scripts/lib/cage-authoring-geometry.mjs')
    save_json(BATCH / 'geometry-snapshot.json', geometry)
    assembly_checks = []
    for scenario in geometry['scenarios']:
        plan = scenario['plan']
        canvas = Image.new('RGBA', (plan['wrapWidthPx'], plan['residentViewport']['height']))
        for placement in plan['placements']:
            source = field_images[placement['fieldId']]
            r = placement['sourceRect']
            piece = source.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height']))
            canvas.alpha_composite(piece, (placement['x'], placement['y']))
        save_png(BATCH / 'assemblies' / (scenario['id'] + '.png'), canvas)
        assembly_checks.append({'scenario': scenario['id'], 'placementCount': len(plan['placements']),
                                'wrapFragmentCount': sum('fragmentOfSlot' in p for p in plan['placements']),
                                'sourceRectAuthority': 'ACTUAL_CREATE_RAISING_CAGE_ART_PLAN',
                                'perimeterSeamVisualApproval': False})

    # Contact sheet is QA presentation, not generated game art.
    sheet = Image.new('RGB', (1440, 880), '#19212b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
    draw.text((24, 12), 'ORIGINAL ENVIRONMENT PILOT | NOT RUNTIME / NOT ART APPROVED', font=font, fill='#dbe7db')
    for i, (field_id, image) in enumerate(field_images.items()):
        x, y = 24 + (i % 4) * 354, 60 + (i // 4) * 380
        draw.text((x, y), field_id, font=font, fill='#dbe7db')
        scale = min(330 / image.width, 320 / image.height)
        thumb = image.resize((int(image.width * scale), int(image.height * scale)), NEAREST)
        sheet.paste(thumb, (x, y + 32), thumb)
    draw.text((24, 844), '6 cages / 1 battle material layout / 1 hunt terrain layout. Perimeter and scene detail remain WIP.', font=font, fill='#d0aa76')
    save_png(BATCH / 'contact-sheet.png', sheet)
    manifest['remainingGates'] = ['ORIGINAL_PERIMETER_AND_GATE_ART', 'NATIVE_PIXEL_MANUAL_CLEANUP',
                                  'PROP_CONTACT_AND_OCCLUSION_REVIEW', 'SEAM_VISUAL_REVIEW',
                                  'HUNT_OBSTACLE_SCENERY', 'OWNER_VISUAL_APPROVAL',
                                  'MODEL_LICENSE_REVIEW', 'SEPARATE_RUNTIME_INTEGRATION_AUTHORIZATION']
    save_json(BATCH / 'manifest.json', manifest)
    save_json(BATCH / 'source-locks.json', locks)
    reuse = {key: [] for key in list(textures) + list(props)}
    for spec in recipe['cages']:
        reuse[spec['material']].append(spec['fieldId'] + ':ground')
        for i, key in enumerate(spec['objects']):
            reuse[key].append(spec['fieldId'] + ':object:' + str(i))
    for key in ('slate', 'clay'):
        reuse[key].append('field_bm01_01:material')
    for key in ('grass', 'rock', 'water'):
        reuse[key].append('field_hm01_01:terrain')
    save_json(BATCH / 'reuse-report.json', {
        'parts': reuse, 'uniqueRawGenerationsSelected': len({s['job'] for s in list(recipe['materials'].values()) + list(recipe['props'].values())}),
        'generationCount': ledger['generationCalls'], 'manualRepair': 'One same-image glass clone patch; no new generation',
        'humanRepairMinutes': None, 'aestheticallyAcceptedCages': 0,
        'costPerAcceptedCage': None, 'note': 'No aesthetic acceptance rate or cost savings can be inferred from mechanical checks.'})
    save_json(BATCH / 'selection-review.json', {j['key']: {'selected': j['selected'], 'assessment': j['assessment']} for j in recipe['jobs']})
    qa = {'scope': 'MECHANICAL_AUTHORING_CHECKS_NOT_AESTHETIC_APPROVAL', 'pixelChecks': checks,
          'assemblyChecks': assembly_checks, 'runtimeModified': False,
          'fieldCount': len(manifest['fields']), 'frameCount': sum(len(f['frames']) for f in manifest['fields']),
          'geometryUnchanged': all(digest(ROOT / p if not Path(p).is_absolute() else Path(p)) == sha for p, sha in locks.items()),
          'binaryAlpha': all(c['partialAlphaPixels'] == 0 for c in checks),
          'walkCoverage': all(f.get('uncoveredWalkPixels', 0) == 0 for f in manifest['fields']),
          'artApproval': False}
    save_json(BATCH / 'qa-report.json', qa)
    if not all(qa[k] for k in ('geometryUnchanged', 'binaryAlpha', 'walkCoverage')):
        raise RuntimeError('Mechanical checks failed; inspect qa-report.json')
    print(json.dumps({k: v for k, v in qa.items() if k not in ('pixelChecks', 'assemblyChecks')}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true', help='Import completed Comfy jobs/history; otherwise build fully offline')
    args = parser.parse_args()
    recipe = read_json(BATCH / 'recipe.json')
    if args.capture:
        capture(recipe)
    build(recipe)


if __name__ == '__main__':
    main()
