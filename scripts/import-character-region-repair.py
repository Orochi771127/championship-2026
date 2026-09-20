"""Import a hash-bound generated paint region, preserving original alpha/origin.

Generation and billing are deliberately outside this deterministic importer.
Uses the existing donor gate, canonical aliases and bank assembler.
"""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sheet_job', ROOT/'scripts/character-sheet-job.py')
J = importlib.util.module_from_spec(spec)
spec.loader.exec_module(J)
P = J.P


def apply_region(base, generated, rectangle, colors, protected):
    P.require(base.size == generated.size == (64, 64), 'REGION_CANVAS_DRIFT')
    x0, y0, x1, y1 = rectangle
    P.require(0 <= x0 < x1 <= 64 and 0 <= y0 < y1 <= 64, 'INVALID_REGION')
    out = base.copy()
    edits = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            before = base.getpixel((x, y))
            candidate = generated.getpixel((x, y))
            # Only opaque existing body pixels can change. Face marks and
            # pale porcelain stay intact; importing a glowing halo is impossible.
            r, g, b, a = candidate
            is_rope = r > g * 1.12 and g > b * 1.35 and r > 65
            if before[3] != 255 or before in protected or a < 128 or not is_rope:
                continue
            after = min(colors, key=lambda c: sum((c[i]-candidate[i])**2 for i in range(3)))
            if after != before:
                out.putpixel((x, y), after)
                edits.append({'xy': [x, y], 'before': list(before), 'after': list(after)})
    P.require(out.getchannel('A').tobytes() == base.getchannel('A').tobytes(), 'ALPHA_CHANGED')
    return out, edits


def build(manifest_path):
    config = P.read(manifest_path)
    entity = config['entityId']
    J.D.validate(entity)
    job_root = J.JOBS/entity
    base = job_root/config['base']
    source = manifest_path.parent/config['image']
    output = job_root/config['output']
    for path in (base, source, output):
        P.require(path.resolve().is_relative_to(job_root.resolve()), 'OUTSIDE_CHARACTER_JOB')
    P.require(base.resolve() != output.resolve(), 'CANNOT_OVERWRITE_BASE')
    P.require(P.sha((base/'bank.json').read_bytes()) == config['baseBankSha256'], 'BASE_BANK_DRIFT')
    P.require(P.sha(source.read_bytes()) == config['imageSha256'], 'GENERATED_IMAGE_DRIFT')
    for name, digest in P.read(base/'receipt.json')['files'].items():
        P.require(P.sha((base/name).read_bytes()) == digest, 'BASE_RECEIPT_DRIFT '+name)
    prior = P.read(base/'bank.json')
    inv = P.read(J.D.BASE/entity/'inventory.json')
    P.require(prior['sourceOrigin'] == inv['sourceOrigin'] == config['sourceOrigin'], 'ORIGIN_DRIFT')
    cols, rows = config['grid']
    image = Image.open(source).convert('RGBA')
    P.require(abs(image.width/image.height-cols/rows) < .015, 'GRID_RATIO_DRIFT')
    P.require(image.getchannel('A').getextrema()[0] == 0, 'TRANSPARENT_SOURCE_REQUIRED')
    small = image.resize((cols*64, rows*64), Image.Resampling.NEAREST)
    masters = {k: Image.open(base/v['image']).convert('RGBA') for k, v in prior['cells'].items() if k == v['canonical']}
    palette = P.PIXEL.parse_palette(prior['palette'])
    protected = [palette[i] for i in config['protectedPaletteIndices']]
    colors = [tuple(c) for c in config['bindingColors']]
    audit = []
    touched = set()
    for entry in config['panels']:
        key, n = entry['key'], entry['panel']
        P.require(key in masters and key not in touched and 0 <= n < cols*rows, 'INVALID_PATCH_TARGET')
        touched.add(key)
        tile = small.crop((n%cols*64, n//cols*64, n%cols*64+64, n//cols*64+64))
        masters[key], edits = apply_region(masters[key], tile, entry['region'], colors, protected)
        P.require(len(edits) >= 2, 'NO_USEFUL_REGION_PIXELS '+key)
        audit.append({**entry, 'edits': edits, 'alphaUnchanged': True, 'faceMarksProtected': True})
    plan = {'slots': {k: {**r, 'sourceTranslationFromCanonical': r['translation']} for k, r in inv['slots'].items()}}
    metadata = {k: v for k, v in prior.items() if k not in ('cells', 'sequences', 'palette', 'entityId')}
    metadata.update({'designVersion': config['designVersion'], 'generationTool': 'MIXED_BUILTIN_AND_HIGGSFIELD',
        'modelVersion': 'MIXED_NOT_EXPOSED_AND_GPT_IMAGE_2_5', 'higgsfieldCalls': 1,
        'generationCalls': prior.get('generationCalls', 0) + 1,
        'generationCallsByProvider': {'BUILTIN_IMAGEGEN': prior.get('generationCalls', 0), 'HIGGSFIELD': 1},
        'requiredSlots': inv['counts']['slots'], 'requiredSequences': inv['counts']['sequences'],
        'regionRepair': {'jobId': config['jobId'], 'model': 'gpt_image_2_5', 'changedMasters': sorted(touched),
            'generatedSheetSha256': config['imageSha256'], 'alphaPreserved': True, 'estimatedCredits': 3},
        'artReview': 'PENDING_FULL_CHARACTER_REVIEW', 'normalGameQa': 'NOT_RUN'})
    files = {'region-repair.json': P.encoded(config), 'region-pixel-edits.json': P.encoded(audit)}
    reviews = P.read(base/'cell-review.json')
    for row in reviews:
        if row['key'] in touched:
            row['regionRepair'] = 'GENERATED_BINDING_ONLY_ALPHA_AND_FACE_PROTECTED'
    J.M.assemble(masters, plan, {'entityId': entity, 'palette': prior['palette']}, files, reviews,
                 metadata, output, config)
    print('REGION_PIXELS_CHANGED', sum(len(a['edits']) for a in audit))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    build(parser.parse_args().manifest)
